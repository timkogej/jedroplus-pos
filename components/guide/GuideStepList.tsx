'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { STEP_COPY } from '@/lib/help/steps'
import type { GuideStep, GuideStatus } from '@/lib/guide/steps'
import { useGuide } from '@/components/guide/GuideProvider'

export function StatusIcon({ status }: { status: GuideStatus }) {
  const base = 'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full'
  switch (status) {
    case 'done':
      return (
        <span className={`${base} bg-green-500 text-white`} aria-label="Opravljeno">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )
    case 'current':
      return (
        <span className={`${base} border-2 border-brand bg-brand/10`} aria-label="Naslednji korak">
          <span className="h-2 w-2 rounded-full bg-brand" />
        </span>
      )
    case 'waiting':
      return (
        <span className={`${base} bg-amber-100 text-amber-700`} aria-label="Čaka">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      )
    case 'locked':
      return (
        <span className={`${base} bg-gray-100 text-gray-500`} aria-label="Zaklenjeno">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V8a4 4 0 00-8 0v3m-1 0h10a1 1 0 011 1v7a1 1 0 01-1 1H7a1 1 0 01-1-1v-7a1 1 0 011-1z" />
          </svg>
        </span>
      )
    default:
      return <span className={`${base} border-2 border-gray-300`} aria-label="Še ni opravljeno" />
  }
}

/** The "Zahtevaj vklop" button / status for the activation step. */
function ActivationAction({ requested }: { requested: boolean }) {
  const { requestActivation } = useGuide()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (requested) {
    return (
      <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
        Zahtevo smo prejeli. Ekipa Jedro+ vklopi pravo delovanje in vam javi.
      </p>
    )
  }
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError('')
          const r = await requestActivation()
          setBusy(false)
          if (!r.ok) setError(r.error ?? 'Zahteve ni bilo mogoče poslati. Poskusite znova.')
          else router.refresh()
        }}
        className="inline-flex items-center rounded-lg bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-black focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {busy ? 'Pošiljam…' : STEP_COPY.activation.cta}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The steps of the setup guide. `detailed` (Vodič page) lets each step expand to
 * "why / how / how long" and a button; otherwise (dashboard card) it is a compact
 * list of links.
 */
export default function GuideStepList({
  steps,
  slug,
  activationRequestedAt,
  detailed = false,
}: {
  steps: GuideStep[]
  slug: string
  activationRequestedAt: string | null
  detailed?: boolean
}) {
  const firstOpen = steps.find((s) => s.status === 'current' || s.status === 'waiting')?.id ?? null
  const [openId, setOpenId] = useState<string | null>(detailed ? firstOpen : null)

  return (
    <ol className="divide-y divide-gray-100">
      {steps.map((step, i) => {
        const copy = STEP_COPY[step.id]
        const open = openId === step.id
        const lockedFor = step.lockedBecause ? STEP_COPY[step.lockedBecause].title : null

        if (!detailed) {
          return (
            <li key={step.id}>
              <Link
                href={`/${slug}/${copy.href}`}
                className="flex items-center gap-3 py-2.5 outline-none hover:opacity-80 focus-visible:underline"
              >
                <StatusIcon status={step.status} />
                <span
                  className={`text-sm ${
                    step.status === 'done' ? 'text-gray-500' : step.status === 'locked' ? 'text-gray-500' : 'font-medium text-gray-900'
                  }`}
                >
                  {i + 1}. {copy.title}
                </span>
                {step.status === 'waiting' && <span className="ml-auto text-xs text-amber-700">Čaka na Jedro+</span>}
                {step.status === 'locked' && <span className="ml-auto text-xs text-gray-500">Zaklenjeno</span>}
              </Link>
            </li>
          )
        }

        return (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : step.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 py-3.5 text-left outline-none focus-visible:bg-gray-50"
            >
              <StatusIcon status={step.status} />
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[15px] ${step.status === 'done' || step.status === 'locked' ? 'text-gray-500' : 'font-semibold text-gray-900'}`}
                >
                  {i + 1}. {copy.title}
                </span>
                {!open && <span className="block truncate text-[13px] text-gray-500">{copy.why}</span>}
              </span>
              {step.status === 'waiting' && <span className="flex-shrink-0 text-xs font-medium text-amber-700">Čaka na Jedro+</span>}
              <svg
                className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open && (
              <div className="pb-5 pl-9 pr-1">
                <p className="text-sm text-gray-700">{copy.why}</p>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-gray-600">
                  {copy.how.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-gray-500">{copy.time}</p>

                <div className="mt-4">
                  {step.status === 'done' ? (
                    <p className="text-sm font-medium text-green-700">Opravljeno</p>
                  ) : step.status === 'locked' ? (
                    <p className="text-sm text-gray-500">Najprej dokončajte: {lockedFor}.</p>
                  ) : step.id === 'activation' ? (
                    <ActivationAction requested={Boolean(activationRequestedAt)} />
                  ) : (
                    <Link
                      href={`/${slug}/${copy.href}`}
                      className="inline-flex items-center rounded-lg bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-black focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      {copy.cta}
                    </Link>
                  )}
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
