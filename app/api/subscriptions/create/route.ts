import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import {
  getPriceId,
  isValidInterval,
  isValidPlan,
  TRIAL_DAYS,
} from '@/lib/subscription-plans'

export const runtime = 'nodejs'

/**
 * Starts a subscription with a 7-day free trial via Stripe Checkout.
 *
 * Input: { plan: 'plus' | 'pro', interval: 'monthly' | 'yearly', companyId }
 *
 * A card is collected up front in Stripe's hosted Checkout, but the customer is
 * not charged until the trial ends. We return the Checkout Session URL; the
 * frontend redirects the browser there. The pos_subscriptions row is written by
 * the `checkout.session.completed` webhook — NOT here.
 */
export async function POST(req: NextRequest) {
  try {
    const { plan, interval, companyId } = await req.json()
    const hasAuthHeader = !!req.headers.get('Authorization')
    console.log('[subscriptions/create] request', { plan, interval, companyId, hasAuthHeader })

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) {
      console.error('[subscriptions/create] auth/access failed', {
        status: auth.response.status,
        companyId,
        hasAuthHeader,
      })
      return auth.response
    }

    if (!isValidPlan(plan) || !isValidInterval(interval)) {
      console.error('[subscriptions/create] invalid plan/interval', { plan, interval })
      return NextResponse.json({ error: 'Neveljaven paket ali obdobje' }, { status: 400 })
    }

    const priceId = getPriceId(plan, interval)
    const supabase = createServiceClient()

    // --- Resolve company slug (for redirect) + billing email ----------------
    const [{ data: companyData }, { data: company }] = await Promise.all([
      supabase.from('pos_company_data').select('email, company_name').eq('company_id', companyId).maybeSingle(),
      supabase.from('companies').select('owner_email, name, slug').eq('id', companyId).maybeSingle(),
    ])
    const email = companyData?.email || company?.owner_email || auth.user.email || undefined
    const slug = company?.slug

    if (!slug) {
      console.error('[subscriptions/create] company not found / missing slug', {
        companyId,
        companyRowFound: !!company,
        companyDataFound: !!companyData,
      })
      return NextResponse.json({ error: 'Podjetje ni najdeno' }, { status: 404 })
    }

    // --- Existing subscription row (for stored customer id) ----------------
    const { data: existingSub } = await supabase
      .from('pos_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status')
      .eq('company_id', companyId)
      .maybeSingle()

    // If there is already an active/trialing subscription, don't create another.
    if (
      existingSub?.stripe_subscription_id &&
      (existingSub.status === 'active' || existingSub.status === 'trialing')
    ) {
      return NextResponse.json({ error: 'Naročnina je že aktivna' }, { status: 409 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    // --- Create the Checkout Session (subscription mode, 7-day trial) -------
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Reuse the existing Stripe customer if we have one, otherwise let
      // Checkout create one from the email.
      ...(existingSub?.stripe_customer_id
        ? { customer: existingSub.stripe_customer_id }
        : { customer_email: email }),
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { companyId, plan, interval },
      },
      metadata: { companyId, plan, interval },
      success_url: `${appUrl}/${slug}/dashboard?subscription=success`,
      cancel_url: `${appUrl}/pricing?canceled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Napaka pri ustvarjanju naročnine'
    console.error('[subscriptions/create]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
