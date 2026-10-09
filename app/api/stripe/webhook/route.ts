import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import {
  createInvoice,
  findExistingInvoice,
  DuplicateInvoiceError,
  InvoiceValidationError,
} from '@/lib/invoice/create-invoice'
import { computeInvoiceTotals } from '@/lib/invoice/totals'
import { raiseAttention } from '@/lib/attention'

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

      // Subscription Checkout (the /pricing signup flow) lands here too, but
      // in `subscription` mode, so it's handled separately from booking payments.
      if (session.mode === 'subscription') {
        await handleSubscriptionCheckout(session)
        return NextResponse.json({ received: true })
      }

      // --- Booking payments (one-off, mode 'payment') ----------------------
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

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge)
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

// Subscription Checkout completed → create/refresh the pos_subscriptions row.
// This is the source of truth for the /pricing signup flow. There is no free
// trial — a FURS certificate is required before real invoices can be issued
// anyway — so the customer is charged at checkout and the row is written as
// 'active' directly. Later lifecycle events (created/updated/invoice paid)
// keep status and billing periods in sync.
async function handleSubscriptionCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const companyId = session.metadata?.companyId
  const plan = session.metadata?.plan
  const interval = session.metadata?.interval

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? null

  if (!companyId || !subscriptionId) {
    console.error('[stripe/webhook] subscription checkout missing companyId/subscriptionId', {
      companyId,
      subscriptionId,
    })
    return
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('pos_subscriptions').upsert(
    {
      company_id: companyId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan,
      billing_interval: interval,
      status: 'active',
      trial_ends_at: null,
      canceled_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' }
  )

  if (error) {
    console.error('[stripe/webhook] subscription checkout upsert failed:', error.message)
    throw new Error(error.message)
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

  // The invoice must equal what the customer actually paid (chargedAmount, set
  // by the checkout route from Termini.payment_amount). For a deposit that is
  // the deposit. For a full payment it can exceed the service price when an
  // add-on was booked — the difference becomes its own line instead of being
  // silently dropped from the fiscal invoice.
  const description = (termin['Storitev'] as string) || 'Storitev'
  const paid = Number(chargedAmount ?? 0)

  let items: Array<{ description: string; quantity: number; unit_price: number; vat_rate: number }>
  if (paid > 0 && !isDeposit && paid > finalPrice + 0.005 && finalPrice > 0) {
    items = [
      { description, quantity: 1, unit_price: finalPrice, vat_rate: vatRate },
      { description: 'Dodatek', quantity: 1, unit_price: Math.round((paid - finalPrice) * 100) / 100, vat_rate: vatRate },
    ]
  } else {
    items = [
      { description, quantity: 1, unit_price: paid > 0 ? paid : finalPrice, vat_rate: vatRate },
    ]
  }

  // Amounts (VAT is included in the gross price). The charged price already
  // reflects any discount, so no discount is applied again here.
  const totals = computeInvoiceTotals(items, 0, 0)
  const subtotal = totals.subtotal
  const total = totals.total
  const vatAmount = totals.vatAmount

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
    // A business rule blocked the invoice (e.g. the day is already closed with a
    // Z-report, missing certificate/premise). Retrying can never succeed and the
    // customer HAS paid — ack Stripe so it stops retrying, and put it in front of
    // a human on the dashboard instead of looping forever.
    if (err instanceof InvoiceValidationError) {
      console.error('[stripe/webhook] invoice blocked for paid appointment', appointmentId, err.message)
      await raiseAttention(supabase, {
        companyId,
        kind: 'online_invoice_failed',
        reference: stripePaymentIntentId ?? `appointment:${appointmentId}`,
        message: `Spletno plačilo (${total.toFixed(2)} ${currency}) je prejeto, računa pa ni bilo mogoče izdati: ${err.message}`,
        details: { appointmentId, stripePaymentIntentId, total },
      })
      return NextResponse.json({ received: true, needsAttention: true })
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

// A Stripe refund does NOT automatically cancel the fiscal invoice — a storno
// must be issued with FURS. That needs a person (amount, reason), so we flag it
// on the dashboard rather than issuing one blindly.
async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const piId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id ?? null
  if (!piId) return

  const supabase = createServiceClient()
  const { data: invoice } = await supabase
    .from('pos_invoices')
    .select('id, company_id, invoice_number, status')
    .eq('stripe_payment_intent_id', piId)
    .neq('status', 'storno')
    .maybeSingle()

  let companyId = invoice?.company_id as string | undefined
  if (!companyId) {
    const pi = await stripe.paymentIntents.retrieve(piId)
    companyId = pi.metadata?.companyId
  }
  if (!companyId) {
    console.error('[stripe/webhook] charge.refunded without resolvable company, pi:', piId)
    return
  }

  const refunded = (charge.amount_refunded / 100).toFixed(2)
  const full = charge.amount_refunded >= charge.amount
  const currency = charge.currency.toUpperCase()

  await raiseAttention(supabase, {
    companyId,
    kind: 'refund_needs_storno',
    reference: `${charge.id}:${charge.amount_refunded}`,
    invoiceId: invoice?.id ?? null,
    message: invoice
      ? `Stripe vračilo ${refunded} ${currency} (${full ? 'polno' : 'delno'}) za račun ${invoice.invoice_number}. Izdajte storno račun.`
      : `Stripe vračilo ${refunded} ${currency} za plačilo ${piId}, računa ni mogoče najti.`,
    details: { chargeId: charge.id, paymentIntent: piId, amountRefunded: charge.amount_refunded, full },
  })
}
