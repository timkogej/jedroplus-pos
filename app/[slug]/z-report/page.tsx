import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Header from '@/components/layout/Header'
import ZReportClient from '@/components/z-report/ZReportClient'
import { computeZReportTotals, localDateString } from '@/lib/z-report/calculate'
import type { ZReport } from '@/types'

export const revalidate = 0

export default async function ZReportPage({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, slug, name')
    .eq('slug', params.slug)
    .single()

  if (!company) redirect('/login')

  const today = localDateString()

  const [{ data: todayReport }, { data: reports }, { data: premise }, { data: settings }] = await Promise.all([
    supabase
      .from('pos_z_reports')
      .select('*')
      .eq('company_id', company.id)
      .eq('report_date', today)
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
  const preview = todayReport ? null : await computeZReportTotals(supabase, company.id, today)

  const premiseId = (premise as { id?: string } | null)?.id ?? null
  const deviceId =
    ((premise as { pos_devices?: Array<{ id: string }> } | null)?.pos_devices?.[0]?.id) ?? null

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={params.slug} title="Dnevni zaključek blagajne" />
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <ZReportClient
            slug={params.slug}
            companyId={company.id}
            premiseId={premiseId}
            deviceId={deviceId}
            today={today}
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
