import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { computeZReportTotals, localDateString } from '@/lib/z-report/calculate'
import { sendZReportReminder } from '@/lib/z-report/reminder'

/**
 * Daily reminder cron. Protected by CRON_SECRET.
 *
 * Trigger with:  Authorization: Bearer $CRON_SECRET
 *
 * Sends a "close your register" email to every company with an active
 * subscription that has invoices today but no Z-report yet.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = localDateString()

  // Companies with an active subscription.
  const { data: subs } = await supabase
    .from('pos_subscriptions')
    .select('company_id, status')
    .in('status', ['trialing', 'active', 'past_due'])

  const results: Array<{ companyId: string; sent: boolean; reason?: string }> = []

  for (const sub of subs ?? []) {
    const companyId = sub.company_id as string
    try {
      // Already closed today? Skip.
      const { data: existing } = await supabase
        .from('pos_z_reports')
        .select('id')
        .eq('company_id', companyId)
        .eq('report_date', today)
        .maybeSingle()
      if (existing) {
        results.push({ companyId, sent: false, reason: 'already-closed' })
        continue
      }

      const totals = await computeZReportTotals(supabase, companyId, today)
      // Nothing happened today — no point reminding.
      if (totals.total_invoices === 0) {
        results.push({ companyId, sent: false, reason: 'no-activity' })
        continue
      }

      const [{ data: company }, { data: companyData }] = await Promise.all([
        supabase.from('companies').select('slug, name, company_id').eq('id', companyId).single(),
        supabase.from('pos_company_data').select('email, company_name').eq('company_id', companyId).maybeSingle(),
      ])

      const to = companyData?.email
      if (!to) {
        results.push({ companyId, sent: false, reason: 'no-email' })
        continue
      }

      let brandPrimary: string | undefined
      if (company?.company_id) {
        const { data: branding } = await supabase
          .from('Podatki podjetij')
          .select('brand_primary')
          .eq('ID Podjetja', company.company_id)
          .maybeSingle()
        brandPrimary = (branding?.brand_primary as string | undefined) ?? undefined
      }

      const result = await sendZReportReminder({
        to,
        companyName: companyData?.company_name || company?.name || 'Vaše podjetje',
        slug: company?.slug ?? '',
        totalRevenue: totals.total_revenue,
        invoiceCount: totals.total_invoices,
        brandPrimary,
      })
      results.push({ companyId, sent: result.success, reason: result.error })
    } catch (err) {
      results.push({ companyId, sent: false, reason: err instanceof Error ? err.message : 'error' })
    }
  }

  const sentCount = results.filter((r) => r.sent).length
  return NextResponse.json({ ok: true, date: today, sent: sentCount, total: results.length, results })
}
