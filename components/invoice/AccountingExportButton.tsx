'use client'
import { useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { authFetch } from '@/lib/authFetch'

function startOfMonthISO(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default function AccountingExportButton({
  companyId,
  isPro,
}: {
  companyId: string
  isPro: boolean
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(startOfMonthISO())
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))

  async function handleExport() {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/invoices/accounting-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, dateFrom, dateTo }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Napaka pri izvozu')
        setLoading(false)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Racunovodski-izvoz-${dateFrom}-${dateTo}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setOpen(false)
    } catch {
      setError('Napaka pri izvozu')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5EF7]/30 focus:border-[#6D5EF7]'

  if (!isPro) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Računovodski izvoz
          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-[#6D5EF7]/10 text-[#6D5EF7] rounded-full leading-none">
            PRO
          </span>
        </button>

        <Modal open={open} onClose={() => setOpen(false)} title="Pro funkcija" size="sm">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#6D5EF7]/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#6D5EF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Računovodski izvoz</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Strukturiran Excel izvoz z DDV razčlenitvijo in mesečnimi povzetki, pripravljen za vašega računovodjo.
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Ta funkcija je na voljo za naročnike plana <strong>Blagajna Pro</strong>.
            </p>
            <div className="flex gap-2 pt-1">
              <Link href="/pricing" className="flex-1">
                <Button size="sm" className="w-full">Nadgradi na Pro</Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Zapri</Button>
            </div>
          </div>
        </Modal>
      </>
    )
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Računovodski izvoz
      </Button>

      <Modal
        open={open}
        onClose={() => { if (!loading) setOpen(false) }}
        title="Računovodski izvoz (Excel)"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Strukturiran izvoz pripravljen za vašega računovodjo — z DDV razčlenitvijo, mesečnimi povzetki in pregledom po načinu plačila.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Od datuma</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Do datuma</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Prekliči
            </Button>
            <Button size="sm" onClick={handleExport} loading={loading}>
              Izvozi
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
