'use client'
import { useState } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/authFetch'

export interface AttentionItem {
  id: string
  kind: string
  message: string
  invoice_id: string | null
}

export default function AttentionBanner({
  items,
  companyId,
  slug,
}: {
  items: AttentionItem[]
  companyId: string
  slug: string
}) {
  const [open, setOpen] = useState(items)
  const [busy, setBusy] = useState<string | null>(null)

  async function resolve(id: string) {
    setBusy(id)
    try {
      const res = await authFetch('/api/attention/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, id }),
      })
      if (res.ok) setOpen((prev) => prev.filter((i) => i.id !== id))
    } finally {
      setBusy(null)
    }
  }

  if (open.length === 0) return null

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
      <p className="text-sm font-semibold text-red-900">
        Zahteva vašo pozornost ({open.length})
      </p>
      <ul className="mt-2 space-y-2">
        {open.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-red-800">{item.message}</span>
            <span className="flex flex-shrink-0 items-center gap-3">
              {item.invoice_id && (
                <Link
                  href={`/${slug}/invoices/${item.invoice_id}`}
                  className="text-sm font-medium text-red-900 underline"
                >
                  Odpri račun
                </Link>
              )}
              <button
                onClick={() => resolve(item.id)}
                disabled={busy === item.id}
                className="rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-60"
              >
                Rešeno
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
