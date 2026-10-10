'use client'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { authFetch } from '@/lib/authFetch'
import { useCompany } from '@/components/layout/CompanyContext'
import { ExampleInvoicePreview } from '@/components/guide/Examples'
import { TOURS, type Placement, type TourId, type TourStep } from '@/lib/guide/tours'
import type { GuideStep, GuideStepId } from '@/lib/guide/steps'

export interface ClientGuideSummary {
  steps: GuideStep[]
  done: number
  total: number
  nextId: GuideStepId | null
  complete: boolean
  environment: 'test' | 'production'
  hiddenUntil: string | null
  dismissed: boolean
  tourSeen: Record<string, boolean>
  activationRequestedAt: string | null
}

interface GuideContextValue {
  /** null until the first load finishes. */
  summary: ClientGuideSummary | null
  refresh: () => Promise<void>
  startTour: (id: TourId) => void
  activeTour: TourId | null
  /** hide for now / never show again / show again */
  setGuideVisibility: (action: 'hide' | 'dismiss' | 'show') => Promise<void>
  resetTours: (tour?: TourId) => Promise<void>
  requestActivation: () => Promise<{ ok: boolean; error?: string }>
}

const GuideContext = createContext<GuideContextValue | null>(null)

export function useGuide(): GuideContextValue {
  const ctx = useContext(GuideContext)
  if (!ctx) throw new Error('useGuide must be used inside GuideProvider')
  return ctx
}

/** Soft variant for components that may render outside the provider. */
export function useOptionalGuide(): GuideContextValue | null {
  return useContext(GuideContext)
}

const REFRESH_EVERY_MS = 10_000

export function GuideProvider({ children }: { children: ReactNode }) {
  const company = useCompany()
  const pathname = usePathname()
  const [summary, setSummary] = useState<ClientGuideSummary | null>(null)
  const [activeTour, setActiveTour] = useState<TourId | null>(null)
  const lastLoad = useRef(0)
  const autoStarted = useRef<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch(`/api/guide/summary?company_id=${company.id}`)
      if (!res.ok) return
      setSummary((await res.json()) as ClientGuideSummary)
      lastLoad.current = Date.now()
    } catch {
      /* the guide is a convenience: stay quiet if it can't load */
    }
  }, [company.id])

  // Load on mount and when the user moves to another page (at most every 10 s).
  useEffect(() => {
    if (Date.now() - lastLoad.current > REFRESH_EVERY_MS) void refresh()
  }, [pathname, refresh])

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await authFetch('/api/guide/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id, ...body }),
      })
      return res.ok
    },
    [company.id]
  )

  const finishTour = useCallback(
    (id: TourId) => {
      setActiveTour(null)
      setSummary((s) => (s ? { ...s, tourSeen: { ...s.tourSeen, [id]: true } } : s))
      void post({ action: 'tourSeen', tour: id })
    },
    [post]
  )

  // First visit to the dashboard / appointments page: start the matching tour once.
  useEffect(() => {
    if (!summary || activeTour) return
    const base = `/${company.slug}`
    const tour: TourId | null =
      pathname === `${base}/dashboard` ? 'dashboard' : pathname === `${base}/appointments` ? 'appointments' : null
    if (!tour || summary.tourSeen[tour] || autoStarted.current.has(tour)) return
    autoStarted.current.add(tour)
    const t = setTimeout(() => setActiveTour(tour), 700)
    return () => clearTimeout(t)
  }, [summary, pathname, company.slug, activeTour])

  const setGuideVisibility = useCallback(
    async (action: 'hide' | 'dismiss' | 'show') => {
      await post({ action })
      await refresh()
    },
    [post, refresh]
  )

  const resetTours = useCallback(
    async (tour?: TourId) => {
      if (tour) autoStarted.current.delete(tour)
      else autoStarted.current.clear()
      await post({ action: 'tourReset', ...(tour ? { tour } : {}) })
      await refresh()
    },
    [post, refresh]
  )

  const requestActivation = useCallback(async () => {
    try {
      const res = await authFetch('/api/guide/request-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id }),
      })
      const data = await res.json().catch(() => ({}))
      await refresh()
      return res.ok ? { ok: true } : { ok: false, error: (data as { error?: string }).error }
    } catch {
      return { ok: false, error: 'Povezava ni uspela. Poskusite znova.' }
    }
  }, [company.id, refresh])

  const value = useMemo<GuideContextValue>(
    () => ({ summary, refresh, startTour: setActiveTour, activeTour, setGuideVisibility, resetTours, requestActivation }),
    [summary, refresh, activeTour, setGuideVisibility, resetTours, requestActivation]
  )

  return (
    <GuideContext.Provider value={value}>
      {children}
      {activeTour && <TourOverlay key={activeTour} tour={activeTour} steps={TOURS[activeTour]} onFinish={() => finishTour(activeTour)} />}
    </GuideContext.Provider>
  )
}

// ─── Tour overlay ──────────────────────────────────────────────────────────

const PAD = 6 // space between element and highlight ring
const GAP = 14 // space between highlight and card
const CARD_W = 340
const MARGIN = 12

/** First element matching the selector that is actually on screen. */
function findVisible(selector: string | undefined): { el: HTMLElement; rect: DOMRect } | null {
  if (!selector) return null
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    const rect = el.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) continue
    const style = window.getComputedStyle(el)
    if (style.visibility === 'hidden' || style.display === 'none') continue
    return { el, rect }
  }
  return null
}

function cardPosition(rect: DOMRect | null, placement: Placement, cardH: number) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(CARD_W, vw - MARGIN * 2)
  const clampX = (x: number) => Math.max(MARGIN, Math.min(x, vw - width - MARGIN))
  const clampY = (y: number) => Math.max(MARGIN, Math.min(y, vh - cardH - MARGIN))

  if (!rect || placement === 'center') {
    return { left: clampX(vw / 2 - width / 2), top: clampY(vh / 2 - cardH / 2), width }
  }

  const fits = {
    right: rect.right + PAD + GAP + width <= vw - MARGIN,
    left: rect.left - PAD - GAP - width >= MARGIN,
    bottom: rect.bottom + PAD + GAP + cardH <= vh - MARGIN,
    top: rect.top - PAD - GAP - cardH >= MARGIN,
  }
  const order: Placement[] = [placement, 'bottom', 'top', 'right', 'left']
  const side = order.find((p) => p !== 'center' && fits[p as keyof typeof fits]) ?? 'bottom'

  switch (side) {
    case 'right':
      return { left: rect.right + PAD + GAP, top: clampY(rect.top + rect.height / 2 - cardH / 2), width }
    case 'left':
      return { left: rect.left - PAD - GAP - width, top: clampY(rect.top + rect.height / 2 - cardH / 2), width }
    case 'top':
      return { left: clampX(rect.left + rect.width / 2 - width / 2), top: rect.top - PAD - GAP - cardH, width }
    default:
      return { left: clampX(rect.left + rect.width / 2 - width / 2), top: clampY(rect.bottom + PAD + GAP), width }
  }
}

function TourOverlay({ tour, steps, onFinish }: { tour: TourId; steps: TourStep[]; onFinish: () => void }) {
  // Only the steps whose element is on screen right now (or intro cards).
  const [available] = useState<TourStep[]>(() => steps.filter((s) => !s.target || findVisible(s.target) !== null))
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardH, setCardH] = useState(200)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const step = available[index]
  const isLast = index === available.length - 1

  // Nothing to show (e.g. every target hidden): finish quietly.
  useEffect(() => {
    if (available.length === 0) onFinish()
  }, [available.length, onFinish])

  // Bring the target into view when the step changes.
  useEffect(() => {
    findVisible(step?.target)?.el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [step])

  // Follow the target (scrolling, layout shifts, resizing).
  useEffect(() => {
    let frame = 0
    const tick = () => {
      setRect((prev) => {
        const next = findVisible(step?.target)?.rect ?? null
        if (!prev || !next) return next
        return prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height
          ? prev
          : next
      })
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [step])

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
  }, [index, rect])

  useEffect(() => {
    nextRef.current?.focus()
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish()
      if (e.key === 'ArrowRight') setIndex((i) => (i < available.length - 1 ? i + 1 : i))
      if (e.key === 'ArrowLeft') setIndex((i) => (i > 0 ? i - 1 : i))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [available.length, onFinish])

  if (!step || typeof document === 'undefined') return null

  const pos = cardPosition(rect, step.placement ?? 'bottom', cardH)
  const highlight = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null

  return createPortal(
    <div className="fixed inset-0 z-[150]">
      {/* Dim everything; the highlight cuts a hole with a giant shadow. */}
      {highlight ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-white/90 transition-all duration-200 motion-reduce:transition-none"
          style={{ ...highlight, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)' }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-900/55" />
      )}
      {/* Swallow clicks outside the card so the page isn't changed mid-tour. */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`tour-${tour}-title`}
        aria-describedby={`tour-${tour}-body`}
        className="fixed max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/5 transition-[top,left] duration-200 motion-reduce:transition-none"
        style={{ top: pos.top, left: pos.left, width: pos.width }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
            Korak {index + 1} od {available.length}
          </p>
          <button
            type="button"
            onClick={onFinish}
            aria-label="Zapri ogled"
            className="-mr-1 -mt-1 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <h2 id={`tour-${tour}-title`} className="mt-2 text-base font-semibold text-gray-900">
          {step.title}
        </h2>
        <p id={`tour-${tour}-body`} className="mt-1.5 text-sm leading-6 text-gray-600">
          {step.body}
        </p>
        {step.visual === 'invoicePreview' && (
          <div className="mt-3">
            <ExampleInvoicePreview compact />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          {isLast ? (
            <span />
          ) : (
            <button type="button" onClick={onFinish} className="text-xs font-medium text-gray-500 hover:text-gray-800">
              Preskoči ogled
            </button>
          )}
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Nazaj
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={() => (isLast ? onFinish() : setIndex(index + 1))}
              className="rounded-lg bg-[#1d1d1f] px-3.5 py-1.5 text-sm font-medium text-white outline-none hover:bg-black focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {isLast ? 'Končano' : 'Naprej'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
