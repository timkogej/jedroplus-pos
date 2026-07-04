import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { confirmInvoiceWithFurs } from '@/lib/furs/api'
import { singleFursTax } from '@/lib/furs/taxes'
import { formatDateForZoi } from '@/lib/furs/zoi'
import { FursError, type FursInvoiceRequest } from '@/lib/furs/types'
import { generateInvoiceNumber } from '@/lib/invoice/generate'
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
      .select('tax_number')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle()

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

    const fursRequest: FursInvoiceRequest = {
      taxNumber: certRow.tax_number,
      issueDateTime: formatDateForZoi(issueDate),
      invoiceNumber,
      businessPremiseId: premise.premise_id,
      electronicDeviceId: device.device_id,
      invoiceAmount: Number(invoiceData.total).toFixed(2),
      paymentAmount: Number(invoiceData.total).toFixed(2),
      taxesPerSeller: singleFursTax(invoiceData.vat_rate, invoiceData.vat_amount, invoiceData.total),
    }

    try {
      const fursResponse = await confirmInvoiceWithFurs(fursRequest, companyId)
      return NextResponse.json({
        invoiceNumber,
        zoi: fursResponse.zoi,
        eor: fursResponse.eor,
        fursError: null,
        fursConfirmed: true,
        isDemoMode: false,
        issueDate: issueDate.toISOString(),
      })
    } catch (err) {
      if (err instanceof FursError && err.zoi) {
        // Offline mode: real ZOI, EOR pending (retry cron will confirm later).
        return NextResponse.json({
          invoiceNumber,
          zoi: err.zoi,
          eor: null,
          fursError: `${err.code}: ${err.message}`,
          fursConfirmed: false,
          isDemoMode: false,
          issueDate: issueDate.toISOString(),
        })
      }
      throw err
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
