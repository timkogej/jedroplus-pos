'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGuide } from '@/components/guide/GuideProvider'
import type { TourId } from '@/lib/guide/tours'

const OPTIONS: Array<{ id: TourId; label: string; hint: string; path: string }> = [
  { id: 'dashboard', label: 'Ogled aplikacije', hint: 'Kje je kaj: meni, pregled, računi, Z-poročilo.', path: 'dashboard' },
  { id: 'appointments', label: 'Ogled: račun iz termina', hint: 'Kako iz termina nastane račun.', path: 'appointments' },
]

/** Buttons that replay a guided tour: they reset it, open the right page, and the tour starts there. */
export default function RestartTours({ slug }: { slug: string }) {
  const router = useRouter()
  const { resetTours } = useGuide()
  const [busy, setBusy] = useState<TourId | null>(null)

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {OPTIONS.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(o.id)
              await resetTours(o.id)
              router.push(`/${slug}/${o.path}`)
            }}
            className="w-full rounded-xl border border-gray-200 bg-white p-3.5 text-left outline-none transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60"
          >
            <span className="block text-sm font-semibold text-gray-900">{busy === o.id ? 'Odpiram…' : o.label}</span>
            <span className="mt-0.5 block text-xs text-gray-500">{o.hint}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
