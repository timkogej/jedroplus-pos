import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { encrypt } from '@/lib/crypto'
import forge from 'node-forge'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const password = formData.get('password') as string
    const companyId = formData.get('company_id') as string

    if (!file || !password || !companyId) {
      return NextResponse.json({ error: 'Manjkajo podatki' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const p12Buffer = Buffer.from(arrayBuffer)
    const p12Base64 = p12Buffer.toString('base64')

    // Validate and parse certificate
    let taxNumber = ''
    let validFrom: Date | null = null
    let validTo: Date | null = null

    try {
      const p12Der = forge.util.decode64(p12Base64)
      const p12Asn1 = forge.asn1.fromDer(p12Der)
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password)

      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
      const certBag = certBags[forge.pki.oids.certBag]?.[0]

      if (certBag?.cert) {
        const cert = certBag.cert
        validFrom = cert.validity.notBefore
        validTo = cert.validity.notAfter

        // Extract tax number from subject
        const subject = cert.subject.attributes
        const serialAttr = subject.find((a: forge.pki.CertificateField) => a.name === 'serialName' || a.shortName === 'SERIALNUMBER')
        const cnAttr = subject.find((a: forge.pki.CertificateField) => a.shortName === 'CN')
        const rawValue = String(serialAttr?.value ?? cnAttr?.value ?? '')
        taxNumber = rawValue.replace(/[^0-9]/g, '')
      }
    } catch {
      return NextResponse.json({ error: 'Neveljaven certifikat ali napačno geslo' }, { status: 400 })
    }

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
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
