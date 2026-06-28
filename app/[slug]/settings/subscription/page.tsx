'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'

interface SubStatus {
  subscribed: boolean
  plan: 'plus' | 'pro' | null
  billingInterval: 'monthly' | 'yearly' | null
  status: string | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  canceledAt: string | null
}

const PLAN_LABEL = { plus: 'Blagajna Plus', pro: 'Blagajna Pro' } as const

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  trialing: { label: 'Brezplačni preizkus', cls: 'bg-amber-100 text-amber-700' },
  active: { label: 'Aktivna', cls: 'bg-green-100 text-green-700' },
  past_due: { label: 'Plačilo ni uspelo', cls: 'bg-red-100 text-red-700' },
  canceled: { label: 'Preklicana', cls: 'bg-gray-100 text-gray-600' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function SubscriptionSettingsPage() {
  const params = useParams()
  const slug = params.slug as string

  const [companyId, setCompanyId] = useState('')
  const [sub, setSub] = useState<SubStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: company } = await supabase.from('companies').select('id').eq('slug', slug).single()
      if (!company) {
        setLoading(false)
        return
      }
      setCompanyId(company.id)
      try {
        const res = await authFetch('/api/subscriptions/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: company.id }),
        })
        const data = await res.json()
        if (res.ok) setSub(data)
        else setError(data.error || 'Napaka pri nalaganju naročnine')
      } catch {
        setError('Napaka pri nalaganju naročnine')
      }
      setLoading(false)
    }
    load()
  }, [slug])

  async function openPortal() {
    if (!companyId) return
    setOpening(true)
    setError('')
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
      setError(data.error || 'Napaka pri odpiranju portala')
    } catch {
      setError('Napaka pri odpiranju portala')
    }
    setOpening(false)
  }

  async function cancelSubscription() {
    if (!companyId) return
    if (!confirm('Ali ste prepričani, da želite preklicati naročnino?')) return
    setCanceling(true)
    setError('')
    try {
      const res = await authFetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      const data = await res.json()
      if (res.ok) {
        // Cancellation is scheduled — status stays 'active' until the period ends.
        setSub((s) => (s ? { ...s, canceledAt: new Date().toISOString() } : s))
      } else {
        setError(data.error || 'Napaka pri preklicu naročnine')
      }
    } catch {
      setError('Napaka pri preklicu naročnine')
    }
    setCanceling(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header slug={slug} title="Naročnina" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#6D5EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const isTrial = sub?.status === 'trialing'
  // A scheduled cancellation keeps status 'active' with canceled_at set, until
  // Stripe ends the period and the webhook flips status to 'canceled'.
  const isCanceled = sub?.status === 'canceled' || sub?.canceledAt != null
  const statusInfo = isCanceled
    ? STATUS_LABEL.canceled
    : sub?.status
      ? STATUS_LABEL[sub.status]
      : null

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={slug} title="Naročnina" />
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        {!sub || sub.plan === null ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <p className="text-sm text-gray-600 mb-4">Trenutno nimate aktivne naročnine.</p>
            <Link href="/pricing">
              <Button>Izberi paket</Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500">Vaš paket</p>
                <h2 className="text-lg font-semibold text-gray-900 mt-0.5">
                  {sub.plan ? PLAN_LABEL[sub.plan] : '—'}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {sub.billingInterval === 'yearly' ? 'Letno obračunavanje' : 'Mesečno obračunavanje'}
                </p>
              </div>
              {statusInfo && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.cls}`}>
                  {statusInfo.label}
                </span>
              )}
            </div>

            <div className="mt-5 pt-5 border-t border-gray-100 space-y-2 text-sm">
              {isTrial && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Preizkus poteče</span>
                  <span className="text-gray-900 font-medium">{formatDate(sub.trialEndsAt)}</span>
                </div>
              )}
              {!isTrial && !isCanceled && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Naslednje obračunavanje</span>
                  <span className="text-gray-900 font-medium">{formatDate(sub.currentPeriodEnd)}</span>
                </div>
              )}
              {isCanceled && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Dostop do</span>
                  <span className="text-gray-900 font-medium">{formatDate(sub.currentPeriodEnd)}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={openPortal} loading={opening}>
                Upravljaj naročnino
              </Button>
              {sub.plan === 'plus' && (
                <Button variant="secondary" onClick={openPortal} disabled={opening}>
                  Nadgradi na Pro
                </Button>
              )}
              {!isCanceled && (
                <Button variant="danger" onClick={cancelSubscription} loading={canceling}>
                  Prekliči naročnino
                </Button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        <Link href={`/${slug}/settings`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Nazaj na nastavitve
        </Link>
      </main>
    </div>
  )
}
