import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { authenticateRequest, getUserCompanyId } from '@/lib/auth/apiAuth'
import { loadZReportPdfContext } from '@/lib/z-report/context'
import { generateZReportPdf } from '@/lib/z-report/pdf-server'
import { formatReportLabel } from '@/lib/z-report/calculate'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await authenticateRequest(req)
    if ('response' in auth) return auth.response

    const supabase = createServiceClient()

    const { data: report } = await supabase
      .from('pos_z_reports')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (!report) {
      return NextResponse.json({ error: 'Z-poročilo ni najdeno' }, { status: 404 })
    }

    const ownCompanyId = await getUserCompanyId(auth.user.id)
    if (!ownCompanyId || ownCompanyId !== report.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ctx = await loadZReportPdfContext(
      supabase,
      report.company_id,
      report.premise_id,
      report.device_id
    )

    const reportLabel = formatReportLabel(report.report_date, report.report_number)

    const pdfBuffer = await generateZReportPdf({
      report: {
        reportLabel,
        reportDate: report.report_date,
        closedAt: report.closed_at ?? report.created_at,
        total_revenue: report.total_revenue ?? 0,
        total_invoices: report.total_invoices ?? 0,
        total_cash: report.total_cash ?? 0,
        total_card: report.total_card ?? 0,
        total_transfer: report.total_transfer ?? 0,
        total_online: report.total_online ?? 0,
        total_storno: report.total_storno ?? 0,
        total_storno_count: report.total_storno_count ?? 0,
        vat_base_22: report.vat_base_22 ?? 0,
        vat_amount_22: report.vat_amount_22 ?? 0,
        vat_base_95: report.vat_base_95 ?? 0,
        vat_amount_95: report.vat_amount_95 ?? 0,
        vat_base_0: report.vat_base_0 ?? 0,
      },
      companyName: ctx.companyName,
      companyData: ctx.companyData,
      premiseCode: ctx.premiseCode,
      deviceCode: ctx.deviceCode,
      brandPrimary: ctx.brandPrimary,
      isTestMode: ctx.isTestMode,
      currency: ctx.currency,
    })

    return NextResponse.json({
      base64: pdfBuffer.toString('base64'),
      filename: `${reportLabel}.pdf`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    console.error('[z-report pdf] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
