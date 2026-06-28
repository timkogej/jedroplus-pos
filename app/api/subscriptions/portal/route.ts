import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'

export const runtime = 'nodejs'

/**
 * Opens a Stripe billing portal session so the customer can manage their
 * subscription (update card, change plan, cancel).
 * Input: { companyId, returnSlug? }
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId, returnSlug } = await req.json()

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    const supabase = createServiceClient()
    const { data: sub } = await supabase
      .from('pos_subscriptions')
      .select('stripe_customer_id')
      .eq('company_id', companyId)
      .maybeSingle()

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ error: 'Naročnina ne obstaja' }, { status: 404 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
    const returnUrl = returnSlug
      ? `${appUrl}/${returnSlug}/settings/subscription`
      : `${appUrl}`

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: returnUrl,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Napaka pri odpiranju portala'
    console.error('[subscriptions/portal]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
