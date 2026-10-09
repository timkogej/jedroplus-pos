import { NextRequest, NextResponse } from 'next/server'
import { requireInvoiceAccess } from '@/lib/auth/apiAuth'
import { createServiceClient } from '@/lib/supabase'
import { buildFursQrCode } from '@/lib/furs/qr'

/**
 * The 60-digit FURS verification code for an invoice, used by the browser-side
 * receipt printer (the tax number lives in the certificate, which never leaves
 * the server).
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const auth = await requireInvoiceAccess(req, params.id)
  if ('response' in auth) return auth.response

  const supabase = createServiceClient()
  const [{ data: invoice }, { data: cert }] = await Promise.all([
    supabase.from('pos_invoices').select('zoi, invoice_date').eq('id', params.id).maybeSingle(),
    supabase
      .from('pos_certificates')
      .select('tax_number')
      .eq('company_id', auth.companyId)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  if (!invoice?.zoi) return NextResponse.json({ code: null })
  // No certificate (test/demo invoice): the code is still printed, with an
  // all-zero tax number, so the receipt layout can be checked.
  const code = buildFursQrCode(invoice.zoi, cert?.tax_number ?? '00000000', new Date(invoice.invoice_date))
  return NextResponse.json({ code })
}
