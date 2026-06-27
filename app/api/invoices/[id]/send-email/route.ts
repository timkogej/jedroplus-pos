import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendInvoiceEmail } from '@/lib/invoice/email'
import { generateInvoicePdf } from '@/lib/invoice/pdf-server'
import { requireInvoiceAccess } from '@/lib/auth/apiAuth'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireInvoiceAccess(req, params.id)
    if ('response' in auth) return auth.response

    const body = await req.json().catch(() => ({}))
    const clientCompanyName: string = body.companyName ?? ''
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
    let brandSecond = '#2AD4C5'
    let nazivPodjetja: string | null = null
    let companyInvoiceData = null
    if (company?.company_id) {
      const [{ data: branding }, { data: cd }] = await Promise.all([
        supabase.from('Podatki podjetij').select('brand_primary, brand_second, "Naziv Podjetja"').eq('ID Podjetja', company.company_id).maybeSingle(),
        supabase.from('pos_company_data').select('*').eq('company_id', invoice.company_id).maybeSingle(),
      ])
      if (branding?.brand_primary) brandPrimary = branding.brand_primary
      if (branding?.brand_second) brandSecond = branding.brand_second
      const b = branding as Record<string, string | null> | null
      if (b?.['Naziv Podjetja']) nazivPodjetja = b['Naziv Podjetja']
      companyInvoiceData = cd
    } else {
      const { data: cd } = await supabase.from('pos_company_data').select('*').eq('company_id', invoice.company_id).maybeSingle()
      companyInvoiceData = cd
    }

    const companyName = nazivPodjetja ?? company?.name ?? clientCompanyName
    const companyAddress = [
      (premise as { address?: string | null } | null)?.address,
      (premise as { postal_code?: string | null; city?: string | null } | null)?.postal_code &&
      (premise as { postal_code?: string | null; city?: string | null } | null)?.city
        ? `${(premise as { postal_code?: string | null } | null)?.postal_code} ${(premise as { city?: string | null } | null)?.city}`
        : (premise as { city?: string | null } | null)?.city ?? null,
    ]
      .filter(Boolean)
      .join(', ')

    const isTestMode =
      settings?.furs_environment === 'test' ||
      (invoice.furs_response as Record<string, unknown> | null)?.demo === true

    let pdfBuffer: Buffer | null = null
    try {
      pdfBuffer = await generateInvoicePdf({
        invoice,
        items: invoice.pos_invoice_items ?? [],
        companyName,
        companyData: companyInvoiceData,
        companyAddress: companyAddress || undefined,
        taxNumber: cert?.tax_number ?? undefined,
        brandPrimary,
        isTestMode,
        premiseCode: (premise as { premise_id?: string } | null)?.premise_id ?? undefined,
        deviceCode: (device as { device_id?: string } | null)?.device_id ?? undefined,
      })
    } catch (pdfErr) {
      console.error('[send-email] PDF generation failed:', pdfErr)
    }

    if (pdfBuffer) {
      try {
        const storageKey = `${invoice.company_id}/${invoice.invoice_number}.pdf`
        const { error: uploadErr } = await supabase.storage
          .from('invoices')
          .upload(storageKey, pdfBuffer, { contentType: 'application/pdf', upsert: true })

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(storageKey)
          if (urlData?.publicUrl) {
            await supabase
              .from('pos_invoices')
              .update({ pdf_url: urlData.publicUrl })
              .eq('id', params.id)
          }
        } else {
          console.warn('[send-email] Storage upload failed:', uploadErr.message)
        }
      } catch (storageErr) {
        console.warn('[send-email] Storage upload exception:', storageErr)
      }
    }

    const pdfBase64 = pdfBuffer ? pdfBuffer.toString('base64') : ''
    const result = await sendInvoiceEmail(invoice, pdfBase64, companyName, { brandPrimary, brandSecond })

    if (result.success) {
      await supabase
        .from('pos_invoices')
        .update({ sent_via_email: true })
        .eq('id', params.id)
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    console.error('[send-email route] Unexpected error:', err)
    return NextResponse.json({ success: false, error: message })
  }
}
