import { cache } from 'react'
import { unstable_cache } from 'next/cache'
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
const lookupMembership = unstable_cache(
  async (userId: string, slug: string) => {
    const service = createServiceClient()
    const [{ data: profile }, { data: requested }] = await Promise.all([
      service.from('profiles').select('default_company_id').eq('id', userId).maybeSingle(),
      service.from('companies').select('id, slug, name, company_id').eq('slug', slug).maybeSingle(),
    ])
    return {
      ownCompanyId: (profile?.default_company_id as string | undefined) ?? null,
      requested: (requested as AuthorizedCompany | null) ?? null,
    }
  },
  ['company-membership'],
  { revalidate: 60 }
)

export const requireCompanyForSlug = cache(async (slug: string): Promise<AuthorizedCompany> => {
  const {
    data: { user },
  } = await (await createSessionClient()).auth.getUser()
  if (!user) redirect('/login')

  // Profile + requested company, cached briefly per (user, slug): the user is still
  // verified on every request (getUser above), only the lookup of WHICH company
  // they belong to is reused — it almost never changes, and it used to cost two
  // database round trips on every single page. A membership change takes at most
  // a minute to apply.
  const { ownCompanyId, requested } = await lookupMembership(user.id, slug)
  if (!ownCompanyId) redirect('/login')

  // The common case: the URL's company is the user's own.
  if (requested && requested.id === ownCompanyId) return requested as AuthorizedCompany

  // Someone else's (or an unknown) slug: send them to their own company.
  const { data: own } = await createServiceClient()
    .from('companies')
    .select('slug')
    .eq('id', ownCompanyId)
    .maybeSingle()
  if (!own) redirect('/login')
  redirect(`/${own.slug}/dashboard`)
})
