/**
 * Slovenian wall-clock helpers. The server runs in UTC (Vercel), but FURS
 * (IssueDateTime, ZOI), the daily Z-report cut-off and printed receipt times
 * all mean Europe/Ljubljana local time. Never use Date#getHours()/getDate()
 * for those — use these instead.
 */
export const TIME_ZONE = 'Europe/Ljubljana'

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export interface LjParts {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
}

export function ljParts(date: Date): LjParts {
  const p: Record<string, number> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "YYYY-MM-DD" in Slovenian local time. */
export function ljDateString(date: Date = new Date()): string {
  const p = ljParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

export function ljYear(date: Date = new Date()): number {
  return ljParts(date).year
}

/** The UTC instant at which Slovenian local midnight of `dateStr` (YYYY-MM-DD) occurs. */
export function ljMidnightUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0)
  const p = ljParts(new Date(guess))
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess
  return new Date(guess - offset)
}

/** [start, end) of a Slovenian calendar day (handles 23h/25h DST days). */
export function ljDayBounds(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const nextStr = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
  return { start: ljMidnightUtc(dateStr), end: ljMidnightUtc(nextStr) }
}

/** "dd.MM.yyyy HH:mm:ss" in Slovenian local time (FURS ZOI input format). */
export function ljZoiDateTime(date: Date): string {
  const p = ljParts(date)
  return `${pad(p.day)}.${pad(p.month)}.${p.year} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`
}

/** ISO 8601 without zone suffix, Slovenian local time (FURS XML datetimes). */
export function ljIsoLocal(date: Date): string {
  const p = ljParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`
}
