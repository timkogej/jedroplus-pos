import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import type { PosInvoice } from '@/types'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-xs text-gray-500 font-medium tracking-wide">{label}</p>
      <p className="text-xl md:text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export const revalidate = 0

export default async function DashboardPage({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, slug, name, company_id')
    .eq('slug', params.slug)
    .single()

  if (!company) redirect('/login')

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [{ data: todayInvoices }, { data: recentInvoices }, { data: pendingAppointments }] = await Promise.all([
    supabase
      .from('pos_invoices')
      .select('total, payment_method, status')
      .eq('company_id', company.id)
      .gte('invoice_date', todayStart.toISOString())
      .neq('status', 'cancelled'),
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

  const todayTotal = (todayInvoices ?? []).reduce((sum, inv) => sum + inv.total, 0)
  const cashTotal = (todayInvoices ?? []).filter((i) => i.payment_method === 'cash').reduce((s, i) => s + i.total, 0)
  const cardTotal = (todayInvoices ?? []).filter((i) => i.payment_method === 'card').reduce((s, i) => s + i.total, 0)

  const paymentLabel: Record<string, string> = { cash: 'Gotovina', card: 'Kartica', transfer: 'Nakazilo' }

  return (
    <div className="flex flex-col min-h-screen">
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
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Promet danes" value={`${todayTotal.toFixed(2)} €`} sub={`${(todayInvoices ?? []).length} računov`} />
            <StatCard label="Gotovina" value={`${cashTotal.toFixed(2)} €`} />
            <StatCard label="Kartica" value={`${cardTotal.toFixed(2)} €`} />
            <StatCard
              label="Za fakturirati"
              value={String(uninvoicedCount)}
              sub={uninvoicedCount > 0 ? 'terminov čaka' : 'vsi fakturirani'}
            />
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
                  done: false,
                },
                {
                  href: `/${params.slug}/settings/premises`,
                  label: 'Dodajte poslovni prostor in napravo',
                  done: false,
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
