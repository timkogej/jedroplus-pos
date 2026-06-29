import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import Link from 'next/link'
import SubscriptionSuccessToast from '@/components/dashboard/SubscriptionSuccessToast'
import OnboardingCompleteToast from '@/components/dashboard/OnboardingCompleteToast'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import RevenueChart, { type RevenuePoint } from '@/components/dashboard/RevenueChart'
import type { PosInvoice } from '@/types'

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'green' | 'red' }) {
  const subColor = accent === 'green' ? 'text-green-600' : accent === 'red' ? 'text-red-600' : 'text-gray-400'
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
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

export const revalidate = 0

export default async function DashboardPage({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, slug, name, company_id')
    .eq('slug', params.slug)
    .single()

  if (!company) redirect('/login')

  // --- Onboarding gate ----------------------------------------------------
  // New companies (just subscribed) have no company data or premises yet. Send
  // them through the onboarding flow unless they've explicitly skipped it
  // (cookie set by the "Preskočite nastavitev" link).
  const [{ data: onboardingCompanyData }, { count: premiseCount }, { count: activeCertCount }] = await Promise.all([
    supabase.from('pos_company_data').select('id').eq('company_id', company.id).maybeSingle(),
    supabase.from('pos_premises').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    supabase
      .from('pos_certificates')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .eq('is_active', true),
  ])

  const onboardingSkipped = cookies().get('onboarding_skipped')?.value === params.slug
  const needsOnboarding = !onboardingCompanyData || (premiseCount ?? 0) === 0
  if (needsOnboarding && !onboardingSkipped) {
    redirect(`/${params.slug}/onboarding/step1`)
  }

  // Show the FURS reminder banner whenever there's no active certificate yet —
  // until then invoices are issued in FURS test mode.
  const showFursBanner = (activeCertCount ?? 0) === 0

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const thirtyStart = new Date(now); thirtyStart.setDate(now.getDate() - 29); thirtyStart.setHours(0, 0, 0, 0)
  // Fetch from the earliest boundary we need so today/month/prev-month/30-day are all computed in JS.
  const statsFrom = prevMonthStart < thirtyStart ? prevMonthStart : thirtyStart

  const [{ data: statInvoices }, { data: recentInvoices }, { data: pendingAppointments }] = await Promise.all([
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
  ])

  const { data: invoicedAppts } = await supabase
    .from('pos_invoices')
    .select('appointment_id')
    .eq('company_id', company.id)
    .not('appointment_id', 'is', null)

  const invoicedIds = new Set((invoicedAppts ?? []).map((i) => i.appointment_id))
  const uninvoicedCount = (pendingAppointments ?? []).filter((a) => !invoicedIds.has(a.id)).length

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
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyStart); d.setDate(thirtyStart.getDate() + i)
    buckets.set(d.toISOString().slice(0, 10), { total: 0, count: 0 })
  }
  rows.filter((r) => isRevenue(r.status) && inRange(r, thirtyStart)).forEach((r) => {
    const key = new Date(r.invoice_date).toISOString().slice(0, 10)
    const b = buckets.get(key)
    if (b) { b.total += r.total; b.count += 1 }
  })
  const chartData: RevenuePoint[] = Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    label: `${new Date(date).getDate()}.${new Date(date).getMonth() + 1}.`,
    total: Number(v.total.toFixed(2)),
    count: v.count,
  }))

  const paymentLabel: Record<string, string> = { cash: 'Gotovina', card: 'Kartica', transfer: 'Nakazilo', online: 'Splet' }

  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={null}>
        <SubscriptionSuccessToast />
        <OnboardingCompleteToast />
      </Suspense>
      <Header
        slug={params.slug}
        title="Pregled"
        action={
          <Link href={`/${params.slug}/invoices/new`}>
            <Button size="sm">+ Izstavi račun</Button>
          </Link>
        }
      />
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* FURS certificate reminder — shown until an active certificate exists */}
          {showFursBanner && (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-900">Za produkcijsko delovanje dodajte FURS certifikat</p>
                  <p className="mt-0.5 text-xs text-amber-700">V testnem načinu so računi označeni kot TESTNI.</p>
                </div>
              </div>
              <Link href={`/${params.slug}/settings/certificate`} className="flex-shrink-0">
                <Button size="sm">Dodaj certifikat →</Button>
              </Link>
            </div>
          )}

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

          {/* Revenue chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Promet zadnjih 30 dni</h2>
            <p className="text-xs text-gray-400 mb-4">Dnevni prihodki v EUR</p>
            <RevenueChart data={chartData} />
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
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {uninvoicedCount} {uninvoicedCount === 1 ? 'termin čaka' : 'terminov čaka'} na fakturiranje
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Dokončani termini brez računa</p>
              </div>
              <Link href={`/${params.slug}/appointments`}>
                <Button size="sm">Poglej termine</Button>
              </Link>
            </div>
          )}

          {/* Recent invoices */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Zadnji računi</h2>
              <Link href={`/${params.slug}/invoices`} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Vsi računi →
              </Link>
            </div>

            {!recentInvoices?.length ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-500">Ni izstavljenih računov</p>
                <Link href={`/${params.slug}/invoices/new`} className="inline-block mt-2 text-sm text-[#6D5EF7] hover:underline">
                  Izstavite prvi račun →
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {(recentInvoices as PosInvoice[]).map((inv) => (
                    <Link key={inv.id} href={`/${params.slug}/invoices/${inv.id}`} className="group">
                      <div className="flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${inv.eor ? 'bg-green-400' : inv.status === 'cancelled' ? 'bg-red-400' : 'bg-amber-400'}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-mono font-medium text-gray-900 group-hover:text-[#6D5EF7] transition-colors">{inv.invoice_number}</p>
                            <p className="text-xs text-gray-500 truncate">{inv.client_name ?? 'Neznana stranka'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-gray-400">{paymentLabel[inv.payment_method]}</span>
                          <span className="font-semibold text-gray-900 text-sm">{inv.total.toFixed(2)} €</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Setup checklist */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Hitra nastavitev</h2>
            <div className="space-y-3">
              {[
                {
                  href: `/${params.slug}/settings/certificate`,
                  label: 'Naložite FURS certifikat',
                  done: (activeCertCount ?? 0) > 0,
                },
                {
                  href: `/${params.slug}/settings/premises`,
                  label: 'Dodajte poslovni prostor in napravo',
                  done: (premiseCount ?? 0) > 0,
                },
                {
                  href: `/${params.slug}/invoices/new`,
                  label: 'Izstavite prvi račun',
                  done: (recentInvoices?.length ?? 0) > 0,
                },
              ].map((item, i) => (
                <Link key={i} href={item.href}>
                  <div className="flex items-center gap-3 py-1 group">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.done ? 'bg-gray-900 border-gray-900' : 'border-gray-300 group-hover:border-gray-900'}`}>
                      {item.done && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm ${item.done ? 'text-gray-400 line-through' : 'text-gray-700 group-hover:text-gray-900'} transition-colors`}>
                      {item.label}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
