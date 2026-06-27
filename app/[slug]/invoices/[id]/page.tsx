'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import InvoicePDF from '@/components/invoice/InvoicePDF'
import { printThermal } from '@/lib/invoice/thermal-print'
import { authFetch } from '@/lib/authFetch'
import type { PosInvoice, PosInvoiceItem, PosCompanyData } from '@/types'

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const id = params.id as string

  const [invoice, setInvoice] = useState<(PosInvoice & { pos_invoice_items?: PosInvoiceItem[] }) | null>(null)
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null)
  const [companyData, setCompanyData] = useState<PosCompanyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [printHint, setPrintHint] = useState(false)
  const [stornoModalOpen, setStornoModalOpen] = useState(false)
  const [stornoLoading, setStornoLoading] = useState(false)
  const [stornoError, setStornoError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: comp }, { data: inv }] = await Promise.all([
      supabase.from('companies').select('id, name').eq('slug', slug).single(),
      supabase.from('pos_invoices').select('*, pos_invoice_items(*)').eq('id', id).single(),
    ])
    setCompany(comp)
    setInvoice(inv)
    if (comp) {
      const { data: cd } = await supabase.from('pos_company_data').select('*').eq('company_id', comp.id).maybeSingle()
      setCompanyData(cd)
    }
    setLoading(false)
  }, [id, slug])

  useEffect(() => { load() }, [load])

  async function downloadPdf() {
    if (!invoice) return
    const res = await authFetch(`/api/invoices/${invoice.id}/pdf`)
    if (res.ok) {
      const { base64, filename } = await res.json()
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `Racun-${invoice.invoice_number}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      return
    }
    if (!company) return
    const blob = await pdf(
      <InvoicePDF invoice={invoice} companyName={company.name} />
    ).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Racun-${invoice.invoice_number}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  async function fetchPdfBase64(): Promise<string | null> {
    if (!invoice) return null
    const res = await authFetch(`/api/invoices/${invoice.id}/pdf`)
    if (!res.ok) return null
    const { base64 } = await res.json()
    return base64 as string
  }

  function base64ToObjectUrl(base64: string): string {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  }

  async function handlePrintA4() {
    await handleViewPdf()
    setPrintHint(true)
    setTimeout(() => setPrintHint(false), 4000)
  }

  async function handleViewPdf() {
    if (!invoice) return
    const base64 = await fetchPdfBase64()
    if (!base64) {
      if (!company) return
      const blob = await pdf(<InvoicePDF invoice={invoice} companyName={company.name} />).toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      return
    }
    const url = base64ToObjectUrl(base64)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  function handlePrintThermal() {
    if (!invoice || !company) return
    const addressParts = [companyData?.address, [companyData?.postal_code, companyData?.city].filter(Boolean).join(' ')].filter(Boolean)
    const contact = [companyData?.phone, companyData?.email].filter(Boolean).join(' · ')
    printThermal({
      invoice,
      companyName: companyData?.company_name || company.name,
      companyAddress: addressParts.join(', ') || undefined,
      companyContact: contact || undefined,
      taxNumber: companyData?.vat_id || companyData?.tax_number || undefined,
    })
  }

  async function handleStorno() {
    if (!invoice) return
    setStornoLoading(true)
    setStornoError(null)
    try {
      const res = await authFetch(`/api/invoices/${invoice.id}/storno`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setStornoError(data.error ?? 'Napaka pri storniranju')
        setStornoLoading(false)
        return
      }
      setStornoModalOpen(false)
      router.push(`/${slug}/invoices/${data.stornoInvoiceId}`)
    } catch {
      setStornoError('Napaka pri storniranju')
      setStornoLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header slug={slug} title="Račun" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#6D5EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header slug={slug} title="Račun" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Račun ni najden</p>
        </div>
      </div>
    )
  }

  const paymentLabel: Record<string, string> = { cash: 'Gotovina', card: 'Kartica', transfer: 'Bančno nakazilo' }
  const isDemo = (invoice.furs_response as { demo?: boolean })?.demo === true

  function statusBadge() {
    if (invoice!.status === 'storno') return <Badge variant="error">STORNO RAČUN</Badge>
    if (invoice!.status === 'storno_original') return <Badge variant="neutral">STORNIRAN</Badge>
    if (invoice!.status === 'cancelled') return <Badge variant="error">Storniran</Badge>
    if (isDemo) return <Badge variant="warning">TEST</Badge>
    if (invoice!.eor) return <Badge variant="success">Potrjeno pri FURS</Badge>
    return <Badge variant="warning">Čaka potrditev FURS</Badge>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="no-print">
        <Header slug={slug} title={`Račun ${invoice.invoice_number}`} />
      </div>

      <div className="hidden print:block p-8 pb-0">
        <p className="text-xs text-gray-400 mb-1">Jedro+ POS · {invoice.invoice_number}</p>
      </div>

      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full pb-12">
        {/* Status row */}
        <div className="flex items-center gap-3 mb-5 no-print flex-wrap">
          {statusBadge()}
          <span className="text-sm text-gray-500">{invoice.invoice_number}</span>
          {/* Link to related invoice */}
          {invoice.status === 'storno_original' && invoice.storno_invoice_id && (
            <Link
              href={`/${slug}/invoices/${invoice.storno_invoice_id}`}
              className="text-sm text-gray-400 hover:text-gray-600 ml-auto"
            >
              Ogled storno računa →
            </Link>
          )}
          {invoice.status === 'storno' && invoice.storno_of && (
            <Link
              href={`/${slug}/invoices/${invoice.storno_of}`}
              className="text-sm text-gray-400 hover:text-gray-600 ml-auto"
            >
              Ogled originalnega računa →
            </Link>
          )}
        </div>

        {/* Demo mode warning */}
        {isDemo && (
          <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl mb-5 no-print">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-medium text-yellow-800">TESTNI NAČIN — Račun ni potrjen pri FURS</p>
          </div>
        )}

        {/* Storno banner */}
        {invoice.status === 'storno_original' && (
          <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl mb-5 no-print">
            <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="text-sm text-gray-600">Ta račun je bil storniran. Storno račun je bil izdan v zameno.</p>
          </div>
        )}

        {invoice.status === 'storno' && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-5 no-print">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-red-700">To je storno račun. Razveljavlja originalni račun.</p>
          </div>
        )}

        {/* PDF warning */}
        {!invoice.pdf_url && invoice.status !== 'draft' && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4 text-sm text-amber-700 no-print">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            PDF ni bil generiran — račun bo prenešen lokalno.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mb-5 flex-wrap no-print">
          <Button variant="secondary" size="sm" onClick={downloadPdf}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Prenesi PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePrintA4}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Natisni
          </Button>
          <Button variant="secondary" size="sm" onClick={handleViewPdf}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Poglej račun
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePrintThermal}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Natisni račun
          </Button>
          {invoice.status === 'issued' && (
            <Button variant="danger" size="sm" onClick={() => setStornoModalOpen(true)}>
              Storniraj račun
            </Button>
          )}
        </div>

        {/* Invoice card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 print-invoice">
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-gray-400">Stranka</p>
              <p className="font-semibold text-gray-900">{invoice.client_name ?? '—'}</p>
              {invoice.client_email && <p className="text-sm text-gray-500">{invoice.client_email}</p>}
              {invoice.client_phone && <p className="text-sm text-gray-500">{invoice.client_phone}</p>}
              {invoice.client_tax_number && <p className="text-sm text-gray-500">DDV: {invoice.client_tax_number}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Datum</p>
              <p className="font-semibold text-gray-900">{new Date(invoice.invoice_date).toLocaleDateString('sl-SI')}</p>
              <p className="text-sm text-gray-500 mt-1">{paymentLabel[invoice.payment_method]}</p>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Postavke</p>
            <div className="space-y-2">
              {invoice.pos_invoice_items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div>
                    <p className="text-gray-900">{item.description}</p>
                    <p className="text-xs text-gray-400">{item.quantity} × {item.unit_price.toFixed(2)} € · DDV {item.vat_rate}%</p>
                  </div>
                  <p className="font-medium text-gray-900">{item.total.toFixed(2)} €</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Totals */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Znesek brez DDV</span>
              <span>{(invoice.total - invoice.vat_amount).toFixed(2)} €</span>
            </div>
            {invoice.discount_amount !== 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Popust</span>
                <span>{invoice.discount_amount > 0 ? '-' : ''}{Math.abs(invoice.discount_amount).toFixed(2)} €</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-600">
              <span>DDV ({invoice.vat_rate}%)</span>
              <span>{invoice.vat_amount.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Skupaj</span>
              <span className={invoice.status === 'storno' ? 'text-red-600' : 'gradient-text'}>
                {invoice.total.toFixed(2)} €
              </span>
            </div>
          </div>

          {/* FURS */}
          {(invoice.eor || invoice.zoi) && (
            <>
              <div className="border-t border-gray-100" />
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 mb-2">Potrditev FURS</p>
                {invoice.eor && (
                  <div className="mb-1">
                    <p className="text-xs text-blue-500">EOR</p>
                    <p className="text-xs font-mono text-blue-900 break-all">{invoice.eor}</p>
                  </div>
                )}
                {invoice.zoi && (
                  <div>
                    <p className="text-xs text-blue-500">ZOI</p>
                    <p className="text-xs font-mono text-blue-900 break-all">{invoice.zoi}</p>
                  </div>
                )}
                {invoice.furs_confirmed_at && (
                  <p className="text-xs text-blue-400 mt-2">
                    Potrjeno: {new Date(invoice.furs_confirmed_at).toLocaleString('sl-SI')}
                  </p>
                )}
              </div>
            </>
          )}

          {invoice.notes && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Opomba: {invoice.notes}</p>
            </div>
          )}
        </div>

        <div className="mt-4 no-print">
          <Link href={`/${slug}/invoices`} className="text-sm text-gray-400 hover:text-gray-600">
            ← Nazaj na seznam
          </Link>
        </div>
      </main>

      {/* Storno confirmation modal */}
      <Modal
        open={stornoModalOpen}
        onClose={() => { if (!stornoLoading) { setStornoModalOpen(false); setStornoError(null) } }}
        title="Storniraj račun"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Ali ste prepričani, da želite stornirati račun{' '}
            <span className="font-semibold text-gray-900">{invoice.invoice_number}</span>?
          </p>
          <p className="text-sm text-gray-500">
            Ustvari se nov storno račun z negativnimi zneski, ki bo potrjen pri FURS.
            To dejanje je nepopravljivo.
          </p>
          {stornoError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{stornoError}</p>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setStornoModalOpen(false); setStornoError(null) }}
              disabled={stornoLoading}
            >
              Prekliči
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleStorno}
              disabled={stornoLoading}
            >
              {stornoLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Storniram…
                </span>
              ) : 'Storniraj račun'}
            </Button>
          </div>
        </div>
      </Modal>

      {printHint && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 no-print">
          <div className="flex items-center gap-2.5 bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-lg">
            <svg className="w-4 h-4 flex-shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Za tiskanje pritisnite <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono">Ctrl+P</kbd> (Windows) ali <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono">⌘P</kbd> (Mac)
          </div>
        </div>
      )}
    </div>
  )
}
