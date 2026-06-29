import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Multi-tenant data isolation test.
 *
 * Verifies that Row Level Security (RLS) actually scopes every pos_ table to the
 * company the logged-in user is attached to (profiles.default_company_id).
 *
 * IMPORTANT: this must be run with an **authenticated anon client** — i.e. a
 * Supabase client that carries a logged-in user's session. RLS only applies to
 * the anon role; the service-role client bypasses RLS entirely and would make
 * every check falsely "pass". Do NOT pass createServiceClient() here.
 *
 * Each query intentionally omits a `.eq('company_id', ...)` filter so we observe
 * what RLS exposes on its own. If any returned row belongs to a different
 * company, that is a data leak.
 *
 * Usage (e.g. from a throwaway script or a protected admin route):
 *
 *   import { supabase } from '@/lib/supabase'
 *   // ...sign the user in so `supabase` carries their session...
 *   await testDataIsolation(supabase, myCompanyId)
 */

export interface IsolationCheck {
  table: string
  pass: boolean
  visible: number
  leaked: number
  message: string
}

export interface IsolationReport {
  companyId: string
  passed: boolean
  checks: IsolationCheck[]
}

/** Tables scoped directly by a `company_id` column. */
const DIRECT_TABLES = [
  'pos_invoices',
  'pos_premises',
  'pos_devices',
  'pos_settings',
  'pos_certificates',
  'pos_company_data',
  'pos_subscriptions',
] as const

async function checkDirectTable(
  supabase: SupabaseClient,
  table: string,
  companyId: string
): Promise<IsolationCheck> {
  // No company filter on purpose — we want to see everything RLS lets through.
  const { data, error } = await supabase.from(table).select('company_id')

  if (error) {
    return {
      table,
      pass: false,
      visible: 0,
      leaked: 0,
      message: `ERROR querying ${table}: ${error.message}`,
    }
  }

  const rows = data ?? []
  const leaked = rows.filter((r) => r.company_id !== companyId)
  const pass = leaked.length === 0

  return {
    table,
    pass,
    visible: rows.length,
    leaked: leaked.length,
    message: pass
      ? `PASS: Only ${rows.length} records visible for company ${companyId}`
      : `FAIL: Data leak detected! ${leaked.length}/${rows.length} ${table} rows belong to another company`,
  }
}

async function checkInvoiceItems(
  supabase: SupabaseClient,
  companyId: string
): Promise<IsolationCheck> {
  // pos_invoice_items has no company_id column; it is scoped through its parent
  // invoice. Join the parent and confirm every parent invoice is ours.
  const { data, error } = await supabase
    .from('pos_invoice_items')
    .select('id, pos_invoices ( company_id )')

  if (error) {
    return {
      table: 'pos_invoice_items',
      pass: false,
      visible: 0,
      leaked: 0,
      message: `ERROR querying pos_invoice_items: ${error.message}`,
    }
  }

  // Supabase types an embedded relation as an array; normalize to a single
  // parent regardless of whether it comes back as an object or a one-element array.
  const rows = (data ?? []) as unknown as Array<{
    pos_invoices: { company_id: string } | { company_id: string }[] | null
  }>
  const parentCompanyId = (r: (typeof rows)[number]): string | undefined => {
    const p = r.pos_invoices
    if (!p) return undefined
    return Array.isArray(p) ? p[0]?.company_id : p.company_id
  }
  const leaked = rows.filter((r) => parentCompanyId(r) !== companyId)
  const pass = leaked.length === 0

  return {
    table: 'pos_invoice_items',
    pass,
    visible: rows.length,
    leaked: leaked.length,
    message: pass
      ? `PASS: Only ${rows.length} records visible for company ${companyId}`
      : `FAIL: Data leak detected! ${leaked.length}/${rows.length} pos_invoice_items rows belong to another company`,
  }
}

/**
 * Runs the full isolation suite for `companyId` and logs each result.
 * Returns a structured report; `passed` is false if any check leaked.
 */
export async function testDataIsolation(
  supabase: SupabaseClient,
  companyId: string
): Promise<IsolationReport> {
  const checks: IsolationCheck[] = []

  for (const table of DIRECT_TABLES) {
    checks.push(await checkDirectTable(supabase, table, companyId))
  }
  checks.push(await checkInvoiceItems(supabase, companyId))

  for (const c of checks) {
    if (c.pass) console.log(`✅ [${c.table}] ${c.message}`)
    else console.error(`❌ [${c.table}] ${c.message}`)
  }

  const passed = checks.every((c) => c.pass)
  console.log(
    passed
      ? `\n✅ ALL CHECKS PASSED — no cross-company data visible for company ${companyId}`
      : `\n❌ ISOLATION FAILURE — at least one pos_ table leaked data for company ${companyId}`
  )

  return { companyId, passed, checks }
}
