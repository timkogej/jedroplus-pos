import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import AuthGuard from '@/components/layout/AuthGuard'

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  const supabase = createServiceClient()

  // Verify the slug exists at all; redirect to login if not.
  const { data: company, error } = await supabase
    .from('companies')
    .select('id, slug, name, company_id')
    .eq('slug', params.slug)
    .single()

  if (error || !company) redirect('/login')

  // Prefer the display name from "Podatki podjetij"
  let displayName = company.name
  if (company.company_id) {
    const { data: branding } = await supabase
      .from('Podatki podjetij')
      .select('"Naziv Podjetja"')
      .eq('ID Podjetja', company.company_id)
      .maybeSingle()
    if (branding?.['Naziv Podjetja']) {
      displayName = branding['Naziv Podjetja'] as string
    }
  }

  return (
    // AuthGuard runs client-side: verifies session, confirms slug belongs to the
    // logged-in user, and redirects to the correct slug if mismatched.
    <AuthGuard slug={params.slug}>
      <div className="flex min-h-screen">
        <Sidebar slug={params.slug} companyName={displayName} />
        <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
          {children}
        </div>
        <MobileNav slug={params.slug} />
      </div>
    </AuthGuard>
  )
}
