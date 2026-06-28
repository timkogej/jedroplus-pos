import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'

export const runtime = 'nodejs'

/**
 * Cancels the company's subscription at the end of the current period.
 * Input: { companyId }
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json()

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    const supabase = createServiceClient()
    const { data: sub } = await supabase
      .from('pos_subscriptions')
      .select('stripe_subscription_id')
      .eq('company_id', companyId)
      .maybeSingle()

    if (!sub?.stripe_subscription_id) {
      return NextResponse.json({ error: 'Naročnina ne obstaja' }, { status: 404 })
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // Cancellation is scheduled, not immediate: the company keeps access until
    // the end of the paid period. We only stamp canceled_at here and leave
    // status as-is ('active'). Stripe's customer.subscription.deleted event will
    // flip status -> 'canceled' once the period actually ends.
    const { error } = await supabase
      .from('pos_subscriptions')
      .update({
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Napaka pri preklicu naročnine'
    console.error('[subscriptions/cancel]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
