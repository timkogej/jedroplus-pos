import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// The booking frontend lives on a different domain and calls this endpoint
// directly from the browser, so we need CORS. Allow the configured booking
// origin (env) plus localhost for dev.
function resolveAllowedOrigin(origin: string | null): string {
  const allowed = [
    process.env.BOOKING_ORIGIN,
    'http://localhost:3000',
    'http://localhost:5173',
  ].filter(Boolean) as string[]

  if (origin && allowed.includes(origin)) return origin
  // Fall back to the configured booking origin so a sensible value is always set.
  return process.env.BOOKING_ORIGIN ?? allowed[0] ?? '*'
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(req.headers.get('origin')),
  })
}

// Accept a caller-provided redirect URL if it is https:// (production) OR an
// http://localhost / http://127.0.0.1 URL (local dev). Everything else is
// rejected and we fall back to the default booking URL.
const isAllowedRedirectUrl = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^(https:\/\/|http:\/\/localhost(?::\d+)?(?:[/?#]|$)|http:\/\/127\.0\.0\.1(?::\d+)?(?:[/?#]|$))/i.test(
    value
  )

interface CheckoutBody {
  companySlug?: string
  appointmentId?: string | number
  amount?: number
  currency?: string
  serviceName?: string
  customerEmail?: string
  customerName?: string
  language?: string
  paymentMode?: 'full' | 'deposit'
  depositPercent?: number
  successUrl?: string
  cancelUrl?: string
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)
  const isEnglish = (lang?: string) => lang === 'en'

  // Rate limit: max 20 checkout sessions/min per IP (public, unauthenticated).
  if (!rateLimit(`stripe:checkout:${getClientIp(req)}`, 20, 60_000)) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests. / Preveč zahtev.' },
      { status: 429, headers }
    )
  }

  try {
    const body = (await req.json()) as CheckoutBody
    const {
      companySlug,
      appointmentId,
      amount,
      currency = 'EUR',
      serviceName,
      customerEmail,
      language,
      paymentMode = 'full',
      depositPercent = 0,
      successUrl,
      cancelUrl,
    } = body

    const en = isEnglish(language)

    if (!companySlug || appointmentId == null || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          message: en ? 'Missing or invalid request data.' : 'Manjkajoči ali neveljavni podatki.',
        },
        { status: 400, headers }
      )
    }

    const supabase = createServiceClient()

    // 1. Resolve company.
    const { data: company } = await supabase
      .from('companies')
      .select('id, slug')
      .eq('slug', companySlug)
      .maybeSingle()

    if (!company) {
      return NextResponse.json(
        { error: 'company_not_found', message: en ? 'Company not found.' : 'Podjetje ni najdeno.' },
        { status: 404, headers }
      )
    }

    // 2. Load Stripe settings for the company.
    const { data: settings } = await supabase
      .from('pos_settings')
      .select('stripe_account_id, stripe_charges_enabled, online_premise_id, online_device_id')
      .eq('company_id', company.id)
      .maybeSingle()

    if (!settings?.stripe_account_id || !settings.stripe_charges_enabled) {
      return NextResponse.json(
        {
          error: 'stripe_not_connected',
          message: en
            ? 'This company does not accept online payments.'
            : 'To podjetje ne sprejema spletnih plačil.',
        },
        { status: 400, headers }
      )
    }

    // 3. Compute the charge amount (full or deposit), rounded to cents.
    const chargeAmount =
      paymentMode === 'deposit'
        ? Math.round(amount * (depositPercent / 100) * 100) / 100
        : amount

    if (chargeAmount <= 0) {
      return NextResponse.json(
        { error: 'invalid_amount', message: en ? 'Invalid amount.' : 'Neveljaven znesek.' },
        { status: 400, headers }
      )
    }

    const chargeAmountCents = Math.round(chargeAmount * 100)

    // 4. Platform fee: 2% of the charged amount, in cents.
    const platformFeeCents = Math.round(chargeAmountCents * 0.02)

    // 5. Resolve premise/device (configured online ids, else first active).
    let premiseId = settings.online_premise_id as string | null
    let deviceId = settings.online_device_id as string | null

    if (!premiseId || !deviceId) {
      const { data: premise } = await supabase
        .from('pos_premises')
        .select('id')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('created_at')
        .limit(1)
        .maybeSingle()

      if (!premise) {
        return NextResponse.json(
          { error: 'no_premise', message: en ? 'Premise is not configured.' : 'Poslovni prostor ni nastavljen.' },
          { status: 400, headers }
        )
      }

      const { data: device } = await supabase
        .from('pos_devices')
        .select('id')
        .eq('company_id', company.id)
        .eq('premise_id', premise.id)
        .eq('is_active', true)
        .order('created_at')
        .limit(1)
        .maybeSingle()

      if (!device) {
        return NextResponse.json(
          { error: 'no_premise', message: en ? 'Premise is not configured.' : 'Poslovni prostor ni nastavljen.' },
          { status: 400, headers }
        )
      }

      premiseId = premise.id
      deviceId = device.id
    }

    // success_url / cancel_url: prefer caller-provided URLs (https in prod, or
    // http://localhost / 127.0.0.1 in dev), else default back to the booking origin.
    const baseBookingUrl = process.env.BOOKING_ORIGIN ?? origin ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
    const successUrlFinal = isAllowedRedirectUrl(successUrl)
      ? successUrl
      : `${baseBookingUrl}/booking/success`
    const cancelUrlFinal = isAllowedRedirectUrl(cancelUrl)
      ? cancelUrl
      : `${baseBookingUrl}/booking/cancelled`

    const appointmentIdStr = String(appointmentId)

    // 6. Create the Checkout Session as a destination charge (Connect).
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: serviceName || (en ? 'Appointment booking' : 'Rezervacija termina') },
            unit_amount: chargeAmountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        transfer_data: { destination: settings.stripe_account_id },
        metadata: {
          appointmentId: appointmentIdStr,
          companyId: company.id,
          companySlug: company.slug,
          premiseId,
          deviceId,
          fullAmount: String(amount),
          chargedAmount: String(chargeAmount),
          paymentMode,
        },
      },
      customer_email: customerEmail || undefined,
      success_url: `${successUrlFinal}${successUrlFinal.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${cancelUrlFinal}${cancelUrlFinal.includes('?') ? '&' : '?'}status=cancelled`,
      locale: en ? 'en' : 'sl',
      metadata: { appointmentId: appointmentIdStr, companyId: company.id },
    })

    return NextResponse.json({ url: session.url, sessionId: session.id }, { headers })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Stripe checkout error'
    console.error('[stripe/checkout] error:', message)
    return NextResponse.json(
      { error: 'checkout_failed', message: 'Napaka pri ustvarjanju plačila. / Payment could not be created.' },
      { status: 500, headers }
    )
  }
}
