'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Shows a success toast after the onboarding flow finishes (step 2 redirects to
 * the dashboard with ?onboarding=complete). The query param is stripped so a
 * refresh doesn't re-trigger it.
 */
export default function OnboardingCompleteToast() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get('onboarding') !== 'complete') return
    setOpen(true)
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.delete('onboarding')
    const query = params.toString()
    router.replace(query ? `?${query}` : window.location.pathname, { scroll: false })
    const t = setTimeout(() => setOpen(false), 5000)
    return () => clearTimeout(t)
  }, [searchParams, router])

  if (!open) return null

  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 px-4">
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-lg">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
          <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-900">Nastavitev končana! Blagajna je pripravljena.</p>
      </div>
    </div>
  )
}
