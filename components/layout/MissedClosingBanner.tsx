'use client'
import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

interface Props {
  slug: string
  /** YYYY-MM-DD of the day that was never closed. */
  date: string
}

/**
 * Red banner shown when the previous day had invoices but no Z-report.
 * Dismissible for the current browser session (keyed by the missed date).
 */
export default function MissedClosingBanner({ slug, date }: Props) {
  const storageKey = `z-report-missed-dismissed-${date}`
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(storageKey) === '1'
  })

  if (dismissed) return null

  const label = new Date(`${date}T00:00:00`).toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex items-center gap-3 bg-red-50 border-b border-red-100 px-4 md:px-6 py-2.5">
      <Icon name="alertCircle" className="w-4 h-4 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-900 flex-1 min-w-0">
        Včeraj niste zaključili blagajne.{' '}
        <Link href={`/${slug}/z-report?date=${date}`} className="font-semibold underline hover:no-underline">
          Ustvarite Z-poročilo za {label} →
        </Link>
      </p>
      <button
        onClick={() => {
          sessionStorage.setItem(storageKey, '1')
          setDismissed(true)
        }}
        className="text-red-600 hover:text-red-800 flex-shrink-0"
        title="Skrij"
      >
        <Icon name="close" className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  )
}
