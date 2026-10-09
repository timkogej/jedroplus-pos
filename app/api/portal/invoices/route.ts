import { NextRequest, NextResponse } from 'next/server'
import { authenticateCustomer } from '@/lib/auth/customerAuth'
import { portalCorsHeaders, portalOptions } from '@/lib/portalCors'
import { createServiceClient } from '@/lib/supabase'
import { rateLimitDb } from '@/lib/rate-limit'
import { signedPdfUrl } from '@/lib/invoice/storage'

export const dynamic = 'force-dynamic'

export function OPTIONS(req: NextRequest) {
  return portalOptions(req)
}

/**
 * GET /api/portal/invoices?companySlug=...
 * The signed-in customer's own invoices at one company (matched on the verified
 * email from the token), newest first.
 */
export async function GET(req: NextRequest) {
  const headers = portalCorsHeaders(req)

  const auth = await authenticateCustomer(req, headers)
  if ('response' in auth) return auth.response
  const { customer } = auth

  if (!(await rateLimitDb(`portal:invoices:${customer.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers })
  }

  const slug = req.nextUrl.searchParams.get('companySlug')
  if (!slug) return NextResponse.json({ error: 'Manjka companySlug' }, { status: 400, headers })

  const supabase = createServiceClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (!company) return NextResponse.json({ error: 'Podjetje ni najdeno' }, { status: 404, headers })

  // ilike so differently-cased stored emails still match; escape LIKE wildcards
  // so an address containing "_" or "%" can't match other customers.
  const emailPattern = customer.email.replace(/[\\%_]/g, (c) => `\\${c}`)

  const { data: invoices, error } = await supabase
    .from('pos_invoices')
    .select('id, invoice_number, invoice_date, total, payment_method, status, pdf_url, is_storno')
    .eq('company_id', company.id)
    .ilike('client_email', emailPattern)
    .neq('status', 'draft')
    .order('invoice_date', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: 'Napaka pri branju računov' }, { status: 500, headers })

  // The PDF bucket is private: hand out a link that expires after an hour.
  const withLinks = await Promise.all(
    (invoices ?? []).map(async (inv) => ({
      ...inv,
      pdf_url: await signedPdfUrl(supabase, 'invoices', inv.pdf_url),
    }))
  )

  return NextResponse.json({ invoices: withLinks }, { headers })
}
