import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { registerBusinessPremise, getFursEnvironment } from '@/lib/furs/api'
import { FursError } from '@/lib/furs/types'
import { buildPremiseSubmission, type PremiseRow } from '@/lib/furs/premise'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'

/**
 * Permanently closes a business premise with FURS (ClosingTag "Z") and then
 * deactivates it and its devices here. Irreversible: afterwards no invoice can
 * be issued or submitted for that premise.
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId, premiseId } = await req.json()
    if (!companyId || !premiseId) {
      return NextResponse.json({ error: 'Manjkajo podatki' }, { status: 400 })
    }

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    const supabase = createServiceClient()
    const { data: premise } = await supabase
      .from('pos_premises')
      .select('*')
      .eq('id', premiseId)
      .eq('company_id', companyId)
      .single()
    if (!premise) return NextResponse.json({ error: 'Poslovni prostor ni najden' }, { status: 404 })
    if (premise.furs_closed) return NextResponse.json({ error: 'Prostor je že zaprt' }, { status: 400 })
    if (!premise.furs_registered) {
      return NextResponse.json(
        { error: 'Prostor pri FURS ni registriran. Zaprtje ni potrebno — samo ga izklopite.' },
        { status: 400 }
      )
    }

    // After closure FURS refuses invoices of this premise, so nothing may still be
    // waiting to be submitted, and it must not be the online-payments premise.
    const [{ count: pending }, { data: settings }] = await Promise.all([
      supabase
        .from('pos_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('premise_id', premiseId)
        .eq('status', 'pending_furs'),
      supabase.from('pos_settings').select('online_premise_id').eq('company_id', companyId).maybeSingle(),
    ])
    if ((pending ?? 0) > 0) {
      return NextResponse.json(
        { error: `Pri FURS čaka potrditev ${pending} račun(ov) tega prostora. Najprej počakajte, da se potrdijo.` },
        { status: 409 }
      )
    }
    if (settings?.online_premise_id === premiseId) {
      return NextResponse.json(
        { error: 'Ta prostor je nastavljen za spletna plačila. Najprej izberite drugega v nastavitvah plačil.' },
        { status: 409 }
      )
    }

    const submission = buildPremiseSubmission(premise as PremiseRow, await getFursEnvironment(companyId))
    if (!submission.ok) return NextResponse.json({ error: submission.error }, { status: 400 })

    try {
      await registerBusinessPremise(companyId, premise.premise_id, submission.address, submission.cadastralData, {
        closing: true,
      })
    } catch (err) {
      const message = err instanceof FursError ? err.message : 'Napaka pri zaprtju pri FURS'
      return NextResponse.json({ error: message }, { status: 502 })
    }

    const now = new Date().toISOString()
    await supabase
      .from('pos_premises')
      .update({ furs_closed: true, furs_closed_at: now, is_active: false })
      .eq('id', premiseId)
    await supabase.from('pos_devices').update({ is_active: false }).eq('premise_id', premiseId)

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
