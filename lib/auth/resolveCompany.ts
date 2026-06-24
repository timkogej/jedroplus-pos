import type { SupabaseClient } from '@supabase/supabase-js'

export interface ResolvedCompany {
  id: string           // companies.id
  slug: string         // companies.slug
  name: string         // companies.name
  company_id: string | null  // companies.company_id (used by Termini/Stranke queries)
  displayName: string  // Naziv Podjetja from "Podatki podjetij", or companies.name
}

/**
 * Resolves company for the logged-in user via the profiles table.
 *
 * Exact sequence:
 *  1. profiles where id = userId  → default_company_id
 *  2. companies where id = default_company_id → slug, name, company_id
 *  3. "Podatki podjetij" where "ID Podjetja" = default_company_id → Naziv Podjetja
 *
 * Returns null if any required step fails.
 */
export async function resolveCompanyForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<ResolvedCompany | null> {
  // Step 1: profiles where id = userId → default_company_id
  console.log('[auth] step 1: querying profiles where id =', userId)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('default_company_id')
    .eq('id', userId)
    .single()

  console.log('[auth] step 1 result:', { profile, error: profileError?.message, code: profileError?.code })

  if (profileError || !profile?.default_company_id) {
    console.warn('[auth] profiles lookup failed or no default_company_id')
    return null
  }

  const companyId = profile.default_company_id
  console.log('[auth] step 2: querying companies where id =', companyId)

  // Step 2: companies where id = default_company_id
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, slug, name, company_id')
    .eq('id', companyId)
    .single()

  console.log('[auth] step 2 result:', { company, error: companyError?.message })

  if (companyError || !company) {
    console.warn('[auth] companies lookup failed for id=%s', companyId, companyError?.message)
    return null
  }

  // Step 3: Podatki podjetij where ID Podjetja = default_company_id
  console.log('[auth] step 3: querying Podatki podjetij where ID Podjetja =', companyId)
  let displayName = company.name
  const { data: branding, error: brandingError } = await supabase
    .from('Podatki podjetij')
    .select('"Naziv Podjetja"')
    .eq('ID Podjetja', companyId)
    .maybeSingle()

  console.log('[auth] step 3 result:', { branding, error: brandingError?.message })

  if (branding?.['Naziv Podjetja']) {
    displayName = branding['Naziv Podjetja'] as string
  }

  console.log('[auth] resolved: company=%s slug=%s displayName=%s', companyId, company.slug, displayName)

  return {
    id: company.id,
    slug: company.slug,
    name: company.name,
    company_id: company.company_id ?? null,
    displayName,
  }
}
