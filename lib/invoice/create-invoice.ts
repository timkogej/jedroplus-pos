import { randomBytes, randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { confirmInvoiceWithFurs, generateZoiForInvoice } from '@/lib/furs/api'
import { generateInvoiceNumber } from '@/lib/invoice/generate'
import { decrypt } from '@/lib/crypto'
import { generateInvoicePdf } from '@/lib/invoice/pdf-server'
import { awardPointsForInvoice, getInvoiceLoyaltyDisplay } from '@/lib/loyalty/award'
import type { PosInvoiceItem } from '@/types'

export interface CreateInvoiceInput {
  companyId: string // companies.id (uuid)
  appointmentId?: string | null // Termini.id as text, optional (free-form invoices have none)
  premiseId: string // pos_premises.id
  deviceId: string // pos_devices.id
  paymentMethod: 'cash' | 'card' | 'transfer' | 'online'
  items: Array<{
    description: string
    quantity: number
    unit_price: number // gross
    vat_rate: number
  }>
  // Amounts (pre-computed by the caller, same as the existing route contract)
  subtotal: number
  vatRate: number
  vatAmount: number
  total: number
  discountType?: '%' | '€' | null
  discountAmount?: number
  buyer: {
    name?: string | null
    email?: string | null
    phone?: string | null
    taxNumber?: string | null // for legal buyers
    type?: 'physical' | 'legal'
    companyName?: string | null
    companyTax?: string | null
  }
  notes?: string | null
  currency?: string
  // Optional, for Stripe reconciliation
  stripePaymentIntentId?: string | null
  // Optional loyalty: an "Stranke" client id, and the ledger row id of a
  // redemption that was locked in via /api/loyalty/redeem before this invoice
  // existed — it gets linked to the new invoice so PDF/email can show it.
  clientId?: string | null
  loyaltyRedeemRecordId?: string | null
}

/** Validation/business error that maps to an HTTP 400 in the API route. */
export class InvoiceValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvoiceValidationError'
  }
}

/**
 * Thrown when the insert hits the unique_appointment_invoice constraint
 * (Postgres error 23505) — i.e. another invoice for this appointment already
 * exists (race between two concurrent webhook deliveries). Callers should treat
 * this as "already processed" rather than a hard failure.
 */
export class DuplicateInvoiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DuplicateInvoiceError'
  }
}

export interface CreateInvoiceResult {
  invoiceId: string
  invoiceNumber: string
  zoi: string
  eor: string | null
  isDemoMode: boolean
  pdfUrl: string | null
  total: number
}

export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const {
    companyId,
    appointmentId,
    premiseId,
    deviceId,
    paymentMethod,
    items,
    subtotal,
    vatRate,
    vatAmount,
    total,
    discountType,
    discountAmount = 0,
    buyer,
    notes,
    currency = 'EUR',
    stripePaymentIntentId,
    clientId,
    loyaltyRedeemRecordId,
  } = input

  const supabase = createServiceClient()

  const [{ data: settings }, { data: premise }, { data: device }] = await Promise.all([
    supabase
      .from('pos_settings')
      .select('invoice_prefix, invoice_format, invoice_separator, invoice_number_length, invoice_year_format, furs_environment')
      .eq('company_id', companyId)
      .single(),
    supabase.from('pos_premises').select('premise_id, address, city, postal_code').eq('id', premiseId).single(),
    supabase.from('pos_devices').select('device_id').eq('id', deviceId).single(),
  ])

  if (!premise || !device) {
    throw new InvoiceValidationError('Poslovni prostor ali naprava ni najdena')
  }

  const environment = settings?.furs_environment ?? 'test'

  const formatConfig = {
    format:       settings?.invoice_format        ?? 'PREFIX-LETO4-PROSTOR-NAPRAVA-STEVILKA',
    prefix:       settings?.invoice_prefix         ?? 'R',
    separator:    settings?.invoice_separator      ?? '-',
    numberLength: settings?.invoice_number_length  ?? 5,
    yearFormat:   (settings?.invoice_year_format   ?? 'full') as 'full' | 'short',
  }

  const { invoiceNumber } = await generateInvoiceNumber(companyId, formatConfig, premise.premise_id, device.device_id)
  const issueDate = new Date()

  // A day that's already been closed with a Z-report is locked — no new invoices
  // may be added for it (ZDavPR daily-closing integrity).
  const issueDateStr = `${issueDate.getFullYear()}-${String(issueDate.getMonth() + 1).padStart(2, '0')}-${String(issueDate.getDate()).padStart(2, '0')}`
  const { data: closedDay } = await supabase
    .from('pos_z_reports')
    .select('id')
    .eq('company_id', companyId)
    .eq('report_date', issueDateStr)
    .maybeSingle()
  if (closedDay) {
    throw new InvoiceValidationError('Blagajna za ta dan je že zaključena (Z-poročilo). Računov ni mogoče dodajati.')
  }

  const { data: certRow } = await supabase
    .from('pos_certificates')
    .select('certificate_data, certificate_password, tax_number')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .single()

  let zoi: string
  let eor: string | null = null
  let isDemoMode = false
  let fursError: string | null = null

  if (!certRow) {
    if (environment !== 'test') {
      throw new InvoiceValidationError('Certifikat ni naložen')
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
      invoiceNumber,
      businessPremiseId: premise.premise_id,
      electronicDeviceId: device.device_id,
      invoiceAmount: total,
      certificateData: certData,
      certificatePassword: certPassword,
    })

    const fursResponse = await confirmInvoiceWithFurs({
      taxNumber,
      businessPremiseId: premise.premise_id,
      electronicDeviceId: device.device_id,
      invoiceNumber,
      invoiceDate: issueDate.toISOString(),
      invoiceAmount: total,
      paymentAmount: total,
      taxPercent: vatRate,
      taxAmount: vatAmount,
      zoi,
      certificate: { data: certData, password: certPassword },
      environment: environment as 'test' | 'production',
    })

    eor = fursResponse.eor
    fursError = fursResponse.error ?? null
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('pos_invoices')
    .insert({
      company_id: companyId,
      appointment_id: appointmentId ?? null,
      premise_id: premiseId,
      device_id: deviceId,
      invoice_number: invoiceNumber,
      invoice_date: issueDate.toISOString(),
      client_name: buyer.name || null,
      client_email: buyer.email || null,
      client_phone: buyer.phone || null,
      client_tax_number: buyer.taxNumber || null,
      subtotal,
      discount_amount: discountAmount,
      discount_type: discountAmount > 0 ? discountType : null,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total,
      payment_method: paymentMethod,
      status: eor ? 'issued' : 'draft',
      zoi,
      eor,
      furs_confirmed_at: eor ? issueDate.toISOString() : null,
      furs_response: isDemoMode ? { demo: true } : { error: fursError },
      notes: notes || null,
      stripe_payment_intent_id: stripePaymentIntentId ?? null,
    })
    .select()
    .single()

  if (invoiceError) {
    // 23505 = unique_violation. Means unique_appointment_invoice already has an
    // invoice for this appointment (concurrent webhook delivery beat us to it).
    if ((invoiceError as { code?: string }).code === '23505') {
      throw new DuplicateInvoiceError(invoiceError.message)
    }
    throw new Error(invoiceError.message)
  }

  await supabase.from('pos_invoice_items').insert(
    items.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      vat_amount: (item.quantity * item.unit_price) * (item.vat_rate / (100 + item.vat_rate)),
      total: item.quantity * item.unit_price,
    }))
  )

  if (appointmentId) {
    const { error: terminiError } = await supabase
      .from('Termini')
      .update({
        'Plačano': true,
        'ID računa': invoice.id,
        'Način plačila': paymentMethod,
      })
      .eq('id', appointmentId)

    if (terminiError) {
      console.error('[createInvoice] Termini update failed:', terminiError)
    }
  }

  // Loyalty: link any pre-locked redemption to this invoice, then award earned
  // points. Non-blocking — never let loyalty bookkeeping fail invoice issuance.
  try {
    if (loyaltyRedeemRecordId) {
      await supabase
        .from('pos_loyalty_points')
        .update({ invoice_id: invoice.id, description: `Unovceno pri racunu ${invoiceNumber}` })
        .eq('id', loyaltyRedeemRecordId)
        .eq('company_id', companyId)
        .is('invoice_id', null)
    }
    await awardPointsForInvoice(supabase, {
      companyId,
      clientEmail: buyer.email,
      clientId,
      invoiceId: invoice.id,
      invoiceNumber,
      total,
    })
  } catch (loyaltyErr) {
    console.error('[createInvoice] loyalty bookkeeping failed (non-blocking):', loyaltyErr)
  }

  const loyaltyDisplay = await getInvoiceLoyaltyDisplay(supabase, {
    companyId,
    invoiceId: invoice.id,
    clientEmail: buyer.email,
  }).catch(() => ({ redeemed: null, earned: null }))

  // PDF generation and upload
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

    const itemsForPdf: PosInvoiceItem[] = items.map((item, idx) => ({
      id: `tmp-${idx}`,
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      vat_amount: (item.quantity * item.unit_price) * (item.vat_rate / (100 + item.vat_rate)),
      total: item.quantity * item.unit_price,
      created_at: invoice.created_at,
    }))

    const companyAddress = [
      premise?.address,
      premise?.postal_code && premise?.city
        ? `${premise.postal_code} ${premise.city}`
        : premise?.city ?? null,
    ].filter(Boolean).join(', ')

    const pdfBuffer = await generateInvoicePdf({
      invoice,
      items: itemsForPdf,
      companyName: companyData?.name ?? '',
      companyData: companyInvoiceData ?? null,
      companyAddress: companyAddress || undefined,
      taxNumber: certRow?.tax_number ?? undefined,
      brandPrimary,
      isTestMode: isDemoMode || environment === 'test',
      premiseCode: premise.premise_id,
      deviceCode: device.device_id,
      currency,
      clientCompanyName: buyer.type === 'legal' ? buyer.companyName ?? undefined : undefined,
      clientCompanyTax: buyer.type === 'legal' ? buyer.companyTax ?? undefined : undefined,
      loyaltyRedeemed: loyaltyDisplay.redeemed ?? undefined,
      loyaltyEarned: loyaltyDisplay.earned ?? undefined,
    })

    const storageKey = `${companyId}/${invoiceNumber}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('invoices')
      .upload(storageKey, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (!uploadErr) {
      const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(storageKey)
      if (urlData?.publicUrl) {
        pdfUrl = urlData.publicUrl
        await supabase
          .from('pos_invoices')
          .update({ pdf_url: pdfUrl })
          .eq('id', invoice.id)
      }
    } else {
      console.warn('[createInvoice] Storage upload failed:', uploadErr.message)
    }
  } catch (pdfErr) {
    console.error('[createInvoice] PDF generation failed (non-blocking):', pdfErr)
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber,
    zoi,
    eor,
    isDemoMode,
    pdfUrl,
    total,
  }
}

/**
 * Idempotency guard for the Stripe webhook. Returns an existing non-cancelled
 * invoice that already matches this appointment or Stripe payment intent, else null.
 */
export async function findExistingInvoice(params: {
  companyId: string
  appointmentId?: string | null
  stripePaymentIntentId?: string | null
}): Promise<{ invoiceId: string; invoiceNumber: string } | null> {
  const { companyId, appointmentId, stripePaymentIntentId } = params

  if (!appointmentId && !stripePaymentIntentId) return null

  const supabase = createServiceClient()

  const orFilters: string[] = []
  if (appointmentId) orFilters.push(`appointment_id.eq.${appointmentId}`)
  if (stripePaymentIntentId) orFilters.push(`stripe_payment_intent_id.eq.${stripePaymentIntentId}`)

  const { data } = await supabase
    .from('pos_invoices')
    .select('id, invoice_number')
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .or(orFilters.join(','))
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { invoiceId: data.id, invoiceNumber: data.invoice_number }
}
