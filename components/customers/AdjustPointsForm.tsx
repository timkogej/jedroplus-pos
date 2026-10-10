'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { authFetch } from '@/lib/authFetch'
import { friendlyError } from '@/lib/errors'

export default function AdjustPointsForm({
  companyId,
  clientEmail,
}: {
  companyId: string
  clientEmail: string
}) {
  const router = useRouter()
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDone(false)
    setBusy(true)
    try {
      const res = await authFetch('/api/loyalty/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, clientEmail, points: Number(points), reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Popravka ni bilo mogoče shraniti')
      setPoints('')
      setReason('')
      setDone(true)
      router.refresh()
    } catch (err) {
      setError(friendlyError(err, 'Napaka'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Ročni popravek točk</h2>
      <p className="text-xs text-gray-500">
        Pozitivno število doda točke, negativno jih odšteje (pod 0 ne gre). Vsak popravek se zabeleži z razlogom in vašim e-naslovom.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          label="Točke (+/−)"
          type="number"
          step="1"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder="npr. 50 ali -20"
          required
        />
        <div className="sm:col-span-2">
          <Input
            label="Razlog"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="npr. Popravek napake pri računu"
            maxLength={200}
            required
          />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">Popravek shranjen.</p>}
      <Button type="submit" loading={busy} size="sm">Shrani popravek</Button>
    </form>
  )
}
