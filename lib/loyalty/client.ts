import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Finds the "Stranke"."ID stranke" for a buyer's email within one company, so
 * loyalty rows are linked to the CRM customer (not just to an email string).
 * "ID Podjetja" in Stranke holds the short company code (companies.company_id).
 * Returns null when there is no match or the lookup fails — never throws.
 */
export async function resolveStrankeId(
  supabase: SupabaseClient,
  companyId: string,
  email: string | null | undefined
): Promise<string | null> {
  const clean = email?.trim().toLowerCase()
  if (!clean) return null
  try {
    const { data: company } = await supabase
      .from('companies')
      .select('company_id')
      .eq('id', companyId)
      .maybeSingle()
    if (!company?.company_id) return null

    // Escape LIKE wildcards so "_" / "%" in an address can't match other people.
    const pattern = clean.replace(/[\\%_]/g, (c) => `\\${c}`)
    const { data } = await supabase
      .from('Stranke')
      .select('"ID stranke"')
      .eq('ID Podjetja', company.company_id)
      .ilike('Email stranke', pattern)
      .limit(1)
      .maybeSingle()

    const id = (data as Record<string, unknown> | null)?.['ID stranke']
    return id == null ? null : String(id)
  } catch (err) {
    console.error('[loyalty] Stranke lookup failed (non-blocking):', err)
    return null
  }
}
