'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { authFetch } from '@/lib/authFetch'
import { formatReportLabel } from '@/lib/z-report/calculate'
import type { ZReportTotals } from '@/lib/z-report/calculate'
import type { ZReport } from '@/types'

interface Props {
  slug: string
  companyId: string
  premiseId: string | null
  deviceId: string | null
  today: string
  currency: string
  initialTodayReport: ZReport | null
  preview: ZReportTotals | null
  initialReports: ZReport[]
}

export default function ZReportClient({
  slug,
  companyId,
  premiseId,
  deviceId,
  today,
  currency,
  initialTodayReport,
  preview,
  initialReports,
}: Props) {
  const router = useRouter()
  const [todayReport, setTodayReport] = useState<ZReport | null>(initialTodayReport)
  const [reports, setReports] = useState<ZReport[]>(initialReports)
  const [notes, setNotes] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const symbol = currency === 'EUR' ? '€' : currency
  const eur = (n: number) => `${(n ?? 0).toFixed(2)} ${symbol}`

  function closedTime(report: ZReport): string {
    if (!report.closed_at) return ''
    return new Date(report.closed_at).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
  }

  async function handleClose() {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/z-report/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, premiseId, deviceId, reportDate: today, notes: notes || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Napaka pri zaključevanju')
        setLoading(false)
        return
      }
      setTodayReport(data.report as ZReport)
      setReports((prev) => [data.report as ZReport, ...prev])
      setModalOpen(false)
      setLoading(false)
      router.refresh()
    } catch {
      setError('Napaka pri zaključevanju')
      setLoading(false)
    }
  }

  async function downloadPdf(report: ZReport) {
    setDownloadingId(report.id)
    try {
      const res = await authFetch(`/api/z-report/${report.id}/pdf`)
      if (!res.ok) {
        setError('Napaka pri prenosu PDF')
        return
      }
      const { base64, filename } = await res.json()
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `${formatReportLabel(report.report_date, report.report_number)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } finally {
      setDownloadingId(null)
    }
  }

  async function viewPdf(report: ZReport) {
    setDownloadingId(report.id)
    try {
      const res = await authFetch(`/api/z-report/${report.id}/pdf`)
      if (!res.ok) {
        setError('Napaka pri odpiranju PDF')
        return
      }
      const { base64 } = await res.json()
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } finally {
      setDownloadingId(null)
    }
  }

  function statusBadge(report: ZReport) {
    const isDemo = (report.furs_response as { demo?: boolean } | null)?.demo === true
    if (report.status === 'error') return <Badge variant="error">Napaka</Badge>
    if (report.furs_confirmed) return <Badge variant="success">Potrjeno FURS</Badge>
    if (isDemo) return <Badge variant="warning">TEST</Badge>
    return <Badge variant="success">Zaključeno</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Today's status header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-gray-900">Današnji dan</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(`${today}T00:00:00`).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          {todayReport ? (
            <span className="inline-flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Zaključeno ob {closedTime(todayReport)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Danes še ni zaključeno
            </span>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Close day section */}
      {!todayReport ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Pregled prometa danes</h2>
            <p className="text-xs text-gray-400 mt-0.5">Vrednosti pred zaključkom blagajne</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <PreviewStat label="Prihodki danes" value={eur(preview?.total_revenue ?? 0)} highlight />
            <PreviewStat label="Število računov" value={String(preview?.total_invoices ?? 0)} />
            <PreviewStat label="Gotovina" value={eur(preview?.total_cash ?? 0)} />
            <PreviewStat label="Kartica" value={eur(preview?.total_card ?? 0)} />
            <PreviewStat label="Bančno nakazilo" value={eur(preview?.total_transfer ?? 0)} />
            <PreviewStat label="Spletna plačila" value={eur(preview?.total_online ?? 0)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Opombe za ta dan (neobvezno)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="npr. menjava blagajnika, popravek ..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5EF7]/30 focus:border-[#6D5EF7]"
            />
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="w-full gradient-bg text-white font-semibold text-sm rounded-xl py-3.5 shadow-sm hover:opacity-95 transition-opacity"
          >
            Zaključi dan
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Blagajna zaključena ob {closedTime(todayReport)}
              </p>
              <p className="text-xs text-gray-400">
                {formatReportLabel(todayReport.report_date, todayReport.report_number)} · {eur(todayReport.total_revenue)} · {todayReport.total_invoices} računov
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => downloadPdf(todayReport)} loading={downloadingId === todayReport.id}>
              Prenesi Z-poročilo
            </Button>
            <Button variant="secondary" size="sm" onClick={() => viewPdf(todayReport)} loading={downloadingId === todayReport.id}>
              Poglej Z-poročilo
            </Button>
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Pretekla Z-poročila</h2>
        {reports.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <p className="text-sm text-gray-500">Ni še zaključenih dni</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Datum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Št. poročila</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Prihodki</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Računi</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Gotovina</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Kartica</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(`${r.report_date}T00:00:00`).toLocaleDateString('sl-SI')}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-900">{formatReportLabel(r.report_date, r.report_number)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{eur(r.total_revenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.total_invoices}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{eur(r.total_cash)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{eur(r.total_card)}</td>
                      <td className="px-4 py-3">{statusBadge(r)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => downloadPdf(r)}
                          disabled={downloadingId === r.id}
                          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#6D5EF7] disabled:opacity-50"
                          title="Prenesi PDF"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      <Modal
        open={modalOpen}
        onClose={() => { if (!loading) setModalOpen(false) }}
        title="Zaključi blagajno"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Ali ste prepričani, da želite zaključiti blagajno za danes?
          </p>
          <p className="text-sm text-gray-500">
            Po zaključku ne morete dodajati računov za ta datum.
          </p>
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Prihodki</span><span className="font-semibold text-gray-900">{eur(preview?.total_revenue ?? 0)}</span></div>
            <div className="flex justify-between mt-1"><span className="text-gray-500">Računi</span><span className="font-medium text-gray-900">{preview?.total_invoices ?? 0}</span></div>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)} disabled={loading}>
              Prekliči
            </Button>
            <Button variant="danger" size="sm" onClick={handleClose} disabled={loading}>
              {loading ? 'Zaključujem…' : 'Zaključi dan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function PreviewStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-[#6D5EF7]/20 bg-[#6D5EF7]/5' : 'border-gray-100 bg-gray-50/50'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${highlight ? 'text-[#6D5EF7]' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}
