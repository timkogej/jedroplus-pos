import { NextRequest, NextResponse } from 'next/server'
import { createInvoice, InvoiceValidationError } from '@/lib/invoice/create-invoice'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { rateLimit } from '@/lib/rate-limit'
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
    assertPositiveAmount(total, 'znesek')
    assertNonNegativeAmount(subtotal, 'znesek')
    assertNonNegativeAmount(vatAmount, 'DDV')
    if (clientEmail && !isValidEmail(clientEmail)) {
      throw new ValidationError('Neveljaven e-poštni naslov')
    }

    const result = await createInvoice({
      companyId,
      appointmentId: appointmentId ?? null,
      premiseId,
      deviceId,
      paymentMethod,
      items,
      subtotal,
      vatRate,
      vatAmount,
      total,
      discountType,
      discountAmount: discountValue,
      buyer: {
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        taxNumber: clientTax,
        type: clientType,
        companyName: clientCompanyName,
        companyTax: clientCompanyTax,
      },
      notes,
      currency,
      loyaltyRedeemRecordId: loyaltyRedeemRecordId ?? null,
    })

    return NextResponse.json({
      invoiceId: result.invoiceId,
      invoiceNumber: result.invoiceNumber,
      zoi: result.zoi,
      eor: result.eor,
      isDemoMode: result.isDemoMode,
      pdfUrl: result.pdfUrl,
    })
  } catch (err: unknown) {
    if (err instanceof InvoiceValidationError || err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
