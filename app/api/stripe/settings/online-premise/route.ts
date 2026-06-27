import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'

// Saves which premise/device a company uses for online (Stripe) booking invoices.
export async function POST(req: NextRequest) {
  try {
    const { companyId, onlinePremiseId, onlineDeviceId } = await req.json()

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('pos_settings')
      .upsert(
        {
          company_id: companyId,
          online_premise_id: onlinePremiseId || null,
          online_device_id: onlineDeviceId || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Napaka pri shranjevanju nastavitev'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
