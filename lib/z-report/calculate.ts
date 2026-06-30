import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Aggregated daily totals for a Z-report (dnevni zaključek blagajne).
 * Field names mirror the pos_z_reports columns.
 */
export interface ZReportTotals {
  total_revenue: number
  total_invoices: number
  total_cash: number
  total_card: number
  total_transfer: number
  total_online: number
  total_storno: number
  total_storno_count: number
  vat_base_22: number
  vat_amount_22: number
  vat_base_95: number
  vat_amount_95: number
  vat_base_0: number
}

/**
 * Start (inclusive) and end (exclusive) ISO timestamps spanning a single
 * calendar day in the server's local timezone, matching how the dashboard
 * buckets invoices by day.
 */
export function dayBounds(reportDate: string): { start: string; end: string } {
  const start = new Date(`${reportDate}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** Today's date as YYYY-MM-DD in the server's local timezone. */
export function localDateString(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Human label for a stored report: Z-YYYY-NNNN (e.g. Z-2026-0001). */
export function formatReportLabel(reportDate: string, reportNumber: number): string {
  const year = reportDate.slice(0, 4)
  return `Z-${year}-${String(reportNumber).padStart(4, '0')}`
}

interface InvoiceItemRow {
  vat_rate: number | null
  vat_amount: number | null
  total: number | null
}
interface InvoiceRow {
  total: number | null
  payment_method: string | null
  status: string | null
  vat_rate: number | null
  vat_amount: number | null
  pos_invoice_items?: InvoiceItemRow[] | null
}

/** Revenue counts everything except cancellation (storno) and legacy cancels. */
const isRevenue = (status: string | null) => status !== 'storno' && status !== 'cancelled'

/**
 * Reads all of a company's invoices for `reportDate` and computes the Z-report
 * totals. Pure aggregation — does not write anything.
 */
export async function computeZReportTotals(
  supabase: SupabaseClient,
  companyId: string,
  reportDate: string
): Promise<ZReportTotals> {
  const { start, end } = dayBounds(reportDate)

  const { data } = await supabase
    .from('pos_invoices')
    .select('total, payment_method, status, vat_rate, vat_amount, pos_invoice_items(vat_rate, vat_amount, total)')
    .eq('company_id', companyId)
    .gte('invoice_date', start)
    .lt('invoice_date', end)

  const rows = (data ?? []) as InvoiceRow[]
  const revenueRows = rows.filter((r) => isRevenue(r.status))
  const stornoRows = rows.filter((r) => r.status === 'storno')

  const sumTotal = (arr: InvoiceRow[]) => arr.reduce((s, r) => s + (r.total ?? 0), 0)
  const byMethod = (method: string) =>
    sumTotal(revenueRows.filter((r) => r.payment_method === method))

  const totals: ZReportTotals = {
    total_revenue: round2(sumTotal(revenueRows)),
    total_invoices: revenueRows.length,
    total_cash: round2(byMethod('cash')),
    total_card: round2(byMethod('card')),
    total_transfer: round2(byMethod('transfer')),
    total_online: round2(byMethod('online')),
    total_storno: round2(Math.abs(sumTotal(stornoRows))),
    total_storno_count: stornoRows.length,
    vat_base_22: 0,
    vat_amount_22: 0,
    vat_base_95: 0,
    vat_amount_95: 0,
    vat_base_0: 0,
  }

  // VAT breakdown from line items (falls back to invoice-level figures when an
  // invoice has no stored items).
  for (const r of revenueRows) {
    const items = r.pos_invoice_items ?? []
    if (items.length) {
      for (const it of items) {
        const itemTotal = it.total ?? 0
        const rate = Number(it.vat_rate ?? 0)
        const vat = it.vat_amount ?? (rate > 0 ? (itemTotal * rate) / (100 + rate) : 0)
        addToBucket(totals, rate, itemTotal - vat, vat)
      }
    } else {
      const itemTotal = r.total ?? 0
      const rate = Number(r.vat_rate ?? 0)
      const vat = r.vat_amount ?? 0
      addToBucket(totals, rate, itemTotal - vat, vat)
    }
  }

  totals.vat_base_22 = round2(totals.vat_base_22)
  totals.vat_amount_22 = round2(totals.vat_amount_22)
  totals.vat_base_95 = round2(totals.vat_base_95)
  totals.vat_amount_95 = round2(totals.vat_amount_95)
  totals.vat_base_0 = round2(totals.vat_base_0)

  return totals
}

/** Buckets a line into the 22% / 9.5% / 0% groups the report tracks. */
function addToBucket(totals: ZReportTotals, rate: number, base: number, vat: number) {
  if (rate >= 20) {
    totals.vat_base_22 += base
    totals.vat_amount_22 += vat
  } else if (rate > 0) {
    totals.vat_base_95 += base
    totals.vat_amount_95 += vat
  } else {
    totals.vat_base_0 += base
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
