import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { confirmInvoiceWithFurs, generateZoiForInvoice } from '@/lib/furs/api'
import { generateInvoiceNumber } from '@/lib/invoice/generate'
import { decrypt } from '@/lib/crypto'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { companyId, premiseId, deviceId, invoiceData } = body

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    const supabase = createServiceClient()

    // Load settings and premise/device in parallel (needed in all modes)
    const [{ data: settings }, { data: premise }, { data: device }] = await Promise.all([
      supabase.from('pos_settings').select('invoice_prefix, furs_environment').eq('company_id', companyId).single(),
      supabase.from('pos_premises').select('premise_id').eq('id', premiseId).single(),
      supabase.from('pos_devices').select('device_id').eq('id', deviceId).single(),
    ])

    if (!premise || !device) {
      return NextResponse.json({ error: 'Poslovni prostor ali naprava ni najdena' }, { status: 400 })
    }

    const prefix = settings?.invoice_prefix ?? 'R'
    const environment = settings?.furs_environment ?? 'test'

    const { invoiceNumber } = await generateInvoiceNumber(companyId, prefix, premise.premise_id, device.device_id)
    const issueDate = new Date()

    // Load certificate
    const { data: certRow } = await supabase
      .from('pos_certificates')
      .select('certificate_data, certificate_password, tax_number')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single()

    // Demo mode: test environment with no certificate uploaded
    if (!certRow) {
      if (environment !== 'test') {
        return NextResponse.json({ error: 'Certifikat ni naložen' }, { status: 400 })
      }
      return NextResponse.json({
        invoiceNumber,
        zoi: randomBytes(16).toString('hex'),
        eor: randomUUID(),
        fursError: null,
        fursConfirmed: true,
        isDemoMode: true,
        issueDate: issueDate.toISOString(),
      })
    }

    const certData = decrypt(certRow.certificate_data)
    const certPassword = decrypt(certRow.certificate_password)
    const taxNumber = certRow.tax_number

    const zoi = generateZoiForInvoice({
      taxNumber,
      issueDate,
      invoiceNumber,
      businessPremiseId: premise.premise_id,
      electronicDeviceId: device.device_id,
      invoiceAmount: invoiceData.total,
      certificateData: certData,
      certificatePassword: certPassword,
    })

    const fursResponse = await confirmInvoiceWithFurs({
      taxNumber,
      businessPremiseId: premise.premise_id,
      electronicDeviceId: device.device_id,
      invoiceNumber,
      invoiceDate: issueDate.toISOString(),
      invoiceAmount: invoiceData.total,
      paymentAmount: invoiceData.total,
      taxPercent: invoiceData.vat_rate,
      taxAmount: invoiceData.vat_amount,
      zoi,
      certificate: { data: certData, password: certPassword },
      environment: environment as 'test' | 'production',
    })

    return NextResponse.json({
      invoiceNumber,
      zoi,
      eor: fursResponse.eor,
      fursError: fursResponse.error,
      fursConfirmed: !!fursResponse.eor,
      isDemoMode: false,
      issueDate: issueDate.toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
