'use client'
import { useState } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/authFetch'

interface SubscriptionBannerProps {
  slug: string
  companyId: string
  status: 'trialing' | 'past_due' | 'canceled'
  trialEndsAt?: string | null
  currentPeriodEnd?: string | null
}

function daysLeft(trialEndsAt?: string | null): number {
  if (!trialEndsAt) return 0
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function SubscriptionBanner({ slug, companyId, status, trialEndsAt, currentPeriodEnd }: SubscriptionBannerProps) {
  // Dismissible per session (sessionStorage) so it reappears on next visit.
  const storageKey = `subbanner-dismissed-${status}`
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(storageKey) === '1'
  })
  const [opening, setOpening] = useState(false)

  if (dismissed) return null

  function dismiss() {
    sessionStorage.setItem(storageKey, '1')
    setDismissed(true)
  }

  async function openPortal() {
    setOpening(true)
    try {
      const res = await authFetch('/api/subscriptions/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, returnSlug: slug }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
    } catch {
      /* fall through */
    }
    setOpening(false)
  }

  if (status === 'canceled') {
    return (
      <div className="bg-orange-50 border-b border-orange-200 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
          <p className="text-sm text-orange-800">
            Vaša naročnina je preklicana. Dostop imate do{' '}
            <span className="font-semibold">{formatDate(currentPeriodEnd)}</span>.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/pricing"
              className="text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg"
            >
              Obnovi naročnino
            </Link>
            <button onClick={dismiss} className="text-orange-500 hover:text-orange-700 p-1" title="Skrij">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'past_due') {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
          <p className="text-sm text-red-700">
            Plačilo ni uspelo. Posodobite podatke za plačilo, da ohranite dostop.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={openPortal}
              disabled={opening}
              className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg disabled:opacity-60"
            >
              {opening ? 'Odpiram…' : 'Posodobi'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const left = daysLeft(trialEndsAt)
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
        <p className="text-sm text-amber-800">
          Vaš brezplačni preizkus poteče čez{' '}
          <span className="font-semibold">{left} {left === 1 ? 'dan' : left === 2 ? 'dneva' : 'dni'}</span>. Aktivirajte naročnino.
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/pricing"
            className="text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg"
          >
            Aktiviraj zdaj
          </Link>
          <button
            onClick={dismiss}
            className="text-amber-500 hover:text-amber-700 p-1"
            title="Skrij"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
