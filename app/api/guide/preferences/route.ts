import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'

const TOURS = ['dashboard', 'appointments'] as const
const HIDE_HOURS = 12

type Body =
  | { companyId: string; action: 'hide' | 'dismiss' | 'show' }
  | { companyId: string; action: 'tourReset'; tour?: string }
  | { companyId: string; action: 'tourSeen'; tour: string }
  | { companyId: string; action: 'vat'; vatRegistered: boolean }

/** Saves the user's guide choices: hide/show the guide, tours seen, the VAT answer. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    const auth = await requireCompanyAccess(req, body?.companyId)
    if ('response' in auth) return auth.response

    const supabase = createServiceClient()
    const companyId = body.companyId
    const now = new Date().toISOString()
    let patch: Record<string, unknown> = {}

    switch (body.action) {
      case 'hide':
        patch = { guide_hidden_until: new Date(Date.now() + HIDE_HOURS * 3600_000).toISOString() }
        break
      case 'dismiss':
        patch = { guide_dismissed: true }
        break
      case 'show':
        patch = { guide_dismissed: false, guide_hidden_until: null }
        break
      case 'tourReset': {
        if (!body.tour) {
          patch = { tour_seen: {} }
          break
        }
        const { data } = await supabase
          .from('pos_onboarding_state')
          .select('tour_seen')
          .eq('company_id', companyId)
          .maybeSingle()
        const seen = { ...((data?.tour_seen as Record<string, boolean> | null) ?? {}) }
        delete seen[body.tour]
        patch = { tour_seen: seen }
        break
      }
      case 'tourSeen': {
        if (!TOURS.includes(body.tour as (typeof TOURS)[number])) {
          return NextResponse.json({ error: 'Neznan ogled' }, { status: 400 })
        }
        const { data } = await supabase
          .from('pos_onboarding_state')
          .select('tour_seen')
          .eq('company_id', companyId)
          .maybeSingle()
        patch = { tour_seen: { ...((data?.tour_seen as Record<string, boolean> | null) ?? {}), [body.tour]: true } }
        break
      }
      case 'vat': {
        if (typeof body.vatRegistered !== 'boolean') {
          return NextResponse.json({ error: 'Neveljaven odgovor' }, { status: 400 })
        }
        const { error } = await supabase
          .from('pos_settings')
          .upsert({ company_id: companyId, is_vat_registered: body.vatRegistered, updated_at: now }, { onConflict: 'company_id' })
        if (error) throw new Error(error.message)
        patch = { vat_confirmed: true }
        break
      }
      default:
        return NextResponse.json({ error: 'Neznano dejanje' }, { status: 400 })
    }

    const { error } = await supabase
      .from('pos_onboarding_state')
      .upsert({ company_id: companyId, ...patch, updated_at: now }, { onConflict: 'company_id' })
    if (error) {
      // The VAT answer itself is already saved in pos_settings; a missing guide table
      // (migration 030 not run yet) must not block onboarding.
      if (body.action === 'vat') console.error('[guide/preferences] state not saved (migration 030?):', error.message)
      else throw new Error(error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[guide/preferences] error:', err)
    return NextResponse.json({ error: 'Napaka strežnika. Poskusite znova.' }, { status: 500 })
  }
}
