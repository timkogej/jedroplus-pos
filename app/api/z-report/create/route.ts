import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { rateLimit } from '@/lib/rate-limit'
import { computeZReportTotals, formatReportLabel, localDateString } from '@/lib/z-report/calculate'
import { loadZReportPdfContext } from '@/lib/z-report/context'
import { generateZReportPdf } from '@/lib/z-report/pdf-server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { companyId, premiseId = null, deviceId = null, reportDate, notes = null } = body

    // --- Auth + company ownership ------------------------------------------
    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    if (!rateLimit(`z-report:create:${companyId}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Preveč zahtev. Poskusite čez minuto.' }, { status: 429 })
    }

    const date = typeof reportDate === 'string' && reportDate ? reportDate : localDateString()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Neveljaven datum' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // --- One Z-report per company per day ----------------------------------
    const { data: existing } = await supabase
      .from('pos_z_reports')
      .select('id')
      .eq('company_id', companyId)
      .eq('report_date', date)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'Z-poročilo za ta dan že obstaja' }, { status: 409 })
    }

    // --- Aggregate the day's invoices --------------------------------------
    const totals = await computeZReportTotals(supabase, companyId, date)

    // --- Sequential per-company report number ------------------------------
    const { count: priorCount } = await supabase
      .from('pos_z_reports')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
    const reportNumber = (priorCount ?? 0) + 1
    const reportLabel = formatReportLabel(date, reportNumber)

    const closedAt = new Date().toISOString()

    const { data: report, error: insertError } = await supabase
      .from('pos_z_reports')
      .insert({
        company_id: companyId,
        premise_id: premiseId,
        device_id: deviceId,
        report_date: date,
        report_number: reportNumber,
        closed_at: closedAt,
        ...totals,
        status: 'closed',
        furs_confirmed: false,
        furs_response: { demo: true },
        notes: notes || null,
      })
      .select()
      .single()

    if (insertError) {
      // 23505 = unique(company_id, report_date) — a concurrent request beat us.
      if ((insertError as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Z-poročilo za ta dan že obstaja' }, { status: 409 })
      }
      throw new Error(insertError.message)
    }

    // --- PDF generation + upload (non-blocking) ----------------------------
    let pdfUrl: string | null = null
    try {
      const ctx = await loadZReportPdfContext(supabase, companyId, premiseId, deviceId)
      const pdfBuffer = await generateZReportPdf({
        report: { reportLabel, reportDate: date, closedAt, ...totals },
        companyName: ctx.companyName,
        companyData: ctx.companyData,
        premiseCode: ctx.premiseCode,
        deviceCode: ctx.deviceCode,
        brandPrimary: ctx.brandPrimary,
        isTestMode: ctx.isTestMode,
        currency: ctx.currency,
      })

      const storageKey = `${companyId}/${reportLabel}.pdf`
      const { error: uploadErr } = await supabase.storage
        .from('z-reports')
        .upload(storageKey, pdfBuffer, { contentType: 'application/pdf', upsert: true })

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('z-reports').getPublicUrl(storageKey)
        if (urlData?.publicUrl) {
          pdfUrl = urlData.publicUrl
          await supabase.from('pos_z_reports').update({ pdf_url: pdfUrl }).eq('id', report.id)
        }
      } else {
        console.warn('[z-report create] Storage upload failed:', uploadErr.message)
      }
    } catch (pdfErr) {
      console.error('[z-report create] PDF generation failed (non-blocking):', pdfErr)
    }

    return NextResponse.json({ report: { ...report, pdf_url: pdfUrl ?? report.pdf_url }, reportLabel })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    console.error('[z-report create] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
