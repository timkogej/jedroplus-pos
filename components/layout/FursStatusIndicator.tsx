'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'

type FursStatus = 'connected' | 'demo' | 'error' | 'loading'

const POLL_INTERVAL_MS = 5 * 60 * 1000

const STATUS_UI: Record<Exclude<FursStatus, 'loading'>, { dot: string; label: string }> = {
  connected: { dot: 'bg-green-500', label: 'FURS: Povezan' },
  demo:      { dot: 'bg-amber-400', label: 'FURS: Demo način' },
  error:     { dot: 'bg-red-500',   label: 'FURS: Napaka' },
}

interface FursStatusIndicatorProps {
  slug: string
  compact?: boolean
  className?: string
}

export default function FursStatusIndicator({ slug, compact = false, className = '' }: FursStatusIndicatorProps) {
  const [status, setStatus] = useState<FursStatus>('loading')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('slug', slug)
          .single()
        if (!company || cancelled) return

        const res = await authFetch(`/api/furs/status?company_id=${company.id}`)
        const data = await res.json()
        if (cancelled) return

        if (!res.ok || !data.status) {
          setStatus('error')
          setMessage(data.error ?? null)
        } else {
          setStatus(data.status as FursStatus)
          setMessage(data.message ?? null)
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    check()
    const interval = setInterval(check, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [slug])

  if (status === 'loading') return null
  const ui = STATUS_UI[status]

  return (
    <div
      className={`${compact ? 'inline-flex rounded-full border border-gray-100 bg-white px-2.5 py-1' : 'flex px-3 py-2'} items-center gap-2 text-xs text-gray-500 ${className}`}
      title={message ?? ui.label}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ui.dot}`} />
      <span>{ui.label}</span>
    </div>
  )
}
