'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { usePosStore } from '@/store/posStore'
import { resolveCompanyForUser } from '@/lib/auth/resolveCompany'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setCompanyData = usePosStore((s) => s.setCompanyData)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    console.log('[login] form submitted, email:', email)

    try {
      // Step 1: auth — must succeed before any DB query
      console.log('[login] step 1: calling signInWithPassword...')
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      console.log('[login] step 1 result:', { user: authData?.user?.id, error: authError?.message })

      if (authError) throw new Error(authError.message)
      if (!authData.user) throw new Error('Prijava ni uspela')

      // Step 2-4: resolve company via profiles table
      console.log('[login] step 2: resolving company for uid:', authData.user.id)
      const company = await resolveCompanyForUser(supabase, authData.user.id)
      console.log('[login] step 2 result:', company)

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
        router.push(qs ? `/pricing?${qs}` : '/pricing')
        return
      }

      // Any other internal redirect target (e.g. the dashboard, after a Stripe
      // Checkout where the session expired on Stripe's page). Carry the
      // subscription=success flag through so the success toast still appears.
      if (redirect && redirect.startsWith('/')) {
        const subscription = searchParams.get('subscription')
        router.push(subscription ? `${redirect}?subscription=${subscription}` : redirect)
        return
      }

      console.log('[login] step 3: storing company data, redirecting to /' + company.slug + '/dashboard')
      router.push(`/${company.slug}/dashboard`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Napaka pri prijavi'
      console.error('[login] error:', msg, err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl gradient-bg mb-4">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <path d="M16 4V28M4 16H28" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Jedro+</h1>
          <p className="text-sm text-gray-500 mt-1">Davčna blagajna</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="bg-white rounded-2xl border border-gray-100 p-6"
        >
          <h2 className="text-base font-semibold text-gray-900 mb-5">Prijava</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="E-pošta"
              type="email"
              placeholder="ime@podjetje.si"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Geslo</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
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

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Prijava
            </Button>
          </form>
        </motion.div>

        <p className="text-center text-xs text-gray-400 mt-4">Jedro+ · ZDavPR 2024</p>
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
