import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json()

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    const supabase = createServiceClient()

    const { data: settings } = await supabase
      .from('pos_settings')
      .select('stripe_account_id')
      .eq('company_id', companyId)
      .maybeSingle()

    if (!settings?.stripe_account_id) {
      return NextResponse.json({ error: 'Stripe račun ni povezan' }, { status: 400 })
    }

    const loginLink = await stripe.accounts.createLoginLink(settings.stripe_account_id)

    return NextResponse.json({ url: loginLink.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Napaka pri odpiranju Stripe nadzorne plošče'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
