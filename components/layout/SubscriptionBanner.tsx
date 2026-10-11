'use client'
import { useState } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/authFetch'
import Icon from '@/components/ui/Icon'

interface SubscriptionBannerProps {
  slug: string
  companyId: string
  status: 'past_due' | 'canceled'
  currentPeriodEnd?: string | null
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function SubscriptionBanner({ slug, companyId, status, currentPeriodEnd }: SubscriptionBannerProps) {
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
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
          <p className="text-sm text-amber-900">
            Vaša naročnina je preklicana. Dostop imate do{' '}
            <span className="font-semibold">{formatDate(currentPeriodEnd)}</span>.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/pricing"
              className="text-sm font-medium text-white bg-[#1d1d1f] hover:bg-black px-3 py-1.5 rounded-lg"
            >
              Obnovi naročnino
            </Link>
            <button onClick={dismiss} className="text-amber-700 hover:text-amber-900 p-1" title="Skrij">
              <Icon name="close" className="w-4 h-4" strokeWidth={2} />
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

  return null
}
