'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { usePosStore } from '@/store/posStore'
import { resolveCompanyForUser } from '@/lib/auth/resolveCompany'
import { authFetch } from '@/lib/authFetch'
import Button from '@/components/ui/Button'
import { isValidInterval, isValidPlan } from '@/lib/subscription-plans'
import type { PlanId, BillingInterval } from '@/lib/subscription-plans'

const PLANS = {
  plus: {
    name: 'Blagajna Plus',
    monthly: 11,
    yearly: 8.8,
    yearlyTotal: 105.6,
    features: [
      'Izdaja in FURS potrjevanje računov',
      'Mobilna blagajna',
      'Arhiv računov in PDF',
      'Pošiljanje računov po emailu',
      'Spletna plačila (Stripe)',
      'Dashboard statistike',
      'CSV export računov',
      'Termalni tisk',
      'Do 500 računov/mesec',
      '1 poslovni prostor',
    ],
  },
  pro: {
    name: 'Blagajna Pro',
    monthly: 21,
    yearly: 16.8,
    yearlyTotal: 201.6,
    features: [
      'Vse iz Blagajna Plus',
      'Neomejeni računi',
      'Več poslovnih prostorov',
      'Darilni boni',
      'Loyalty točke',
      'Zaloge in dobavnice',
      'Paketne storitve',
      'Računovodski izvoz',
      'Napredna poročila',
      'Priority podpora',
    ],
  },
} as const

const FAQ = [
  {
    q: 'Kako deluje brezplačni preizkus?',
    a: 'Ob registraciji dobite 7 dni popolnega dostopa brez plačila. Naročnino lahko prekličete kadarkoli pred koncem preizkusa in vam ne bo nič zaračunano.',
  },
  {
    q: 'Ali sem vezan na pogodbo?',
    a: 'Ne. Naročnina je mesečna ali letna in jo lahko prekličete kadarkoli. Po preklicu imate dostop do konca plačanega obdobja.',
  },
  {
    q: 'Lahko kasneje zamenjam paket?',
    a: 'Da. Med paketoma Plus in Pro lahko preklapljate kadarkoli prek upravljanja naročnine.',
  },
  {
    q: 'Kateri načini plačila so podprti?',
    a: 'Plačila potekajo varno prek Stripe — sprejemamo vse glavne kreditne in debetne kartice.',
  },
]

function CheckIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0 text-[#6D5EF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function PricingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setCompanyData = usePosStore((s) => s.setCompanyData)
  const storedCompanyId = usePosStore((s) => s.companyId)
  const storedSlug = usePosStore((s) => s.companySlug)

  // Allow the interval to be pre-selected from the URL (e.g. after a login
  // round-trip) so the auto-started checkout matches what the user picked.
  const intervalParam = searchParams.get('interval')
  const [interval, setInterval] = useState<BillingInterval>(
    isValidInterval(intervalParam) ? intervalParam : 'monthly',
  )
  const [companyId, setCompanyId] = useState<string | null>(storedCompanyId)
  const [slug, setSlug] = useState<string | null>(storedSlug)
  const [submitting, setSubmitting] = useState<PlanId | null>(null)
  const [error, setError] = useState('')

  // /pricing is a public page, so we never force-redirect to /login on mount.
  // We DO resolve the company eagerly when a user is already logged in, so the
  // id is ready the moment they click a plan.
  useEffect(() => {
    if (companyId && slug) return
    async function resolve() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return // not logged in — that's fine, page stays public
      const company = await resolveCompanyForUser(supabase, user.id)
      if (!company) return
      setCompanyId(company.id)
      setSlug(company.slug)
      setCompanyData({
        companyId: company.id,
        externalCompanyId: company.company_id ?? null,
        companyName: company.displayName,
        companySlug: company.slug,
      })
    }
    resolve()
  }, [companyId, slug, setCompanyData])

  async function startTrial(plan: PlanId) {
    setError('')

    // Public page: if the visitor isn't logged in, send them to /login and
    // remember the plan + interval so we can resume checkout afterwards.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const params = new URLSearchParams({ redirect: '/pricing', plan, interval })
      router.push(`/login?${params.toString()}`)
      return
    }

    // Logged in but company not resolved yet — wait for the effect above.
    if (!companyId) return

    setSubmitting(plan)
    try {
      const res = await authFetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval, companyId }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Napaka pri začetku naročnine')
        setSubmitting(null)
        return
      }
      // Redirect to Stripe's hosted Checkout. Keep the loading state on the
      // button — the browser navigates away.
      window.location.href = data.url
    } catch {
      setError('Napaka pri začetku naročnine')
      setSubmitting(null)
    }
  }

  // After a login round-trip, the URL carries the plan the visitor picked.
  // Auto-resume checkout once the company is resolved. Guard so it runs once.
  const autoStarted = useRef(false)
  const planParam = searchParams.get('plan')
  useEffect(() => {
    if (autoStarted.current) return
    if (!companyId) return
    if (!isValidPlan(planParam)) return
    autoStarted.current = true
    startTrial(planParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, planParam])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">
            Izberite svoj <span className="gradient-text">paket</span>
          </h1>
          <p className="text-gray-500 mt-3 max-w-md mx-auto">
            Začnite s 7-dnevnim brezplačnim preizkusom. Brez vezave, preklič kadarkoli.
          </p>
        </motion.div>

        {/* Monthly / Yearly toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="inline-flex items-center bg-white border border-gray-200 rounded-full p-1">
            <button
              onClick={() => setInterval('monthly')}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${
                interval === 'monthly' ? 'bg-[#0a0a0a] text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mesečno
            </button>
            <button
              onClick={() => setInterval('yearly')}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-2 ${
                interval === 'yearly' ? 'bg-[#0a0a0a] text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Letno
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {(['plus', 'pro'] as const).map((planId) => {
            const plan = PLANS[planId]
            const isPro = planId === 'pro'
            const price = interval === 'monthly' ? plan.monthly : plan.yearly
            return (
              <motion.div
                key={planId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: isPro ? 0.08 : 0 }}
                className={`relative bg-white rounded-2xl p-6 flex flex-col ${
                  isPro ? 'border-2 border-[#6D5EF7] shadow-lg shadow-[#6D5EF7]/10' : 'border border-gray-200'
                }`}
              >
                {isPro && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-bg text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Priporočeno
                  </span>
                )}
                <h2 className="text-lg font-semibold text-gray-900">{plan.name}</h2>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">
                    {price.toLocaleString('sl-SI', { minimumFractionDigits: price % 1 ? 2 : 0 })}€
                  </span>
                  <span className="text-gray-500 text-sm">/mes</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 h-4">
                  {interval === 'yearly'
                    ? `Obračunano ${plan.yearlyTotal.toLocaleString('sl-SI', { minimumFractionDigits: 2 })}€/leto`
                    : 'Obračunano mesečno'}
                </p>

                <Button
                  onClick={() => startTrial(planId)}
                  loading={submitting === planId}
                  disabled={!!submitting}
                  variant={isPro ? 'primary' : 'secondary'}
                  size="lg"
                  className="w-full mt-5"
                >
                  Začni brezplačno
                </Button>
                <p className="text-[11px] text-center text-gray-400 mt-2">7-dnevni brezplačni preizkus</p>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )
          })}
        </div>

        {error && (
          <div className="max-w-3xl mx-auto mt-5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-8">
          7-dnevni brezplačni preizkus • Brez vezave • Prekliči kadarkoli
        </p>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-16">
          <h3 className="text-xl font-semibold text-gray-900 text-center mb-6">Pogosta vprašanja</h3>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="bg-white border border-gray-200 rounded-xl px-5 py-4 group">
                <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-medium text-gray-900">
                  {item.q}
                  <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="text-sm text-gray-500 mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  // useSearchParams() requires a Suspense boundary in the app router.
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <PricingPageInner />
    </Suspense>
  )
}
