import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { createSessionClient } from '@/lib/supabase-server'

export interface AuthorizedCompany {
  id: string
  slug: string
  name: string
  company_id: string | null
}

/**
 * Server-side gate for every /[slug]/* page. The service-role client bypasses
 * RLS, so a page that loads data by slug alone would expose any company's data
 * to anyone who knows (or guesses) the slug. This verifies:
 *   1. there is a logged-in user (session cookie), and
 *   2. that user's profile.default_company_id is the company behind `slug`.
 * Otherwise it redirects — to the user's own company if they have one, else to
 * /login. Memoized per request so layout + page don't double-query.
 */
export const requireCompanyForSlug = cache(async (slug: string): Promise<AuthorizedCompany> => {
  const {
    data: { user },
  } = await createSessionClient().auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('default_company_id')
    .eq('id', user.id)
    .maybeSingle()

  const ownCompanyId = (profile?.default_company_id as string | undefined) ?? null
  if (!ownCompanyId) redirect('/login')

  const { data: company } = await service
    .from('companies')
    .select('id, slug, name, company_id')
    .eq('id', ownCompanyId)
    .maybeSingle()
  if (!company) redirect('/login')

  if (company.slug !== slug) redirect(`/${company.slug}/dashboard`)

  return company as AuthorizedCompany
})
