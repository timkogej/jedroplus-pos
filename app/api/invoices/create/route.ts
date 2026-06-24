import { NextRequest, NextResponse } from 'next/server'
import { createInvoice, InvoiceValidationError } from '@/lib/invoice/create-invoice'

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
    } = body

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
    if (err instanceof InvoiceValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
