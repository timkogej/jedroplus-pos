import { ljDayBounds } from '@/lib/time'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Turns the YYYY-MM-DD filters of the export screens into a [from, to) range of
 * Slovenian calendar days. (Bare "YYYY-MM-DDT00:00:00" is read by Postgres in
 * UTC, which cut the first and last day 1-2 hours off.)
 */
export function invoiceDateRange(dateFrom?: string | null, dateTo?: string | null): { from?: string; to?: string } {
  return {
    from: dateFrom && DATE_RE.test(dateFrom) ? ljDayBounds(dateFrom).start.toISOString() : undefined,
    to: dateTo && DATE_RE.test(dateTo) ? ljDayBounds(dateTo).end.toISOString() : undefined,
  }
}
