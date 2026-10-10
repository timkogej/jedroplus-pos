import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import RevenueChartLazy from '@/components/dashboard/RevenueChartLazy'
import type { RevenuePoint } from '@/components/dashboard/RevenueChart'
import type { PosInvoice } from '@/types'
import { ljDateString, ljMidnightUtc } from '@/lib/time'

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'green' | 'red' }) {
  const subColor = accent === 'green' ? 'text-green-600' : accent === 'red' ? 'text-red-600' : 'text-gray-500'
  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
      <p className="text-xs text-gray-500 font-medium tracking-wide">{label}</p>
      <p className="text-xl md:text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
    </div>
  )
}

const eur = (n: number) => `${n.toFixed(2)} €`

/** Invoice rows that count towards revenue (exclude storno + cancelled). */
type StatRow = Pick<PosInvoice, 'total' | 'payment_method' | 'status' | 'invoice_date'>
const isRevenue = (s: string) => s !== 'storno' && s !== 'cancelled'


interface DashboardBodyProps {
  company: { id: string; company_id: string | null }
  slug: string
  loyaltyEnabled: boolean
}

/**
 * The statistics part of the dashboard. It is a separate async component inside a
 * <Suspense> boundary, so the page header and the alert banners appear
 * immediately and these (heavier) queries stream in afterwards.
 */
export default async function DashboardBody({ company, slug, loyaltyEnabled }: DashboardBodyProps) {
  const supabase = createServiceClient()

  // All day/month boundaries are Slovenian local time (the server runs in UTC).
  const todayStr = ljDateString()
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const ymd = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d))
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
  }
  const todayStart = ljMidnightUtc(todayStr)
  const monthStart = ljMidnightUtc(ymd(ty, tm, 1))
  const prevMonthStart = ljMidnightUtc(ymd(ty, tm - 1, 1))
  const thirtyStart = ljMidnightUtc(ymd(ty, tm, td - 29))
  // Fetch from the earliest boundary we need so today/month/prev-month/30-day are all computed in JS.
  const statsFrom = prevMonthStart < thirtyStart ? prevMonthStart : thirtyStart

  const [
    { data: statInvoices },
    { data: recentInvoices },
    { data: pendingAppointments },
    { data: loyaltyRows },
  ] = await Promise.all([
    supabase
      .from('pos_invoices')
      .select('total, payment_method, status, invoice_date')
      .eq('company_id', company.id)
      .gte('invoice_date', statsFrom.toISOString()),
    supabase
      .from('pos_invoices')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('Termini')
      .select('id')
      .eq('ID podjetja', company.company_id)
      .eq('Status', 'completed')
      .is('ID računa', null)
      .limit(100),
    // Only needed when the loyalty programme is on.
    loyaltyEnabled
      ? supabase.from('pos_loyalty_points').select('client_email, points').eq('company_id', company.id)
      : Promise.resolve({ data: null }),
  ])

  // Of the (max 100) completed appointments still without an invoice link, which
  // already have an invoice? Looks only at those ids — the old query read EVERY
  // invoice ever issued with an appointment on every dashboard load.
  const pendingIds = (pendingAppointments ?? []).map((a) => String(a.id))
  const { data: invoicedAppts } = pendingIds.length
    ? await supabase
        .from('pos_invoices')
        .select('appointment_id')
        .eq('company_id', company.id)
        .in('appointment_id', pendingIds)
    : { data: [] as Array<{ appointment_id: string | null }> }

  const invoicedIds = new Set((invoicedAppts ?? []).map((i) => i.appointment_id))
  const uninvoicedCount = (pendingAppointments ?? []).filter((a) => !invoicedIds.has(a.id)).length

  // Loyalty: count distinct clients with a positive balance (only if enabled).
  let loyaltyClientCount = 0
  if (loyaltyEnabled) {
    const balances = new Map<string, number>()
    for (const r of loyaltyRows ?? []) {
      balances.set(r.client_email, (balances.get(r.client_email) ?? 0) + (r.points as number))
    }
    loyaltyClientCount = Array.from(balances.values()).filter((b) => b > 0).length
  }

  const rows = (statInvoices ?? []) as StatRow[]
  const inRange = (r: StatRow, from: Date, to?: Date) => {
    const d = new Date(r.invoice_date)
    return d >= from && (!to || d < to)
  }
  const sum = (arr: StatRow[]) => arr.reduce((s, r) => s + r.total, 0)

  // Today
  const todayRows = rows.filter((r) => inRange(r, todayStart))
  const todayRevenueRows = todayRows.filter((r) => isRevenue(r.status))
  const todayTotal = sum(todayRevenueRows)
  const cashTotal = sum(todayRevenueRows.filter((r) => r.payment_method === 'cash'))
  const cardTotal = sum(todayRevenueRows.filter((r) => r.payment_method === 'card'))
  const onlineTotal = sum(todayRevenueRows.filter((r) => r.payment_method === 'online'))
  const stornoTodayCount = todayRows.filter((r) => r.status === 'storno_original').length

  // This month vs previous month
  const monthRows = rows.filter((r) => inRange(r, monthStart) && isRevenue(r.status))
  const prevMonthRows = rows.filter((r) => inRange(r, prevMonthStart, monthStart) && isRevenue(r.status))
  const monthTotal = sum(monthRows)
  const prevMonthTotal = sum(prevMonthRows)
  const monthAvg = monthRows.length ? monthTotal / monthRows.length : 0
  const monthChange = prevMonthTotal > 0 ? ((monthTotal - prevMonthTotal) / prevMonthTotal) * 100 : null

  // Last 30 days revenue chart, one bucket per day
  const buckets = new Map<string, { total: number; count: number }>()
  for (let i = 29; i >= 0; i--) {
    buckets.set(ymd(ty, tm, td - i), { total: 0, count: 0 })
  }
  rows.filter((r) => isRevenue(r.status) && inRange(r, thirtyStart)).forEach((r) => {
    const key = ljDateString(new Date(r.invoice_date))
    const b = buckets.get(key)
    if (b) { b.total += r.total; b.count += 1 }
  })
  const chartData: RevenuePoint[] = Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    label: `${Number(date.slice(8, 10))}.${Number(date.slice(5, 7))}.`,
    total: Number(v.total.toFixed(2)),
    count: v.count,
  }))

  const paymentLabel: Record<string, string> = { cash: 'Gotovina', card: 'Kartica', transfer: 'Nakazilo', online: 'Splet' }

  return (
    <>
          {/* Today's stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Prihodki danes" value={eur(todayTotal)} sub={`${todayRevenueRows.length} računov`} />
            <StatCard label="Število računov danes" value={String(todayRows.length)} />
            <StatCard label="Gotovina danes" value={eur(cashTotal)} />
            <StatCard label="Kartica danes" value={eur(cardTotal)} />
            <StatCard label="Spletna plačila danes" value={eur(onlineTotal)} />
            <StatCard
              label="Stornirani danes"
              value={String(stornoTodayCount)}
              sub={stornoTodayCount > 0 ? 'storniranih računov' : 'brez storniranj'}
              accent={stornoTodayCount > 0 ? 'red' : undefined}
            />
          </div>

          {/* Loyalty */}
          {loyaltyEnabled && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Stranke z zvestobnimi točkami" value={String(loyaltyClientCount)} sub="strank s točkami" />
            </div>
          )}

          {/* Revenue chart */}
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Promet zadnjih 30 dni</h2>
            <p className="text-xs text-gray-500 mb-4">Dnevni prihodki v EUR</p>
            <RevenueChartLazy data={chartData} />
          </div>

          {/* This month summary */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Ta mesec</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Mesečni prihodki" value={eur(monthTotal)} />
              <StatCard label="Število računov" value={String(monthRows.length)} />
              <StatCard label="Povpr. vrednost računa" value={eur(monthAvg)} />
              <StatCard
                label="Glede na prejšnji mesec"
                value={monthChange === null ? '—' : `${monthChange >= 0 ? '+' : ''}${monthChange.toFixed(1)} %`}
                sub={monthChange === null ? 'ni podatkov' : `prej ${eur(prevMonthTotal)}`}
                accent={monthChange === null ? undefined : monthChange >= 0 ? 'green' : 'red'}
              />
            </div>
          </div>

          {/* Quick action banner */}
          {uninvoicedCount > 0 && (
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {uninvoicedCount} {uninvoicedCount === 1 ? 'termin čaka' : 'terminov čaka'} na izstavitev računa
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Dokončani termini brez računa</p>
              </div>
              <Link href={`/${slug}/appointments`}>
                <Button size="sm">Poglej termine</Button>
              </Link>
            </div>
          )}

          {/* Recent invoices */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Zadnji računi</h2>
              <Link href={`/${slug}/invoices`} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Vsi računi →
              </Link>
            </div>

            {!recentInvoices?.length ? (
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-10 text-center">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-500">Ni izstavljenih računov</p>
                <Link href={`/${slug}/invoices/new`} className="inline-block mt-2 text-sm text-brand hover:underline">
                  Izstavite prvi račun →
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {(recentInvoices as PosInvoice[]).map((inv) => (
                    <Link key={inv.id} href={`/${slug}/invoices/${inv.id}`} className="group">
                      <div className="flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${inv.eor ? 'bg-green-400' : inv.status === 'cancelled' ? 'bg-red-400' : 'bg-amber-400'}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-mono font-medium text-gray-900 group-hover:text-brand transition-colors">{inv.invoice_number}</p>
                            <p className="text-xs text-gray-500 truncate">{inv.client_name ?? 'Neznana stranka'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-gray-500">{paymentLabel[inv.payment_method]}</span>
                          <span className="font-semibold text-gray-900 text-sm">{inv.total.toFixed(2)} €</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
    </>
  )
}
