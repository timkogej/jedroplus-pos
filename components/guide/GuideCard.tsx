'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { STEP_COPY } from '@/lib/help/steps'
import type { GuideSummary } from '@/lib/guide/steps'
import { useGuide } from '@/components/guide/GuideProvider'
import GuideStepList from '@/components/guide/GuideStepList'

/**
 * "Pot do prvega računa" — the card at the top of the dashboard. Shows progress,
 * the next step with its button, and (expanded) all steps.
 */
export default function GuideCard({
  summary,
  slug,
  activationRequestedAt,
}: {
  summary: GuideSummary
  slug: string
  activationRequestedAt: string | null
}) {
  const router = useRouter()
  const { setGuideVisibility, requestActivation } = useGuide()
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const next = summary.steps.find((s) => s.id === summary.nextId)
  const copy = next ? STEP_COPY[next.id] : null
  const percent = Math.round((summary.done / summary.total) * 100)

  async function hide(action: 'hide' | 'dismiss') {
    await setGuideVisibility(action)
    router.refresh()
  }

  async function onActivation() {
    setBusy(true)
    setError('')
    const r = await requestActivation()
    setBusy(false)
    if (!r.ok) setError(r.error ?? 'Zahteve ni bilo mogoče poslati. Poskusite znova.')
    else router.refresh()
  }

  return (
    <section
      data-tour="guide-card"
      aria-labelledby="guide-card-title"
      className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="guide-card-title" className="text-[15px] font-semibold text-gray-900">
            Pot do prvega računa
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Opravljeno {summary.done} od {summary.total}
          </p>
        </div>
        <Link href={`/${slug}/guide`} className="text-xs font-medium text-brand hover:underline">
          Odpri vodič
        </Link>
      </div>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuenow={summary.done}
        aria-valuemin={0}
        aria-valuemax={summary.total}
        aria-label="Napredek nastavitve"
      >
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
      </div>

      {next && copy && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Naslednji korak</p>
          <p className="mt-1 text-base font-semibold text-gray-900">{copy.title}</p>
          <p className="mt-1 text-sm text-gray-600">{copy.why}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {next.status === 'waiting' ? (
              activationRequestedAt ? (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                  Zahtevo smo prejeli. Ekipa Jedro+ vklopi pravo delovanje in vam javi.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={onActivation}
                  disabled={busy}
                  className="inline-flex items-center rounded-lg bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-black focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {busy ? 'Pošiljam…' : copy.cta}
                </button>
              )
            ) : (
              <Link
                href={`/${slug}/${copy.href}`}
                className="inline-flex items-center rounded-lg bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-black focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {copy.cta}
              </Link>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="font-medium text-gray-700 hover:text-gray-900"
        >
          {expanded ? 'Skrij korake' : 'Vsi koraki'} {expanded ? '▴' : '▾'}
        </button>
        <span className="flex items-center gap-3 text-gray-500">
          <button type="button" onClick={() => hide('hide')} className="hover:text-gray-800">
            Skrij za zdaj
          </button>
          <button type="button" onClick={() => hide('dismiss')} className="hover:text-gray-800">
            Ne prikaži več
          </button>
        </span>
      </div>

      {expanded && (
        <div className="mt-2">
          <GuideStepList steps={summary.steps} slug={slug} activationRequestedAt={activationRequestedAt} />
        </div>
      )}
    </section>
  )
}
