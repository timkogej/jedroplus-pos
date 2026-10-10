'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { usePosStore } from '@/store/posStore'
import { resolveCompanyForUser } from '@/lib/auth/resolveCompany'
import Button from '@/components/ui/Button'
import { friendlyError } from '@/lib/errors'

const loginInfoText = 'Uporabite iste prijavne podatke kot v aplikaciji Jedro+.'

function LoginInfoIcon() {
  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-500"
      title={loginInfoText}
      aria-label={loginInfoText}
    >
      i
    </span>
  )
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setCompanyData = usePosStore((s) => s.setCompanyData)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // True from the moment sign-in succeeded until the next page has taken over.
  const [redirecting, setRedirecting] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Once we navigate, the button must stay in its loading state — the next page
    // still takes a moment to arrive, and an idle-looking form felt like a freeze.
    let navigating = false
    const go = (url: string) => {
      navigating = true
      setRedirecting(true)
      router.push(url)
    }

    try {
      // Step 1: auth — must succeed before any DB query
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw new Error(authError.message)
      if (!authData.user) throw new Error('Prijava ni uspela')

      // Step 2-4: resolve company via profiles table
      const company = await resolveCompanyForUser(supabase, authData.user.id, { branding: false })

      if (!company) {
        await supabase.auth.signOut()
        throw new Error('Vaš račun ni povezan z nobenim podjetjem')
      }

      // Step 5: store data
      setCompanyData({
        companyId: company.id,
        externalCompanyId: company.company_id ?? null,
        companyName: company.displayName,
        companySlug: company.slug,
      })

      // Step 6: redirect. If we arrived here from /pricing (e.g. the visitor
      // clicked a plan while logged out), go back there with the chosen plan +
      // interval so checkout resumes automatically.
      const redirect = searchParams.get('redirect')
      if (redirect === '/pricing') {
        const plan = searchParams.get('plan')
        const interval = searchParams.get('interval')
        const params = new URLSearchParams()
        if (plan) params.set('plan', plan)
        if (interval) params.set('interval', interval)
        const qs = params.toString()
        go(qs ? `/pricing?${qs}` : '/pricing')
        return
      }

      // Any other internal redirect target (e.g. the dashboard, after a Stripe
      // Checkout where the session expired on Stripe's page). Carry the
      // subscription=success flag through so the success toast still appears.
      if (redirect && redirect.startsWith('/')) {
        const subscription = searchParams.get('subscription')
        go(subscription ? `${redirect}?subscription=${subscription}` : redirect)
        return
      }

      go(`/${company.slug}/dashboard`)
    } catch (err: unknown) {
      const msg = friendlyError(err, 'Napaka pri prijavi')
      console.error('[login] error:', msg, err)
      setError(msg)
    } finally {
      if (!navigating) setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      {redirecting && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90"
        >
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-sm font-medium text-white/90">Prijavljanje … nalagam vašo blagajno</p>
        </div>
      )}
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-7"
        >
          <h1 className="text-4xl font-semibold text-white">Jedro+</h1>
          <div className="mx-auto mt-3 h-1 w-20 rounded-full gradient-bg" />
          <p className="text-base font-medium text-white/85 mt-4">Davčna blagajna</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="bg-white rounded-2xl border border-white/10 p-6 shadow-2xl shadow-black/40"
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">Prijava</h2>
            <p className="mt-1 text-sm text-gray-500">Vstop v davčno blagajno</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="rounded-xl border border-brand/15 bg-gradient-to-r from-brand/8 via-[#2F80ED]/8 to-[#2AD4C5]/8 px-3 py-2.5 text-sm text-gray-600">
              <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-brand ring-1 ring-brand/20">
                i
              </span>
              {loginInfoText}
            </div>

            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                E-pošta
                <LoginInfoIcon />
              </label>
              <input
                type="email"
                placeholder="ime@podjetje.si"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
                className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition-all duration-150 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                Geslo
                <LoginInfoIcon />
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  tabIndex={-1}
                >
                  {showPw ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {loading && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
                  Prijavljam v davčno blagajno...
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full w-1/2 animate-pulse rounded-full gradient-bg" />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              {loading ? 'Prijavljam...' : 'Prijava'}
            </Button>
          </form>
        </motion.div>

        <p className="text-center text-xs text-white/70 mt-4">Jedro+ · ZDavPR 2024</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  // useSearchParams() requires a Suspense boundary in the app router.
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginPageInner />
    </Suspense>
  )
}
