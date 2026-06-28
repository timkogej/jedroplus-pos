import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'

export const runtime = 'nodejs'

/**
 * Returns the company's current subscription state.
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
      .select(
        'plan, billing_interval, status, trial_ends_at, current_period_end, canceled_at'
      )
      .eq('company_id', companyId)
      .maybeSingle()

    if (!sub) {
      return NextResponse.json({ subscribed: false, status: null })
    }

    return NextResponse.json({
      subscribed: sub.status === 'trialing' || sub.status === 'active' || sub.status === 'past_due',
      plan: sub.plan,
      billingInterval: sub.billing_interval,
      status: sub.status,
      trialEndsAt: sub.trial_ends_at,
      currentPeriodEnd: sub.current_period_end,
      canceledAt: sub.canceled_at,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Napaka pri preverjanju naročnine'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
