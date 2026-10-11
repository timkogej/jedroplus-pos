'use client'
import { useEffect } from 'react'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[page error]', error.digest ?? '', error.message)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center" role="alert">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500" aria-hidden="true">
        <Icon name="alertCircle" className="h-6 w-6" />
      </div>
      <h1 className="text-base font-semibold text-gray-900">Nekaj je šlo narobe</h1>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        Strani ni bilo mogoče naložiti. Poskusite znova; če se napaka ponavlja, osvežite stran ali nas kontaktirajte.
      </p>
      <Button className="mt-5" onClick={reset}>Poskusi znova</Button>
    </div>
  )
}
