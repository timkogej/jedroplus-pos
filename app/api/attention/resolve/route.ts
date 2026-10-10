import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { createServiceClient } from '@/lib/supabase'
import { assertUuid, ValidationError } from '@/lib/validation'

/** Marks a dashboard attention item as handled. */
export async function POST(req: NextRequest) {
  try {
    const { companyId, id } = await req.json().catch(() => ({}))
    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response
    assertUuid(id, 'opozorilo')

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('pos_attention_items')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('resolved_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Napaka strežnika. Poskusite znova.' }, { status: 500 })
  }
}
