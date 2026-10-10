'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Popover from '@/components/ui/Popover'
import { useOptionalCompany } from '@/components/layout/CompanyContext'
import { GLOSSARY } from '@/lib/help/glossary'
import { authFetch } from '@/lib/authFetch'
import { usePosStore } from '@/store/posStore'

type Mode = 'demo' | 'test' | 'live' | 'error'

const MODE_UI: Record<Mode, { dot: string; label: string; title: string; text: string }> = {
  demo: {
    dot: 'bg-amber-400',
    label: 'Testni način',
    title: 'Testni način',
    text: `${GLOSSARY.testMode.short} Računi so označeni TESTNI. Za prave račune potrebujete potrdilo, registriran prostor in vklop pravega delovanja; vse to najdete v vodiču.`,
  },
  test: {
    dot: 'bg-amber-400',
    label: 'Testno okolje',
    title: 'Testno okolje FURS',
    text: 'Računi se pošiljajo na testni strežnik FURS in uradno še ne veljajo. Pravo delovanje vam vklopi ekipa Jedro+, ko je vse pripravljeno.',
  },
  live: {
    dot: 'bg-green-500',
    label: 'Povezano s FURS',
    title: 'Povezano s FURS',
    text: 'Računi se potrjujejo pri davčni upravi.',
  },
  error: {
    dot: 'bg-red-500',
    label: 'Težava s FURS',
    title: 'Težava s FURS',
    text: 'Povezava s FURS ni uspela. Račun se izda in ga blagajna potrdi pozneje, ko bo povezava spet delovala.',
  },
}

type FursStatus = 'connected' | 'demo' | 'error' | 'loading'
const POLL_INTERVAL_MS = 5 * 60 * 1000

interface Result { status: Exclude<FursStatus, 'loading'>; message: string | null; environment: 'test' | 'production' | null }

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
          ? { status: 'error', message: data.error ?? null, environment: null }
          : { status: data.status, message: data.message ?? null, environment: data.environment === 'production' ? 'production' : 'test' }
      cache.set(companyId, { at: Date.now(), result })
      return result
    } catch {
      return { status: 'error', message: null, environment: null }
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
  const [state, setState] = useState<{ status: FursStatus; message: string | null; environment: 'test' | 'production' | null }>({ status: 'loading', message: null, environment: null })

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

  const slug = useOptionalCompany()?.slug
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])

  if (state.status === 'loading') return null
  const mode: Mode =
    state.status === 'error' ? 'error' : state.status === 'demo' ? 'demo' : state.environment === 'production' ? 'live' : 'test'
  const ui = MODE_UI[mode]

  return (
    <div className={className} data-tour="status">
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Stanje blagajne: ${ui.label}. Odpri razlago.`}
        className={`${compact ? 'inline-flex rounded-full bg-black/[0.05] px-3 py-1.5' : 'flex w-full rounded-[10px] px-2.5 py-1.5 hover:bg-black/[0.04]'} items-center gap-2 text-[12px] font-medium text-gray-600 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40`}
      >
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${ui.dot}`} />
        <span>{ui.label}</span>
      </button>
      <Popover open={open} onClose={close} anchorRef={ref} label={ui.title} width={320}>
        <p className="text-[13px] font-semibold text-gray-900">{ui.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-gray-600">
          {mode === 'error' && state.message ? `${state.message}. ${ui.text}` : ui.text}
        </p>
        {slug && (
          <Link href={`/${slug}/guide`} onClick={close} className="mt-2 inline-block text-[12px] font-medium text-brand hover:underline">
            Odpri vodič →
          </Link>
        )}
      </Popover>
    </div>
  )
}
