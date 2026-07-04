import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { encrypt } from '@/lib/crypto'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { parseP12 } from '@/lib/furs/certificate'

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

    // Deactivate old certificates
    await supabase
      .from('pos_certificates')
      .update({ is_active: false })
      .eq('company_id', companyId)

    // Store encrypted certificate
    const { data, error } = await supabase
      .from('pos_certificates')
      .insert({
        company_id: companyId,
        certificate_data: encrypt(p12Base64),
        certificate_password: encrypt(password),
        tax_number: taxNumber,
        valid_from: validFrom?.toISOString(),
        valid_to: validTo?.toISOString(),
        is_active: true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      id: data.id,
      tax_number: taxNumber,
      valid_from: validFrom?.toISOString(),
      valid_to: validTo?.toISOString(),
      is_expiring_soon: certInfo.isExpiringSoon,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
