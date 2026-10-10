'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePosStore } from '@/store/posStore'
import { CompanyProvider, type CompanyInfo } from '@/components/layout/CompanyContext'

interface AuthGuardProps {
  slug: string
  /** Already verified by the server layout (requireCompanyForSlug). */
  company: CompanyInfo
  children: React.ReactNode
}

/**
 * The server layout has already checked that there is a session and that it
 * belongs to this company, so there is nothing to wait for here. This used to
 * block the whole page behind a spinner while the browser re-did that check with
 * ~5 sequential requests. Now it renders at once, fills the client store from the
 * server's data and sends the user to the login page if the session ends.
 */
export default function AuthGuard({ slug, company, children }: AuthGuardProps) {
  const router = useRouter()
  const setCompanyData = usePosStore((s) => s.setCompanyData)

  useEffect(() => {
    setCompanyData({
      companyId: company.id,
      externalCompanyId: company.company_id,
      companyName: company.displayName,
      companySlug: slug,
    })
  }, [company.id, company.company_id, company.displayName, slug, setCompanyData])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login')
    })
    return () => data.subscription.unsubscribe()
  }, [router])

  return <CompanyProvider value={{ ...company, slug }}>{children}</CompanyProvider>
}
