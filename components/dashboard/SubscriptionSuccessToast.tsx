'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

/**
 * Shows a welcome modal after a successful Stripe Checkout (the trial flow
 * redirects to the dashboard with ?subscription=success). The query param is
 * removed from the URL once shown so a refresh doesn't re-trigger it.
 */
export default function SubscriptionSuccessToast() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get('subscription') === 'success') {
      setOpen(true)
      // Strip the query param without a full navigation.
      const params = new URLSearchParams(Array.from(searchParams.entries()))
      params.delete('subscription')
      const query = params.toString()
      router.replace(query ? `?${query}` : window.location.pathname, { scroll: false })
    }
  }, [searchParams, router])

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Dobrodošli!">
      <div className="space-y-4">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          Vaš 7-dnevni preizkus je aktiven. Kartica bo obremenjena po poteku preizkusa.
        </p>
        <Button onClick={() => setOpen(false)} className="w-full">
          Začnimo
        </Button>
      </div>
    </Modal>
  )
}
