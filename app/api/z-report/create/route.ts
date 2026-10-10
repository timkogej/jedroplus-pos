import { NextRequest, NextResponse } from 'next/server'
import { pdfStorageKey, signedPdfUrl } from '@/lib/invoice/storage'
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { rateLimitDb } from '@/lib/rate-limit'
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

    if (!(await rateLimitDb(`z-report:create:${companyId}`, 10, 60_000))) {
      return NextResponse.json({ error: 'Preveč zahtev. Poskusite čez minuto.' }, { status: 429 })
    }

    const date = typeof reportDate === 'string' && reportDate ? reportDate : localDateString()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Neveljaven datum' }, { status: 400 })
    }

    // A closed day is locked for new invoices, so a future date would block
    // tomorrow's sales. Only today or earlier can be closed.
    if (date > localDateString()) {
      return NextResponse.json({ error: 'Dneva v prihodnosti ni mogoče zaključiti' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // premise/device ids come from the browser — they must be this company's.
    if (premiseId) {
      const { data: p } = await supabase
        .from('pos_premises').select('id').eq('id', premiseId).eq('company_id', companyId).maybeSingle()
      if (!p) return NextResponse.json({ error: 'Poslovni prostor ni najden' }, { status: 400 })
    }
    if (deviceId) {
      const { data: d } = await supabase
        .from('pos_devices').select('id').eq('id', deviceId).eq('company_id', companyId).maybeSingle()
      if (!d) return NextResponse.json({ error: 'Naprava ni najdena' }, { status: 400 })
    }

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
    // max + 1, retried: two closings at the same instant can pick the same number,
    // the unique index (migration 029) lets only one win and the loser tries again.
    const closedAt = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let report: Record<string, any> | null = null
    let reportNumber = 0
    let reportLabel = ''

    for (let attempt = 0; attempt < 5 && !report; attempt++) {
      const { data: last } = await supabase
        .from('pos_z_reports')
        .select('report_number')
        .eq('company_id', companyId)
        .order('report_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      reportNumber = ((last?.report_number as number | undefined) ?? 0) + 1
      reportLabel = formatReportLabel(date, reportNumber)

      const { data, error: insertError } = await supabase
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

      if (!insertError) {
        report = data
        break
      }
      if ((insertError as { code?: string }).code === '23505') {
        // Same day closed by a concurrent request → done. Same number → try the next.
        if (insertError.message.includes('report_date')) {
          return NextResponse.json({ error: 'Z-poročilo za ta dan že obstaja' }, { status: 409 })
        }
        continue
      }
      throw new Error(insertError.message)
    }

    if (!report) {
      return NextResponse.json({ error: 'Zaključek je trenutno zaseden. Poskusite znova.' }, { status: 503 })
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

      const storageKey = pdfStorageKey(companyId, reportLabel)
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

    revalidateTag('layout-data') // the "yesterday not closed" banner is cached for 60 s
    return NextResponse.json({
      report: { ...report, pdf_url: await signedPdfUrl(supabase, 'z-reports', pdfUrl ?? report.pdf_url) },
      reportLabel,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Napaka strežnika. Poskusite znova.'
    console.error('[z-report create] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
