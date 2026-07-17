import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { registerBusinessPremise } from '@/lib/furs/api'
import { FursError } from '@/lib/furs/types'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'

export async function POST(req: NextRequest) {
  try {
    const { companyId, premiseId } = await req.json()
    if (!companyId || !premiseId) {
      return NextResponse.json({ error: 'Manjkajo podatki' }, { status: 400 })
    }

    console.log(
      `[furs] register-premise: auth header ${req.headers.has('Authorization') ? 'prisoten' : 'MANJKA'}, premiseId=${premiseId}`
    )
    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    const supabase = createServiceClient()
    const { data: premise } = await supabase
      .from('pos_premises')
      .select('id, premise_id, premise_type, address, house_number, house_number_additional, city, postal_code')
      .eq('id', premiseId)
      .eq('company_id', companyId)
      .single()

    if (!premise) {
      return NextResponse.json({ error: 'Poslovni prostor ni najden' }, { status: 404 })
    }

    let address: import('@/lib/furs/xml').FursPremiseAddress | undefined
    if (premise.premise_type !== 'movable') {
      let street = premise.address ?? ''
      let houseNumber = premise.house_number ?? ''
      let houseNumberAdditional = premise.house_number_additional ?? undefined

      // Legacy rows store the whole address in one string ("Prešernova cesta 21A")
      if (!houseNumber) {
        const match = street.match(/^(.+?)\s+(\d+)([A-Za-z]?)\s*$/)
        if (match) {
          street = match[1]
          houseNumber = match[2]
          houseNumberAdditional = match[3] || undefined
        }
      }

      if (!street || !houseNumber || !premise.city || !premise.postal_code) {
        return NextResponse.json(
          { error: 'Za registracijo pri FURS prostor potrebuje ulico, hišno številko, mesto in poštno številko' },
          { status: 400 }
        )
      }

      address = {
        street,
        houseNumber,
        houseNumberAdditional,
        community: premise.city, // naselje ni ločeno shranjen — FURS zahteva vrednost
        city: premise.city,
        postalCode: premise.postal_code,
      }
    }

    try {
      await registerBusinessPremise(companyId, premise.premise_id, address)
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
