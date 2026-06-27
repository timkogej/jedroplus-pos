import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { confirmInvoiceWithFurs, generateZoiForInvoice } from '@/lib/furs/api'
import { generateInvoiceNumber } from '@/lib/invoice/generate'
import { decrypt } from '@/lib/crypto'
import { generateInvoicePdf } from '@/lib/invoice/pdf-server'
import { requireInvoiceAccess } from '@/lib/auth/apiAuth'
import type { PosInvoiceItem } from '@/types'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireInvoiceAccess(req, params.id)
    if ('response' in auth) return auth.response

    const supabase = createServiceClient()

    // Load original invoice with items
    const { data: original, error: fetchErr } = await supabase
      .from('pos_invoices')
      .select('*, pos_invoice_items(*)')
      .eq('id', params.id)
      .single()

    if (fetchErr || !original) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }

    if (original.status === 'storno_original' || original.status === 'storno') {
      return NextResponse.json({ error: 'Račun je že storniran' }, { status: 400 })
    }

    const companyId = original.company_id

    const [{ data: settings }, { data: certRow }] = await Promise.all([
      supabase
        .from('pos_settings')
        .select('invoice_prefix, invoice_format, invoice_separator, invoice_number_length, invoice_year_format, furs_environment')
        .eq('company_id', companyId)
        .single(),
      supabase
        .from('pos_certificates')
        .select('certificate_data, certificate_password, tax_number')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .single(),
    ])

    // Resolve premise + device from original invoice
    const [premiseResult, deviceResult] = await Promise.all([
      original.premise_id
        ? supabase.from('pos_premises').select('premise_id, address, city, postal_code').eq('id', original.premise_id).single()
        : Promise.resolve({ data: null }),
      original.device_id
        ? supabase.from('pos_devices').select('device_id').eq('id', original.device_id).single()
        : Promise.resolve({ data: null }),
    ])

    const premise = premiseResult.data as { premise_id: string; address: string | null; city: string | null; postal_code: string | null } | null
    const device = deviceResult.data as { device_id: string } | null

    if (!premise || !device) {
      return NextResponse.json({ error: 'Poslovni prostor ali naprava ni najdena' }, { status: 400 })
    }

    const environment = settings?.furs_environment ?? 'test'

    const formatConfig = {
      format:       settings?.invoice_format        ?? 'PREFIX-LETO4-PROSTOR-NAPRAVA-STEVILKA',
      prefix:       settings?.invoice_prefix         ?? 'R',
      separator:    settings?.invoice_separator      ?? '-',
      numberLength: settings?.invoice_number_length  ?? 5,
      yearFormat:   (settings?.invoice_year_format   ?? 'full') as 'full' | 'short',
    }

    const { invoiceNumber: stornoNumber } = await generateInvoiceNumber(
      companyId,
      formatConfig,
      premise.premise_id,
      device.device_id,
    )

    const issueDate = new Date()

    // Negative amounts for storno
    const stornoTotal     = -(original.total)
    const stornoVat       = -(original.vat_amount)
    const stornoSubtotal  = -(original.subtotal)
    const stornoDiscount  = -(original.discount_amount)

    let zoi: string
    let eor: string | null = null
    let isDemoMode = false
    let fursError: string | null = null

    if (!certRow) {
      if (environment !== 'test') {
        return NextResponse.json({ error: 'Certifikat ni naložen' }, { status: 400 })
      }
      zoi = randomBytes(16).toString('hex')
      eor = randomUUID()
      isDemoMode = true
    } else {
      const certData = decrypt(certRow.certificate_data)
      const certPassword = decrypt(certRow.certificate_password)
      const taxNumber = certRow.tax_number

      zoi = generateZoiForInvoice({
        taxNumber,
        issueDate,
        invoiceNumber: stornoNumber,
        businessPremiseId: premise.premise_id,
        electronicDeviceId: device.device_id,
        invoiceAmount: stornoTotal,
        certificateData: certData,
        certificatePassword: certPassword,
      })

      const fursResponse = await confirmInvoiceWithFurs({
        taxNumber,
        businessPremiseId: premise.premise_id,
        electronicDeviceId: device.device_id,
        invoiceNumber: stornoNumber,
        invoiceDate: issueDate.toISOString(),
        invoiceAmount: stornoTotal,
        paymentAmount: stornoTotal,
        taxPercent: original.vat_rate,
        taxAmount: stornoVat,
        zoi,
        certificate: { data: certData, password: certPassword },
        environment: environment as 'test' | 'production',
      })

      eor = fursResponse.eor
      fursError = fursResponse.error ?? null
    }

    // Create storno invoice
    const { data: stornoInvoice, error: insertErr } = await supabase
      .from('pos_invoices')
      .insert({
        company_id:       companyId,
        premise_id:       original.premise_id,
        device_id:        original.device_id,
        invoice_number:   stornoNumber,
        invoice_date:     issueDate.toISOString(),
        client_name:      original.client_name,
        client_email:     original.client_email,
        client_phone:     original.client_phone,
        client_tax_number: original.client_tax_number,
        subtotal:         stornoSubtotal,
        discount_amount:  stornoDiscount,
        discount_type:    original.discount_type,
        vat_rate:         original.vat_rate,
        vat_amount:       stornoVat,
        total:            stornoTotal,
        payment_method:   original.payment_method,
        status:           eor ? 'storno' : 'draft',
        is_storno:        true,
        storno_of:        original.id,
        zoi,
        eor,
        furs_confirmed_at: eor ? issueDate.toISOString() : null,
        furs_response:    isDemoMode ? { demo: true } : { error: fursError },
        notes:            `Storno računa ${original.invoice_number}`,
      })
      .select()
      .single()

    if (insertErr) throw new Error(insertErr.message)

    // Create storno items (negative unit_price and total, quantity stays positive)
    const originalItems = (original.pos_invoice_items ?? []) as PosInvoiceItem[]
    if (originalItems.length > 0) {
      await supabase.from('pos_invoice_items').insert(
        originalItems.map((item) => ({
          invoice_id:  stornoInvoice.id,
          description: item.description,
          quantity:    item.quantity,
          unit_price:  -(item.unit_price),
          vat_rate:    item.vat_rate,
          vat_amount:  item.vat_amount != null ? -(item.vat_amount) : null,
          total:       -(item.total),
        }))
      )
    }

    // Mark original as storno_original and link to the new storno invoice
    await supabase
      .from('pos_invoices')
      .update({ status: 'storno_original', storno_invoice_id: stornoInvoice.id })
      .eq('id', original.id)

    // Generate storno PDF
    let pdfUrl: string | null = null
    try {
      const [{ data: companyData }, { data: companyInvoiceData }] = await Promise.all([
        supabase.from('companies').select('name, company_id').eq('id', companyId).single(),
        supabase.from('pos_company_data').select('*').eq('company_id', companyId).maybeSingle(),
      ])

      let brandPrimary = '#6D5EF7'
      if (companyData?.company_id) {
        const { data: branding } = await supabase
          .from('Podatki podjetij')
          .select('brand_primary')
          .eq('ID Podjetja', companyData.company_id)
          .maybeSingle()
        if (branding?.brand_primary) brandPrimary = branding.brand_primary
      }

      const companyAddress = [
        premise?.address,
        premise?.postal_code && premise?.city
          ? `${premise.postal_code} ${premise.city}`
          : premise?.city ?? null,
      ].filter(Boolean).join(', ')

      const itemsForPdf: PosInvoiceItem[] = originalItems.map((item, idx) => ({
        id: `storno-${idx}`,
        invoice_id: stornoInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: -(item.unit_price),
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount != null ? -(item.vat_amount) : null,
        total: -(item.total),
        created_at: stornoInvoice.created_at,
      }))

      const pdfBuffer = await generateInvoicePdf({
        invoice: stornoInvoice,
        items: itemsForPdf,
        companyName: companyData?.name ?? '',
        companyData: companyInvoiceData ?? null,
        companyAddress: companyAddress || undefined,
        taxNumber: certRow?.tax_number ?? undefined,
        brandPrimary,
        isTestMode: isDemoMode || environment === 'test',
        isStorno: true,
        stornoOf: original.invoice_number,
        premiseCode: premise.premise_id,
        deviceCode: device.device_id,
      })

      const storageKey = `${companyId}/${stornoNumber}.pdf`
      const { error: uploadErr } = await supabase.storage
        .from('invoices')
        .upload(storageKey, pdfBuffer, { contentType: 'application/pdf', upsert: true })

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(storageKey)
        if (urlData?.publicUrl) {
          pdfUrl = urlData.publicUrl
          await supabase.from('pos_invoices').update({ pdf_url: pdfUrl }).eq('id', stornoInvoice.id)
        }
      }
    } catch (pdfErr) {
      console.error('[storno] PDF generation failed (non-blocking):', pdfErr)
    }

    return NextResponse.json({
      stornoInvoiceId: stornoInvoice.id,
      stornoNumber,
      zoi,
      eor,
      isDemoMode,
      pdfUrl,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
