import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import {
  getPriceId,
  isValidInterval,
  isValidPlan,
} from '@/lib/subscription-plans'

export const runtime = 'nodejs'

/**
 * Starts a subscription via Stripe Checkout.
 *
 * Input: { plan: 'plus' | 'pro', interval: 'monthly' | 'yearly' }
 *
 * The companyId is NOT taken from the request body — it is derived from the
 * authenticated user's profiles.default_company_id. This avoids "company not
 * found" errors when the client hasn't resolved/sent a companyId yet, and is
 * also safer (a user can only ever subscribe their own company).
 *
 * No free trial: a FURS certificate is required before real invoices can be
 * issued anyway, so the customer is charged immediately at checkout. We
 * return the Checkout Session URL; the frontend redirects the browser there.
 * The pos_subscriptions row is written by the `checkout.session.completed`
 * webhook — NOT here.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient()

    const authHeader = req.headers.get('Authorization')
    console.log('1. Auth header present:', !!authHeader)

    const token = authHeader?.replace('Bearer ', '')
    console.log('2. Token present:', !!token)

    const { data: { user }, error: authError } = await supabase.auth.getUser(token || '')
    console.log('3. User:', user?.id, 'Auth error:', authError?.message)

    if (!user) {
      return NextResponse.json({ error: 'No user found' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('default_company_id')
      .eq('id', user.id)
      .single()
    console.log('4. Profile:', profile, 'Profile error:', profileError?.message)

    if (!profile?.default_company_id) {
      return NextResponse.json({ error: 'No company in profile' }, { status: 404 })
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, slug')
      .eq('id', profile.default_company_id)
      .single()
    console.log('5. Company:', company, 'Company error:', companyError?.message)

    // ---------------------------------------------------------------------
    const { plan, interval } = await req.json()
    console.log('[subscriptions/create] request', { plan, interval })

    if (!isValidPlan(plan) || !isValidInterval(interval)) {
      console.error('[subscriptions/create] invalid plan/interval', { plan, interval })
      return NextResponse.json({ error: 'Neveljaven paket ali obdobje' }, { status: 400 })
    }

    const priceId = getPriceId(plan, interval)
    const companyId = profile.default_company_id as string

    // --- Resolve billing email (slug already fetched above) ----------------
    const { data: companyData } = await supabase
      .from('pos_company_data')
      .select('email, company_name')
      .eq('company_id', companyId)
      .maybeSingle()
    const email = companyData?.email || user.email || undefined
    const slug = company?.slug

    if (!slug) {
      console.error('[subscriptions/create] company not found / missing slug', {
        companyId,
        companyRowFound: !!company,
        companyError: companyError?.message,
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

    // --- Create the Checkout Session (subscription mode, no trial) ---------
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Reuse the existing Stripe customer if we have one, otherwise let
      // Checkout create one from the email.
      ...(existingSub?.stripe_customer_id
        ? { customer: existingSub.stripe_customer_id }
        : { customer_email: email }),
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
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
