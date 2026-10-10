import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { requireCompanyForSlug } from '@/lib/auth/serverCompany'
import Header from '@/components/layout/Header'
import ZReportClient from '@/components/z-report/ZReportClient'
import { computeZReportTotals, localDateString } from '@/lib/z-report/calculate'
import type { ZReport } from '@/types'
import { ljDateString, ljMidnightUtc } from '@/lib/time'

/** How far back we look for days that were never closed. */
const LOOKBACK_DAYS = 31

export const revalidate = 0

export default async function ZReportPage(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const supabase = createServiceClient()

  const company = await requireCompanyForSlug(params.slug)

  const today = localDateString()

  // Days before today that have invoices but no Z-report (oldest first).
  const fromDate = ljDateString(new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000))
  const [{ data: recentInvoiceDates }, { data: recentReports }] = await Promise.all([
    supabase
      .from('pos_invoices')
      .select('invoice_date')
      .eq('company_id', company.id)
      .gte('invoice_date', ljMidnightUtc(fromDate).toISOString())
      .limit(10000),
    supabase.from('pos_z_reports').select('report_date').eq('company_id', company.id).gte('report_date', fromDate),
  ])
  const closedDates = new Set((recentReports ?? []).map((r) => r.report_date as string))
  const openDays = Array.from(
    new Set((recentInvoiceDates ?? []).map((r) => ljDateString(new Date(r.invoice_date as string))))
  )
    .filter((d) => d < today && !closedDates.has(d))
    .sort()

  // ?date=YYYY-MM-DD picks which day to close; anything invalid or in the
  // future falls back to today (the API refuses future days as well).
  const requested = searchParams.date ?? ''
  const selectedDate =
    /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today && requested >= fromDate ? requested : today

  const [{ data: todayReport }, { data: reports }, { data: premise }, { data: settings }] = await Promise.all([
    supabase
      .from('pos_z_reports')
      .select('*')
      .eq('company_id', company.id)
      .eq('report_date', selectedDate)
      .maybeSingle(),
    supabase
      .from('pos_z_reports')
      .select('*')
      .eq('company_id', company.id)
      .order('report_date', { ascending: false }),
    supabase
      .from('pos_premises')
      .select('id, pos_devices(id)')
      .eq('company_id', company.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from('pos_settings').select('currency').eq('company_id', company.id).maybeSingle(),
  ])

  // Preview totals for today (only needed when the day isn't closed yet).
  const preview = todayReport ? null : await computeZReportTotals(supabase, company.id, selectedDate)

  const premiseId = (premise as { id?: string } | null)?.id ?? null
  const deviceId =
    ((premise as { pos_devices?: Array<{ id: string }> } | null)?.pos_devices?.[0]?.id) ?? null

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={params.slug} title="Z-poročilo" />
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <ZReportClient
            key={selectedDate}
            slug={params.slug}
            companyId={company.id}
            premiseId={premiseId}
            deviceId={deviceId}
            today={today}
            selectedDate={selectedDate}
            openDays={openDays}
            currency={(settings?.currency as string | undefined) ?? 'EUR'}
            initialTodayReport={(todayReport as ZReport | null) ?? null}
            preview={preview}
            initialReports={(reports as ZReport[] | null) ?? []}
          />
        </div>
      </main>
    </div>
  )
}
