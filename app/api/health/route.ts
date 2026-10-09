import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { checkEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Health check.
 *  - Public: only { ok } — safe for uptime monitors.
 *  - With `Authorization: Bearer $CRON_SECRET`: the full picture (database
 *    latency, missing/risky configuration, FURS queue, certificate expiry).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const detailed = Boolean(secret) && provided === secret

  const env = checkEnv()
  const supabase = createServiceClient()

  let dbOk = false
  let dbMs = 0
  const t0 = Date.now()
  try {
    const { error } = await supabase.from('companies').select('id').limit(1)
    dbOk = !error
  } catch {
    dbOk = false
  }
  dbMs = Date.now() - t0

  const ok = dbOk && env.missing.length === 0

  if (!detailed) {
    return NextResponse.json({ ok }, { status: ok ? 200 : 503 })
  }

  const [{ count: pending }, { count: failed }, { data: oldest }, { data: certs }] = await Promise.all([
    supabase.from('pos_invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending_furs'),
    supabase.from('pos_invoices').select('id', { count: 'exact', head: true }).eq('status', 'furs_failed'),
    supabase.from('pos_invoices').select('invoice_date').eq('status', 'pending_furs').order('invoice_date', { ascending: true }).limit(1),
    supabase.from('pos_certificates').select('company_id, valid_to').eq('is_active', true),
  ])

  const now = Date.now()
  const certList = (certs ?? []).map((c) => new Date(c.valid_to as string).getTime())
  return NextResponse.json(
    {
      ok,
      database: { ok: dbOk, latencyMs: dbMs },
      env: { missing: env.missing, warnings: env.warnings },
      furs: {
        pendingInvoices: pending ?? 0,
        failedInvoices: failed ?? 0,
        oldestPendingAt: oldest?.[0]?.invoice_date ?? null,
      },
      certificates: {
        active: certList.length,
        expiringWithin30Days: certList.filter((t) => t > now && t - now < 30 * 86_400_000).length,
        expired: certList.filter((t) => t <= now).length,
      },
    },
    { status: ok ? 200 : 503 }
  )
}
