'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/authFetch'
import { usePosStore } from '@/store/posStore'

type FursStatus = 'connected' | 'demo' | 'error' | 'loading'

const POLL_INTERVAL_MS = 5 * 60 * 1000

const STATUS_UI: Record<Exclude<FursStatus, 'loading'>, { dot: string; label: string }> = {
  connected: { dot: 'bg-green-500', label: 'FURS: Povezan' },
  demo:      { dot: 'bg-amber-400', label: 'FURS: Demo način' },
  error:     { dot: 'bg-red-500',   label: 'FURS: Napaka' },
}

interface Result { status: Exclude<FursStatus, 'loading'>; message: string | null }

// Shared by every indicator on the page (sidebar + mobile header) and across
// navigations, so the check runs once per few minutes — not once per component
// per page load.
const cache = new Map<string, { at: number; result: Result }>()
const inflight = new Map<string, Promise<Result>>()

async function fetchStatus(companyId: string): Promise<Result> {
  const hit = cache.get(companyId)
  if (hit && Date.now() - hit.at < POLL_INTERVAL_MS) return hit.result
  const running = inflight.get(companyId)
  if (running) return running

  const p = (async (): Promise<Result> => {
    try {
      const res = await authFetch(`/api/furs/status?company_id=${companyId}`)
      const data = await res.json()
      const result: Result =
        !res.ok || !data.status
          ? { status: 'error', message: data.error ?? null }
          : { status: data.status, message: data.message ?? null }
      cache.set(companyId, { at: Date.now(), result })
      return result
    } catch {
      return { status: 'error', message: null }
    } finally {
      inflight.delete(companyId)
    }
  })()
  inflight.set(companyId, p)
  return p
}

interface FursStatusIndicatorProps {
  slug: string
  compact?: boolean
  className?: string
}

export default function FursStatusIndicator({ compact = false, className = '' }: FursStatusIndicatorProps) {
  // The company id is put into the store by the layout (AuthGuard) — no extra
  // database query is needed to find it.
  const companyId = usePosStore((s) => s.companyId)
  const [state, setState] = useState<{ status: FursStatus; message: string | null }>({ status: 'loading', message: null })

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    const run = async () => {
      const r = await fetchStatus(companyId)
      if (!cancelled) setState(r)
    }
    run()
    const interval = setInterval(run, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [companyId])

  if (state.status === 'loading') return null
  const ui = STATUS_UI[state.status]

  return (
    <div
      className={`${compact ? 'inline-flex rounded-full border border-gray-100 bg-white px-2.5 py-1' : 'flex px-3 py-2'} items-center gap-2 text-xs text-gray-500 ${className}`}
      title={state.message ?? ui.label}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ui.dot}`} />
      <span>{ui.label}</span>
    </div>
  )
}
