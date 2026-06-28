import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { createInvoice, findExistingInvoice, DuplicateInvoiceError } from '@/lib/invoice/create-invoice'

// Stripe needs the RAW request body to verify the signature, so this route must
// never run through a JSON body parser. In the App Router `await req.text()`
// gives us the untouched body. Force the Node.js runtime (the Stripe SDK relies
// on Node crypto for constructEvent).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface BookingMetadata {
  appointmentId?: string
  companyId?: string
  premiseId?: string
  deviceId?: string
  chargedAmount?: string
  paymentMode?: string
}

export async function POST(req: NextRequest) {
  // --- 1. Signature verification (raw body) -------------------------------
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    console.error('[stripe/webhook] Missing signature or STRIPE_WEBHOOK_SECRET')
    return new NextResponse('Missing signature', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    console.error('[stripe/webhook] Signature verification failed:', message)
    return new NextResponse(`Webhook signature verification failed: ${message}`, { status: 400 })
  }

  try {
    // checkout.session.completed is the SINGLE source of truth for invoice
    // creation. It fires reliably for every completed Checkout session, so we do
    // NOT also handle payment_intent.succeeded — handling both would create two
    // invoices for one payment.
    //
    // The full booking metadata (premiseId/deviceId/chargedAmount/paymentMode) is
    // set on payment_intent_data.metadata in the checkout route, which lands on
    // the PaymentIntent — NOT on session.metadata (that only carries
    // appointmentId + companyId). So we retrieve the PI to read the full metadata.
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      // Only act on actually-paid sessions.
      if (session.payment_status !== 'paid') {
        console.log('[stripe/webhook] session not paid, ignoring:', session.id)
        return NextResponse.json({ received: true })
      }

      const piId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id ?? null

      let metadata: BookingMetadata = (session.metadata ?? {}) as BookingMetadata
      if (piId) {
        const pi = await stripe.paymentIntents.retrieve(piId)
        // PI metadata is the authoritative source for the booking fields.
        metadata = { ...metadata, ...(pi.metadata as BookingMetadata) }
      }

      return await processBookingPayment(metadata, piId)
    }

    // --- Subscription lifecycle ---------------------------------------------
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(event.type, event.data.object as Stripe.Subscription)
        return NextResponse.json({ received: true })

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        await handleInvoiceEvent(event.type, event.data.object as Stripe.Invoice)
        return NextResponse.json({ received: true })
    }

    // All other event types (including payment_intent.succeeded) are intentionally
    // ignored — invoice creation happens only on checkout.session.completed.
    // Acknowledge so Stripe stops retrying.
    return NextResponse.json({ received: true })
  } catch (err) {
    // The payment succeeded but our processing (e.g. invoice creation) failed.
    // Return 500 so Stripe retries delivery — the idempotency guard in
    // processBookingPayment prevents a double-issued invoice on retry.
    const message = err instanceof Error ? err.message : 'webhook processing error'
    console.error('[stripe/webhook] processing error:', message)
    return new NextResponse('Webhook processing failed', { status: 500 })
  }
}

// --- Subscription helpers ---------------------------------------------------

// Stripe's status strings map almost 1:1 to our column; coerce the terminal
// "incomplete_expired" to "canceled" so the UI/guard treats it consistently.
function mapStatus(stripeStatus: Stripe.Subscription.Status): string {
  return stripeStatus === 'incomplete_expired' ? 'canceled' : stripeStatus
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null
}

// In the current Stripe API the billing period lives on each subscription item
// (not on the subscription itself). For our single-item subscriptions the first
// item carries the canonical period.
function subscriptionPeriod(subscription: Stripe.Subscription): {
  start: string | null
  end: string | null
} {
  const item = subscription.items?.data?.[0]
  return {
    start: isoFromUnix(item?.current_period_start),
    end: isoFromUnix(item?.current_period_end),
  }
}

async function handleSubscriptionEvent(
  type: 'customer.subscription.created' | 'customer.subscription.updated' | 'customer.subscription.deleted',
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createServiceClient()

  const period = subscriptionPeriod(subscription)
  const update: Record<string, unknown> = {
    status: type === 'customer.subscription.deleted' ? 'canceled' : mapStatus(subscription.status),
    current_period_start: period.start,
    current_period_end: period.end,
    trial_ends_at: isoFromUnix(subscription.trial_end),
    updated_at: new Date().toISOString(),
  }

  if (type === 'customer.subscription.deleted') {
    update.canceled_at = isoFromUnix(subscription.canceled_at) ?? new Date().toISOString()
  } else if (subscription.cancel_at_period_end) {
    update.canceled_at = isoFromUnix(subscription.canceled_at) ?? new Date().toISOString()
  } else {
    // Not pending cancellation (e.g. the user resumed via the Stripe portal) —
    // clear any previously stamped cancellation so the banner/guard reset.
    update.canceled_at = null
  }

  const { error } = await supabase
    .from('pos_subscriptions')
    .update(update)
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('[stripe/webhook] subscription update failed:', error.message)
    throw new Error(error.message)
  }
}

async function handleInvoiceEvent(
  type: 'invoice.payment_succeeded' | 'invoice.payment_failed',
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId =
    typeof (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription === 'string'
      ? ((invoice as unknown as { subscription: string }).subscription)
      : ((invoice as unknown as { subscription?: Stripe.Subscription }).subscription?.id ?? null)

  if (!subscriptionId) return // not a subscription invoice — ignore

  const supabase = createServiceClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (type === 'invoice.payment_failed') {
    update.status = 'past_due'
  } else {
    // Payment succeeded → the subscription is fully active. Refresh periods
    // from the live subscription so renewal dates stay accurate.
    update.status = 'active'
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      const period = subscriptionPeriod(sub)
      update.current_period_start = period.start
      update.current_period_end = period.end
    } catch (err) {
      console.error('[stripe/webhook] subscription retrieve failed:', err instanceof Error ? err.message : err)
    }
  }

  const { error } = await supabase
    .from('pos_subscriptions')
    .update(update)
    .eq('stripe_subscription_id', subscriptionId)

  if (error) {
    console.error('[stripe/webhook] invoice event update failed:', error.message)
    throw new Error(error.message)
  }
}

async function processBookingPayment(
  metadata: BookingMetadata,
  stripePaymentIntentId: string | null
): Promise<NextResponse> {
  const { appointmentId, companyId, premiseId, deviceId, chargedAmount, paymentMode } = metadata

  if (!appointmentId || !companyId) {
    // Not enough info to issue an invoice — acknowledge so Stripe doesn't retry.
    console.error('[stripe/webhook] missing appointmentId/companyId in metadata', metadata)
    return NextResponse.json({ received: true })
  }

  // --- 2. Idempotency: already processed? ---------------------------------
  const existing = await findExistingInvoice({ companyId, appointmentId, stripePaymentIntentId })
  if (existing) {
    console.log('[stripe/webhook] invoice already exists, skipping:', existing.invoiceNumber)
    return NextResponse.json({ received: true, alreadyProcessed: true })
  }

  const supabase = createServiceClient()

  // --- 3. Read the Termini row -------------------------------------------
  const { data: termin, error: terminErr } = await supabase
    .from('Termini')
    .select(
      'id, "ID podjetja", "Storitev", "Cena", "Final cena", "Popust", "Popust type", "Valuta", "Status", "Stranka", "Email", "Telefon"'
    )
    .eq('id', appointmentId)
    .maybeSingle()

  if (terminErr) {
    // DB read error — let Stripe retry.
    throw new Error(`Termini read failed: ${terminErr.message}`)
  }
  if (!termin) {
    // Appointment vanished — don't error-loop Stripe.
    console.error('[stripe/webhook] Termini row not found for id:', appointmentId)
    return NextResponse.json({ received: true })
  }

  // --- VAT settings -------------------------------------------------------
  const { data: settings } = await supabase
    .from('pos_settings')
    .select('default_vat_rate, is_vat_registered, currency')
    .eq('company_id', companyId)
    .maybeSingle()

  const vatRate = settings?.is_vat_registered ? settings.default_vat_rate ?? 0 : 0

  // --- 4. Build the invoice line item from the Termini row ----------------
  const isDeposit = paymentMode === 'deposit'
  const finalPrice =
    termin['Final cena'] != null && termin['Final cena'] > 0
      ? Number(termin['Final cena'])
      : Number(termin['Cena'] ?? 0)

  // For a deposit, the invoice reflects the amount actually charged (the
  // deposit) from metadata. For a full payment, use the final service price.
  const depositCharged = Number(chargedAmount ?? 0)
  const unitPrice = isDeposit && depositCharged > 0 ? depositCharged : finalPrice

  const description = (termin['Storitev'] as string) || 'Storitev'

  const items = [
    {
      description,
      quantity: 1,
      unit_price: unitPrice, // gross
      vat_rate: vatRate,
    },
  ]

  // --- Amounts (mirror the InvoiceForm/route calc: VAT is included in gross)
  // The charged/final price already reflects any discount, so we do not apply
  // the Termini discount again here (it would double-count). Discount is 0.
  const itemsTotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  const subtotal = itemsTotal
  const total = subtotal
  const vatAmount = subtotal * (vatRate / (100 + vatRate))

  // --- 5. Buyer info from the Termini row ---------------------------------
  const buyer = {
    name: (termin['Stranka'] as string) || null,
    email: (termin['Email'] as string) || null,
    phone: (termin['Telefon'] as string) || null,
    type: 'physical' as const,
  }

  const currency = (termin['Valuta'] as string) || settings?.currency || 'EUR'
  const notes = isDeposit ? 'Predplačilo (polog)' : null

  // --- 6. Issue the invoice (also flags Termini Plačano / ID računa / Način)
  try {
    await createInvoice({
      companyId,
      appointmentId,
      premiseId: premiseId!,
      deviceId: deviceId!,
      paymentMethod: 'online',
      items,
      subtotal,
      vatRate,
      vatAmount,
      total,
      discountType: null,
      discountAmount: 0,
      buyer,
      notes,
      currency,
      stripePaymentIntentId,
    })
  } catch (err) {
    // The unique_appointment_invoice constraint fired (error 23505): a
    // concurrent webhook delivery already issued the invoice between our
    // findExistingInvoice check and this insert. Treat as already processed and
    // ack with 200 so Stripe does not retry.
    if (err instanceof DuplicateInvoiceError) {
      console.log('[stripe/webhook] invoice already exists (unique violation), skipping:', appointmentId)
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }
    throw err
  }

  // --- 7. Move the appointment from pending_payment -> scheduled ----------
  // createInvoice sets Plačano/ID računa/Način plačila but NOT Status.
  const { error: statusErr } = await supabase
    .from('Termini')
    .update({ Status: 'scheduled' })
    .eq('id', appointmentId)

  if (statusErr) {
    // Invoice already issued; a failed status flip should not trigger a retry
    // (that would re-run createInvoice — guarded, but noisy). Log only.
    console.error('[stripe/webhook] Status->scheduled update failed:', statusErr.message)
  }

  // --- 8. Done ------------------------------------------------------------
  return NextResponse.json({ received: true })
}
