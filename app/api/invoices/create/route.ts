import { NextRequest, NextResponse } from 'next/server'
import { createInvoice, InvoiceValidationError } from '@/lib/invoice/create-invoice'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { rateLimit } from '@/lib/rate-limit'
import { computeInvoiceTotals } from '@/lib/invoice/totals'
import { withVatExemptNote } from '@/lib/invoice/vat'
import { createServiceClient } from '@/lib/supabase'
import { getLoyaltySettings } from '@/lib/loyalty/award'
import { getPointsBalance } from '@/lib/loyalty/balance'
import {
  ValidationError,
  assertUuid,
  assertPaymentMethod,
  assertPositiveAmount,
  assertNonNegativeAmount,
  assertInvoiceItems,
  isValidEmail,
} from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      companyId,
      premiseId,
      deviceId,
      appointmentId,
      clientName,
      clientEmail,
      clientPhone,
      clientTax,
      clientType,
      clientCompanyName,
      clientCompanyTax,
      paymentMethod,
      discountType,
      discountValue,
      subtotal,
      vatRate,
      vatAmount,
      total,
      items,
      notes,
      currency = 'EUR',
      loyaltyRedeemRecordId,
      loyaltyPoints,
    } = body

    // --- Authentication + company ownership --------------------------------
    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    // --- Rate limit: max 30 invoices/min per company -----------------------
    if (!rateLimit(`invoices:create:${companyId}`, 30, 60_000)) {
      return NextResponse.json({ error: 'Preveč zahtev. Poskusite čez minuto.' }, { status: 429 })
    }

    // --- Input validation ---------------------------------------------------
    assertUuid(premiseId, 'poslovni prostor')
    assertUuid(deviceId, 'napravo')
    assertPaymentMethod(paymentMethod)
    assertInvoiceItems(items)
    if (clientEmail && !isValidEmail(clientEmail)) {
      throw new ValidationError('Neveljaven e-poštni naslov')
    }
    if (discountValue != null) assertNonNegativeAmount(discountValue, 'popust')

    // --- Amounts are computed HERE; the browser's numbers are only checked ---
    const points = Math.floor(Number(loyaltyPoints ?? 0))
    if (points < 0 || !Number.isFinite(points)) throw new ValidationError('Neveljavno število točk')

    let loyaltyDiscount = 0
    if (points > 0) {
      if (!clientEmail) throw new ValidationError('Za unovčenje točk je potreben e-poštni naslov stranke')
      const supabase = createServiceClient()
      const loyalty = await getLoyaltySettings(supabase, companyId)
      if (!loyalty.loyalty_enabled) throw new ValidationError('Loyalty program ni omogočen')
      const balance = await getPointsBalance(companyId, clientEmail, supabase)
      if (points > balance) throw new ValidationError(`Stranka nima dovolj točk (na voljo: ${balance})`)
      loyaltyDiscount = points * loyalty.loyalty_redeem_value
    }

    // A company that is not a VAT payer never charges VAT, whatever the browser sent.
    const { data: vatSettings } = await createServiceClient()
      .from('pos_settings')
      .select('is_vat_registered')
      .eq('company_id', companyId)
      .maybeSingle()
    const vatExempt = vatSettings?.is_vat_registered === false
    if (vatExempt) {
      for (const it of items) it.vat_rate = 0
    }

    const totals = computeInvoiceTotals(items, discountValue ?? 0, loyaltyDiscount)
    if (points > 0 && totals.loyaltyDiscount + 0.005 < loyaltyDiscount) {
      throw new ValidationError('Vrednost točk presega znesek računa')
    }
    assertPositiveAmount(totals.total, 'znesek')
    if (typeof total === 'number' && Math.abs(total - totals.total) > 0.01) {
      throw new ValidationError('Znesek računa se ne ujema z izračunom strežnika. Osvežite stran in poskusite znova.')
    }

    const result = await createInvoice({
      companyId,
      appointmentId: appointmentId ?? null,
      premiseId,
      deviceId,
      paymentMethod,
      items,
      subtotal: totals.subtotal,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      total: totals.total,
      discountType,
      discountAmount: totals.discount,
      buyer: {
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        taxNumber: clientTax,
        type: clientType,
        companyName: clientCompanyName,
        companyTax: clientCompanyTax,
      },
      notes: vatExempt ? withVatExemptNote(notes) : notes,
      currency,
      loyaltyRedeemRecordId: loyaltyRedeemRecordId ?? null,
      loyaltyPoints: points,
      loyaltyDiscount: totals.loyaltyDiscount,
    })

    return NextResponse.json({
      invoiceId: result.invoiceId,
      invoiceNumber: result.invoiceNumber,
      zoi: result.zoi,
      eor: result.eor,
      isDemoMode: result.isDemoMode,
      pdfUrl: result.pdfUrl,
      total: totals.total,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      vatRate: totals.vatRate,
    })
  } catch (err: unknown) {
    if (err instanceof InvoiceValidationError || err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
