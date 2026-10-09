import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { registerBusinessPremise, getFursEnvironment } from '@/lib/furs/api'
import { FursError } from '@/lib/furs/types'
import { buildPremiseSubmission, type PremiseRow } from '@/lib/furs/premise'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'

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

    if (!premise) {
      return NextResponse.json({ error: 'Poslovni prostor ni najden' }, { status: 404 })
    }
    if (premise.furs_closed) {
      return NextResponse.json({ error: 'Prostor je pri FURS trajno zaprt' }, { status: 400 })
    }

    const submission = buildPremiseSubmission(
      premise as PremiseRow,
      await getFursEnvironment(companyId)
    )
    if (!submission.ok) {
      return NextResponse.json({ error: submission.error }, { status: 400 })
    }

    try {
      await registerBusinessPremise(companyId, premise.premise_id, submission.address, submission.cadastralData)
    } catch (err) {
      const message = err instanceof FursError ? err.message : 'Napaka pri registraciji pri FURS'
      return NextResponse.json({ error: message }, { status: 502 })
    }

    await supabase
      .from('pos_premises')
      .update({ furs_registered: true, furs_registered_at: new Date().toISOString() })
      .eq('id', premiseId)

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
