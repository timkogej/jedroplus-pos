'use client'
import { useEffect } from 'react'
import Button from '@/components/ui/Button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[page error]', error.digest ?? '', error.message)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center" role="alert">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500" aria-hidden="true">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h1 className="text-base font-semibold text-gray-900">Nekaj je šlo narobe</h1>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        Strani ni bilo mogoče naložiti. Poskusite znova; če se napaka ponavlja, osvežite stran ali nas kontaktirajte.
      </p>
      <Button className="mt-5" onClick={reset}>Poskusi znova</Button>
    </div>
  )
}
