import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { rateLimitDb } from '@/lib/rate-limit'
import { loadGuideData } from '@/lib/guide/facts'
import { sendActivationRequest } from '@/lib/guide/activationEmail'

/**
 * The user has finished certificate + FURS registration and asks Jedro+ to switch
 * real mode on. Saves the time (once) and e-mails the team. Switching itself is
 * done by activate_company() in the database — never from here.
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId } = (await req.json()) as { companyId?: string }
    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    if (!(await rateLimitDb(`guide:activation:${companyId}`, 3, 60 * 60_000))) {
      return NextResponse.json({ error: 'Zahteva je že poslana. Počakajte nekaj časa.' }, { status: 429 })
    }

    const supabase = createServiceClient()
    const { summary, state } = await loadGuideData(supabase, companyId!)
    if (summary.steps.find((s) => s.id === 'activation')?.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Najprej naložite certifikat in registrirajte poslovni prostor pri FURS.' },
        { status: 400 }
      )
    }
    if (state.activationRequestedAt) {
      return NextResponse.json({ ok: true, alreadyRequested: true })
    }

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('pos_onboarding_state')
      .upsert({ company_id: companyId, activation_requested_at: now, updated_at: now }, { onConflict: 'company_id' })
    if (error) throw new Error(error.message)

    const [{ data: company }, { data: companyData }] = await Promise.all([
      supabase.from('companies').select('name, slug').eq('id', companyId).maybeSingle(),
      supabase.from('pos_company_data').select('company_name, email').eq('company_id', companyId).maybeSingle(),
    ])
    const emailSent = await sendActivationRequest({
      companyName: companyData?.company_name ?? company?.name ?? 'Neznano podjetje',
      slug: company?.slug ?? '',
      companyEmail: (companyData?.email as string | null) ?? null,
    })

    return NextResponse.json({ ok: true, emailSent })
  } catch (err) {
    console.error('[guide/request-activation] error:', err)
    return NextResponse.json({ error: 'Napaka strežnika. Poskusite znova.' }, { status: 500 })
  }
}
