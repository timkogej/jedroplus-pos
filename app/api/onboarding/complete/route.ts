import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { sendOnboardingEmails } from '@/lib/onboarding/email'

/**
 * Called once the user finishes onboarding step 2. Sends the welcome + FURS
 * setup emails to the company email captured in step 1. Email failures are
 * reported in the response but never block onboarding completion.
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId, slug } = (await req.json()) as { companyId?: string; slug?: string }

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    const supabase = createServiceClient()
    const { data: companyData } = await supabase
      .from('pos_company_data')
      .select('company_name, email')
      .eq('company_id', companyId)
      .maybeSingle()

    const companyEmail = companyData?.email ?? null
    if (!companyEmail) {
      // No email to send to — onboarding still counts as complete.
      return NextResponse.json({ ok: true, emailsSent: false, reason: 'no_company_email' })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    const dashboardUrl = `${appUrl}/${slug}/dashboard`

    const result = await sendOnboardingEmails({
      companyEmail,
      companyName: companyData?.company_name ?? 'Vaše podjetje',
      dashboardUrl,
    })

    return NextResponse.json({ ok: true, emailsSent: result.welcome || result.furs, ...result })
  } catch (err) {
    console.error('[onboarding/complete] error:', err)
    const message = err instanceof Error ? err.message : 'Napaka'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
