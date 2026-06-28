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
