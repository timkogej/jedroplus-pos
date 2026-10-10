import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { encrypt } from '@/lib/crypto'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { parseP12 } from '@/lib/furs/certificate'
import { revalidateTag } from 'next/cache'

// A .p12 is a few KB; refuse anything big before reading it into memory.
const MAX_P12_BYTES = 256 * 1024

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const password = formData.get('password') as string
    const companyId = formData.get('company_id') as string

    if (!file || !password || !companyId) {
      return NextResponse.json({ error: 'Manjkajo podatki' }, { status: 400 })
    }

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    if (typeof file.size !== 'number' || file.size > MAX_P12_BYTES) {
      return NextResponse.json({ error: 'Datoteka je prevelika za certifikat (.p12)' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const p12Buffer = Buffer.from(arrayBuffer)
    const p12Base64 = p12Buffer.toString('base64')

    // Validate and parse certificate (also verifies the private key exists)
    let certInfo
    try {
      certInfo = parseP12(p12Base64, password)
    } catch {
      return NextResponse.json({ error: 'Neveljaven certifikat ali napačno geslo' }, { status: 400 })
    }

    if (certInfo.isExpired) {
      return NextResponse.json(
        { error: `Certifikat je potekel ${certInfo.validTo.toLocaleDateString('sl-SI')}` },
        { status: 400 }
      )
    }

    const taxNumber = certInfo.taxNumber
    const validFrom = certInfo.validFrom
    const validTo = certInfo.validTo

    const supabase = createServiceClient()

    // Store the new certificate FIRST (inactive). Only once that succeeded do we
    // switch over — otherwise a failed insert would leave the company with no
    // active certificate and unable to issue invoices.
    const { data, error } = await supabase
      .from('pos_certificates')
      .insert({
        company_id: companyId,
        certificate_data: encrypt(p12Base64),
        certificate_password: encrypt(password),
        tax_number: taxNumber,
        valid_from: validFrom?.toISOString(),
        valid_to: validTo?.toISOString(),
        is_active: false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase
      .from('pos_certificates')
      .update({ is_active: false })
      .eq('company_id', companyId)
      .neq('id', data.id)

    const { error: activateErr } = await supabase
      .from('pos_certificates')
      .update({ is_active: true })
      .eq('id', data.id)
    if (activateErr) return NextResponse.json({ error: activateErr.message }, { status: 500 })

    revalidateTag('furs-status') // the sidebar indicator caches the FURS status for 5 min
    return NextResponse.json({
      id: data.id,
      tax_number: taxNumber,
      valid_from: validFrom?.toISOString(),
      valid_to: validTo?.toISOString(),
      is_expiring_soon: certInfo.isExpiringSoon,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Napaka strežnika. Poskusite znova.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
