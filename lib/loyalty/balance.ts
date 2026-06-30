import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase'

/** Normalize an email for storage/lookup so casing/whitespace never splits a balance. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Sum a client's loyalty points for a company (earned positive, redeemed
 * negative). Never returns below 0. Pass an existing client to reuse a
 * connection, otherwise a service client is created.
 */
export async function getPointsBalance(
  companyId: string,
  clientEmail: string,
  client?: SupabaseClient
): Promise<number> {
  const email = normalizeEmail(clientEmail)
  if (!email) return 0

  const supabase = client ?? createServiceClient()
  const { data } = await supabase
    .from('pos_loyalty_points')
    .select('points')
    .eq('company_id', companyId)
    .eq('client_email', email)

  const sum = (data ?? []).reduce((s, r) => s + (r.points as number), 0)
  return Math.max(0, sum)
}
