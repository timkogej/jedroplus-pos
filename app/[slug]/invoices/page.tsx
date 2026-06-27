import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import ExportInvoicesButton from '@/components/invoice/ExportInvoicesButton'
import type { PosInvoice } from '@/types'

export const revalidate = 0

function statusBadge(status: string, eor: string | null, isDemo: boolean) {
  if (status === 'storno') return <Badge variant="error">STORNO</Badge>
  if (status === 'storno_original') return <Badge variant="neutral">STORNIRAN</Badge>
  if (status === 'cancelled') return <Badge variant="error">Storniran</Badge>
  if (isDemo) return <Badge variant="warning">TEST</Badge>
  if (status === 'draft') return <Badge variant="warning">Čakam FURS</Badge>
  if (eor) return <Badge variant="success">Potrjeno FURS</Badge>
  return <Badge variant="info">Izstavljen</Badge>
}

function paymentLabel(method: string) {
  return { cash: 'Gotovina', card: 'Kartica', transfer: 'Nakazilo' }[method] ?? method
}

export default async function InvoicesPage({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, slug, name')
    .eq('slug', params.slug)
    .single()

  if (!company) redirect('/login')

  const { data: invoices } = await supabase
    .from('pos_invoices')
    .select('*')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        slug={params.slug}
        title="Računi"
        action={
          <div className="flex items-center gap-2">
            <ExportInvoicesButton companyId={company.id} />
            <Link href={`/${params.slug}/invoices/new`}>
              <Button size="sm">+ Nov račun</Button>
            </Link>
          </div>
        }
      />
      <main className="flex-1 p-4 md:p-6">
        {!invoices?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500 font-medium">Ni izstavljenih računov</p>
            <p className="text-xs text-gray-400 mt-1">Izstavite prvi račun iz terminov ali ročno</p>
            <Link href={`/${params.slug}/invoices/new`} className="text-sm text-[#6D5EF7] hover:underline mt-3 inline-block">
              Izstavi račun →
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {(invoices as PosInvoice[]).map((inv) => {
                const isStornoed = inv.status === 'storno_original'
                const isStornoInv = inv.status === 'storno'
                return (
                  <Link key={inv.id} href={`/${params.slug}/invoices/${inv.id}`} className={`block px-4 py-4 hover:bg-gray-50 transition-colors ${isStornoed ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-mono text-sm font-medium ${isStornoed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{inv.invoice_number}</span>
                      {statusBadge(inv.status, inv.eor, (inv.furs_response as { demo?: boolean })?.demo === true)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 truncate mr-2">{inv.client_name ?? <span className="italic text-gray-400">Neznana stranka</span>}</span>
                      <span className={`text-sm font-semibold flex-shrink-0 ${isStornoInv ? 'text-red-600' : 'text-gray-900'}`}>{inv.total.toFixed(2)} €</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(inv.invoice_date).toLocaleDateString('sl-SI')} · {paymentLabel(inv.payment_method)}
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wide">Številka</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wide">Datum</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wide">Stranka</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 tracking-wide">Znesek</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wide">Plačilo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoices as PosInvoice[]).map((inv) => {
                      const isStornoed = inv.status === 'storno_original'
                      const isStornoInv = inv.status === 'storno'
                      return (
                        <tr key={inv.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isStornoed ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3">
                            <Link href={`/${params.slug}/invoices/${inv.id}`} className={`font-mono font-medium hover:text-[#6D5EF7] hover:underline transition-colors ${isStornoed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {inv.invoice_number}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {new Date(inv.invoice_date).toLocaleDateString('sl-SI')}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {inv.client_name ?? <span className="text-gray-400 italic">Neznana stranka</span>}
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${isStornoInv ? 'text-red-600' : 'text-gray-900'}`}>
                            {inv.total.toFixed(2)} €
                          </td>
                          <td className="px-4 py-3 text-gray-600">{paymentLabel(inv.payment_method)}</td>
                          <td className="px-4 py-3">{statusBadge(inv.status, inv.eor, (inv.furs_response as { demo?: boolean })?.demo === true)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
