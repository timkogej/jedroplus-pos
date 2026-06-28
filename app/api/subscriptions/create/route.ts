import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
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
 * Starts a subscription with a 7-day free trial.
 *
 * Input: { plan: 'plus' | 'pro', interval: 'monthly' | 'yearly', companyId }
 *
 * The subscription is created with a trial, so no payment is taken up front.
 * We use payment_behavior: 'default_incomplete' + a pending SetupIntent so the
 * customer can attach a card during/after the trial; the SetupIntent's client
 * secret is returned for an optional in-app card form.
 */
export async function POST(req: NextRequest) {
  try {
    const { plan, interval, companyId } = await req.json()

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    if (!isValidPlan(plan) || !isValidInterval(interval)) {
      return NextResponse.json({ error: 'Neveljaven paket ali obdobje' }, { status: 400 })
    }

    const priceId = getPriceId(plan, interval)
    const supabase = createServiceClient()

    // --- Resolve a billing email for the Stripe customer -------------------
    const [{ data: companyData }, { data: company }] = await Promise.all([
      supabase.from('pos_company_data').select('email, company_name').eq('company_id', companyId).maybeSingle(),
      supabase.from('companies').select('owner_email, name').eq('id', companyId).maybeSingle(),
    ])
    const email = companyData?.email || company?.owner_email || auth.user.email || undefined
    const name = companyData?.company_name || company?.name || undefined

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
      return NextResponse.json(
        { error: 'Naročnina je že aktivna' },
        { status: 409 }
      )
    }

    // --- Create or retrieve the Stripe customer ----------------------------
    let customerId = existingSub?.stripe_customer_id ?? null
    if (!customerId && email) {
      const found = await stripe.customers.list({ email, limit: 1 })
      customerId = found.data[0]?.id ?? null
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { companyId },
      })
      customerId = customer.id
    }

    // --- Create the subscription with a 7-day trial ------------------------
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: TRIAL_DAYS,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      metadata: { companyId, plan, interval },
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
    })

    const trialEndsAt = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // --- Persist (UPSERT so retries don't duplicate) -----------------------
    const { error: upsertErr } = await supabase.from('pos_subscriptions').upsert(
      {
        company_id: companyId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        plan,
        billing_interval: interval,
        status: 'trialing',
        trial_ends_at: trialEndsAt,
        canceled_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id' }
    )

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    // --- Client secret for optional card collection ------------------------
    const setupIntent = subscription.pending_setup_intent as Stripe.SetupIntent | null
    const invoice = subscription.latest_invoice as Stripe.Invoice | null
    const paymentIntent =
      invoice && typeof invoice !== 'string'
        ? ((invoice as unknown as { payment_intent?: Stripe.PaymentIntent }).payment_intent ?? null)
        : null
    const clientSecret = setupIntent?.client_secret ?? paymentIntent?.client_secret ?? null

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret,
      trialEndsAt,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Napaka pri ustvarjanju naročnine'
    console.error('[subscriptions/create]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
