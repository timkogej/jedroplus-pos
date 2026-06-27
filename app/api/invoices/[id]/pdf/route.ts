import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateInvoicePdf } from '@/lib/invoice/pdf-server'
import { requireInvoiceAccess } from '@/lib/auth/apiAuth'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireInvoiceAccess(req, params.id)
    if ('response' in auth) return auth.response

    const supabase = createServiceClient()

    const { data: invoice, error } = await supabase
      .from('pos_invoices')
      .select('*, pos_invoice_items(*)')
      .eq('id', params.id)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }

    const [
      { data: company },
      { data: settings },
      { data: cert },
      { data: premise },
      { data: device },
    ] = await Promise.all([
      supabase.from('companies').select('id, name, company_id').eq('id', invoice.company_id).single(),
      supabase.from('pos_settings').select('furs_environment').eq('company_id', invoice.company_id).single(),
      supabase.from('pos_certificates').select('tax_number').eq('company_id', invoice.company_id).eq('is_active', true).maybeSingle(),
      invoice.premise_id
        ? supabase.from('pos_premises').select('premise_id, address, city, postal_code').eq('id', invoice.premise_id).single()
        : Promise.resolve({ data: null }),
      invoice.device_id
        ? supabase.from('pos_devices').select('device_id').eq('id', invoice.device_id).single()
        : Promise.resolve({ data: null }),
    ])

    let brandPrimary = '#6D5EF7'
    let companyInvoiceData = null
    if (company?.company_id) {
      const [{ data: branding }, { data: cd }] = await Promise.all([
        supabase.from('Podatki podjetij').select('brand_primary').eq('ID Podjetja', company.company_id).maybeSingle(),
        supabase.from('pos_company_data').select('*').eq('company_id', invoice.company_id).maybeSingle(),
      ])
      if (branding?.brand_primary) brandPrimary = branding.brand_primary
      companyInvoiceData = cd
    } else {
      const { data: cd } = await supabase.from('pos_company_data').select('*').eq('company_id', invoice.company_id).maybeSingle()
      companyInvoiceData = cd
    }

    const companyName = company?.name ?? ''
    const premiseData = premise as { premise_id?: string; address?: string | null; city?: string | null; postal_code?: string | null } | null
    const deviceData = device as { device_id?: string } | null

    const companyAddress = [
      premiseData?.address,
      premiseData?.postal_code && premiseData?.city
        ? `${premiseData.postal_code} ${premiseData.city}`
        : premiseData?.city ?? null,
    ].filter(Boolean).join(', ')

    const isTestMode =
      settings?.furs_environment === 'test' ||
      (invoice.furs_response as Record<string, unknown> | null)?.demo === true

    const isStorno = invoice.is_storno === true || invoice.status === 'storno'
    let stornoOf: string | undefined
    if (isStorno && invoice.storno_of) {
      const { data: originalInv } = await supabase
        .from('pos_invoices')
        .select('invoice_number')
        .eq('id', invoice.storno_of)
        .single()
      stornoOf = originalInv?.invoice_number
    }

    const pdfBuffer = await generateInvoicePdf({
      invoice,
      items: invoice.pos_invoice_items ?? [],
      companyName,
      companyData: companyInvoiceData,
      companyAddress: companyAddress || undefined,
      taxNumber: cert?.tax_number ?? undefined,
      brandPrimary,
      isTestMode,
      isStorno,
      stornoOf,
      premiseCode: premiseData?.premise_id,
      deviceCode: deviceData?.device_id,
    })

    return NextResponse.json({
      base64: pdfBuffer.toString('base64'),
      filename: `Racun-${invoice.invoice_number}.pdf`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    console.error('[pdf route] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
