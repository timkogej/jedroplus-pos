import { NextRequest, NextResponse } from 'next/server'
import { pdfStorageKey } from '@/lib/invoice/storage'
import { randomBytes, randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { confirmInvoiceWithFurs } from '@/lib/furs/api'
import { buildFursTaxes, singleFursTax } from '@/lib/furs/taxes'
import { ljDateString } from '@/lib/time'
import { formatDateForZoi } from '@/lib/furs/zoi'
import { FursError, type FursInvoiceRequest } from '@/lib/furs/types'
import { generateInvoiceNumber } from '@/lib/invoice/generate'
import { generateInvoicePdf } from '@/lib/invoice/pdf-server'
import { requireInvoiceAccess } from '@/lib/auth/apiAuth'
import { reversePointsForStorno } from '@/lib/loyalty/award'
import type { PosInvoiceItem } from '@/types'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Set once this request has claimed the original ('storno_pending'); the
  // catch block / early exits hand it back so a failure never leaves the
  // original stuck.
  let claimedStatus: string | null = null
  const supabase = createServiceClient()
  const releaseClaim = async () => {
    if (!claimedStatus) return
    await supabase
      .from('pos_invoices')
      .update({ status: claimedStatus })
      .eq('id', params.id)
      .eq('status', 'storno_pending')
    claimedStatus = null
  }

  try {
    const auth = await requireInvoiceAccess(req, params.id)
    if ('response' in auth) return auth.response

    // Load original invoice with items
    const { data: original, error: fetchErr } = await supabase
      .from('pos_invoices')
      .select('*, pos_invoice_items(*)')
      .eq('id', params.id)
      .single()

    if (fetchErr || !original) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }

    if (!['issued', 'pending_furs', 'furs_failed'].includes(original.status)) {
      return NextResponse.json(
        { error: original.status === 'storno_pending' ? 'Storno se že izvaja' : 'Račun je že storniran ali ga ni mogoče stornirati' },
        { status: 400 }
      )
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
        .select('tax_number')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle(),
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

    // The storno is issued today — a day closed with a Z-report is locked.
    const issueDate = new Date()
    const { data: closedDay } = await supabase
      .from('pos_z_reports')
      .select('id')
      .eq('company_id', companyId)
      .eq('report_date', ljDateString(issueDate))
      .maybeSingle()
    if (closedDay) {
      return NextResponse.json(
        { error: 'Blagajna za današnji dan je že zaključena (Z-poročilo). Storno ni mogoč.' },
        { status: 400 }
      )
    }

    // Claim the original atomically BEFORE talking to FURS, so two concurrent
    // requests can't both send a storno to the tax authority.
    const { data: claimed } = await supabase
      .from('pos_invoices')
      .update({ status: 'storno_pending' })
      .eq('id', original.id)
      .eq('status', original.status)
      .select('id')
    if (!claimed?.length) {
      return NextResponse.json({ error: 'Storno se že izvaja ali je bil opravljen' }, { status: 409 })
    }
    claimedStatus = original.status

    const formatConfig = {
      format:       settings?.invoice_format        ?? 'PREFIX-LETO4-PROSTOR-NAPRAVA-STEVILKA',
      prefix:       settings?.invoice_prefix         ?? 'R',
      separator:    settings?.invoice_separator      ?? '-',
      numberLength: settings?.invoice_number_length  ?? 5,
      yearFormat:   (settings?.invoice_year_format   ?? 'full') as 'full' | 'short',
    }

    const { invoiceNumber: stornoNumber, counter: stornoCounter } = await generateInvoiceNumber(
      companyId,
      formatConfig,
      premise.premise_id,
      device.device_id,
    )

    // Negative amounts for storno
    const stornoTotal     = -(original.total)
    const stornoVat       = -(original.vat_amount)
    const stornoSubtotal  = -(original.subtotal)
    const stornoDiscount  = -(original.discount_amount)
    const originalItems = (original.pos_invoice_items ?? []) as PosInvoiceItem[]

    let zoi: string
    let eor: string | null = null
    let isDemoMode = false
    let fursError: string | null = null

    if (!certRow) {
      if (environment !== 'test') {
        await releaseClaim()
        return NextResponse.json({ error: 'Certifikat ni naložen' }, { status: 400 })
      }
      zoi = randomBytes(16).toString('hex')
      eor = randomUUID()
      isDemoMode = true
    } else {
      const fursRequest: FursInvoiceRequest = {
        taxNumber: certRow.tax_number,
        issueDateTime: formatDateForZoi(issueDate),
        invoiceNumber: stornoNumber,
        invoiceCounter: stornoCounter,
        businessPremiseId: premise.premise_id,
        electronicDeviceId: device.device_id,
        invoiceAmount: stornoTotal.toFixed(2),
        paymentAmount: stornoTotal.toFixed(2),
        // Per-rate breakdown from the (negated) original items so mixed-VAT
        // invoices are reversed correctly; single-rate fallback if none stored.
        taxesPerSeller: originalItems.length > 0
          ? buildFursTaxes(
              originalItems.map((i) => ({ quantity: i.quantity, unit_price: -i.unit_price, vat_rate: i.vat_rate })),
              stornoTotal
            )
          : singleFursTax(original.vat_rate, stornoVat, stornoTotal),
        referenceInvoice: {
          referenceInvoiceNumber: original.invoice_number,
          referenceInvoiceCounter: original.invoice_counter ?? undefined,
          referenceBusinessPremiseId: premise.premise_id,
          referenceElectronicDeviceId: device.device_id,
          referenceInvoiceIssueDateTime: formatDateForZoi(new Date(original.invoice_date)),
        },
      }

      try {
        const fursResponse = await confirmInvoiceWithFurs(fursRequest, companyId)
        zoi = fursResponse.zoi
        eor = fursResponse.eor
      } catch (err) {
        if (err instanceof FursError && err.zoi) {
          // Offline: real ZOI, EOR pending — the retry cron confirms it later.
          zoi = err.zoi
          fursError = `${err.code}: ${err.message}`
        } else {
          throw err
        }
      }
    }

    // Create storno invoice
    const { data: stornoInvoice, error: insertErr } = await supabase
      .from('pos_invoices')
      .insert({
        company_id:       companyId,
        premise_id:       original.premise_id,
        device_id:        original.device_id,
        invoice_number:   stornoNumber,
        invoice_counter:  stornoCounter,
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
        status:           eor ? 'storno' : 'pending_furs',
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

    // Reverse any loyalty points earned from the original invoice. Non-blocking.
    try {
      await reversePointsForStorno(supabase, {
        companyId,
        originalInvoiceId: original.id,
        originalInvoiceNumber: original.invoice_number,
      })
    } catch (loyaltyErr) {
      console.error('[storno] loyalty reversal failed (non-blocking):', loyaltyErr)
    }

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

      const storageKey = pdfStorageKey(companyId, stornoNumber)
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
    await releaseClaim().catch(() => {})
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
