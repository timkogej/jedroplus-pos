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
      return NextResponse.json({ connected: false })
    }

    const account = await stripe.accounts.retrieve(settings.stripe_account_id)

    const chargesEnabled = account.charges_enabled ?? false
    const payoutsEnabled = account.payouts_enabled ?? false
    const onboardingComplete = account.details_submitted ?? false

    // Upsert keyed on company_id so the write succeeds even if the row is missing.
    await supabase
      .from('pos_settings')
      .upsert(
        {
          company_id: companyId,
          stripe_account_id: settings.stripe_account_id,
          stripe_charges_enabled: chargesEnabled,
          stripe_payouts_enabled: payoutsEnabled,
          stripe_onboarding_complete: onboardingComplete,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' }
      )

    return NextResponse.json({
      connected: true,
      chargesEnabled,
      payoutsEnabled,
      onboardingComplete,
      accountId: account.id,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Napaka pri preverjanju statusa'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
