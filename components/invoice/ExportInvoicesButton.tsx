'use client'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { authFetch } from '@/lib/authFetch'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Vsi' },
  { value: 'issued', label: 'Izstavljeni' },
  { value: 'storno_original', label: 'Stornirani' },
  { value: 'storno', label: 'Storno računi' },
]

const PAYMENT_OPTIONS = [
  { value: 'all', label: 'Vsi' },
  { value: 'cash', label: 'Gotovina' },
  { value: 'card', label: 'Kartica' },
  { value: 'transfer', label: 'Nakazilo' },
  { value: 'online', label: 'Spletno plačilo' },
]

function startOfMonthISO(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default function ExportInvoicesButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(startOfMonthISO())
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState('all')
  const [paymentMethod, setPaymentMethod] = useState('all')

  async function handleExport() {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ companyId, dateFrom, dateTo, status, paymentMethod })
      const res = await authFetch(`/api/invoices/export?${qs.toString()}`)
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
      a.download = `Racuni-${dateFrom}-${dateTo}.csv`
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

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5EF7]/30 focus:border-[#6D5EF7]'

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Izvozi CSV
      </Button>

      <Modal open={open} onClose={() => { if (!loading) setOpen(false) }} title="Izvozi račune (CSV)" size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Od datuma</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Do datuma</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Način plačila</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
              {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={loading}>Prekliči</Button>
            <Button size="sm" onClick={handleExport} loading={loading}>Izvozi</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
