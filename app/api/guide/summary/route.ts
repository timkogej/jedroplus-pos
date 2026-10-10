import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { loadGuideData } from '@/lib/guide/facts'

/** Progress of the setup guide for the sidebar, the dashboard card and the tours. */
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get('company_id') ?? ''
    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    const { summary, state, environment } = await loadGuideData(createServiceClient(), companyId)
    return NextResponse.json({
      steps: summary.steps,
      done: summary.done,
      total: summary.total,
      nextId: summary.nextId,
      complete: summary.complete,
      environment,
      hiddenUntil: state.guideHiddenUntil,
      dismissed: state.guideDismissed,
      tourSeen: state.tourSeen,
      activationRequestedAt: state.activationRequestedAt,
    })
  } catch (err) {
    console.error('[guide/summary] error:', err)
    return NextResponse.json({ error: 'Napaka strežnika. Poskusite znova.' }, { status: 500 })
  }
}
