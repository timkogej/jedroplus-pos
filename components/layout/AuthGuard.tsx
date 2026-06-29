'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePosStore } from '@/store/posStore'
import { resolveCompanyForUser } from '@/lib/auth/resolveCompany'

interface AuthGuardProps {
  slug: string
  children: React.ReactNode
}

export default function AuthGuard({ slug, children }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [ready, setReady] = useState(false)
  const setCompanyData = usePosStore((s) => s.setCompanyData)
  const clearCompanyData = usePosStore((s) => s.clearCompanyData)
  const storedSlug = usePosStore((s) => s.companySlug)
  const storedCompanyId = usePosStore((s) => s.companyId)

  // Avoid double-running in React StrictMode
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    // Send the user to /login but remember where they were headed (e.g. the
    // dashboard after a Stripe Checkout) plus the subscription=success flag, so
    // after re-login they land back here and still see the success toast.
    function goToLogin() {
      const params = new URLSearchParams({ redirect: pathname })
      const subscription = searchParams.get('subscription')
      if (subscription) params.set('subscription', subscription)
      router.replace(`/login?${params.toString()}`)
    }

    async function verify() {
      // Fast path: store already has this company fully resolved
      if (storedSlug === slug && storedCompanyId) {
        setReady(true)
        return
      }

      // Confirm auth session before any DB queries
      const { data: { user } } = await supabase.auth.getUser()

      if (!user?.id) {
        goToLogin()
        return
      }

      const company = await resolveCompanyForUser(supabase, user.id)

      if (!company) {
        goToLogin()
        return
      }

      setCompanyData({
        companyId: company.id,
        externalCompanyId: company.company_id ?? null,
        companyName: company.displayName,
        companySlug: company.slug,
      })

      // Redirect to correct slug if the URL doesn't match
      if (company.slug !== slug) {
        router.replace(`/${company.slug}/dashboard`)
        return
      }

      setReady(true)
    }

    verify()
  }, [slug, storedSlug, storedCompanyId, router, pathname, searchParams, setCompanyData, clearCompanyData])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-7 h-7 border-2 border-[#6D5EF7] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
