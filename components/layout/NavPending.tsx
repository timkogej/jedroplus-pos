'use client'
import { useLinkStatus } from 'next/link'

/**
 * Render inside a <Link>: shows a small spinner while THAT link's navigation is
 * still loading, so a click always gets instant visual feedback.
 */
export default function NavPending({ className = '' }: { className?: string }) {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span
      role="status"
      aria-label="Nalaganje"
      className={`ml-auto h-3.5 w-3.5 flex-shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-brand ${className}`}
    />
  )
}
