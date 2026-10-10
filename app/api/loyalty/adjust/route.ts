import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { createServiceClient } from '@/lib/supabase'
import { getLoyaltySettings } from '@/lib/loyalty/award'
import { getPointsBalance, normalizeEmail } from '@/lib/loyalty/balance'
import { resolveStrankeId } from '@/lib/loyalty/client'
import { isValidEmail } from '@/lib/validation'

const MAX_ADJUSTMENT = 100_000

/**
 * Manual correction of a customer's points (goodwill, mistakes). Always carries
 * a reason and the staff member's email in the ledger description, so every
 * change is traceable. A deduction can never take the balance below zero.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { companyId, clientEmail, points, reason } = body as {
      companyId?: string
      clientEmail?: string
      points?: number
      reason?: string
    }

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    if (!clientEmail || !isValidEmail(clientEmail)) {
      return NextResponse.json({ error: 'Neveljaven e-poštni naslov stranke' }, { status: 400 })
    }
    const delta = Math.trunc(Number(points))
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > MAX_ADJUSTMENT) {
      return NextResponse.json({ error: 'Neveljavno število točk' }, { status: 400 })
    }
    const why = (reason ?? '').trim()
    if (why.length < 3 || why.length > 200) {
      return NextResponse.json({ error: 'Vnesite razlog popravka (3 do 200 znakov)' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const settings = await getLoyaltySettings(supabase, companyId!)
    if (!settings.loyalty_enabled) {
      return NextResponse.json({ error: 'Loyalty program ni omogočen' }, { status: 400 })
    }

    const email = normalizeEmail(clientEmail)
    const description = `Ročni popravek (${auth.user.email ?? 'osebje'}): ${why}`

    if (delta > 0) {
      const { error } = await supabase.from('pos_loyalty_points').insert({
        company_id: companyId,
        client_id: await resolveStrankeId(supabase, companyId!, email),
        client_email: email,
        type: 'adjustment',
        points: delta,
        description,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      // Atomic, refuses to go below zero.
      const { error } = await supabase.rpc('loyalty_redeem', {
        p_company: companyId,
        p_email: email,
        p_points: Math.abs(delta),
        p_invoice: null,
        p_description: description,
      })
      if (error) {
        const insufficient = /nima dovolj/i.test(error.message)
        return NextResponse.json({ error: error.message }, { status: insufficient ? 400 : 500 })
      }
    }

    const balance = await getPointsBalance(companyId!, email, supabase)
    return NextResponse.json({ ok: true, balance })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Napaka strežnika. Poskusite znova.' }, { status: 500 })
  }
}
