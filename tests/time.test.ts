import { describe, it, expect } from 'vitest'
import { ljZoiDateTime, ljIsoLocal, ljDateString, ljDayBounds } from '@/lib/time'

describe('Slovenian time helpers', () => {
  it('uses CET in winter and CEST in summer', () => {
    expect(ljZoiDateTime(new Date('2026-01-15T11:30:00Z'))).toBe('15.01.2026 12:30:00')
    expect(ljZoiDateTime(new Date('2026-07-15T11:30:00Z'))).toBe('15.07.2026 13:30:00')
  })

  it('rolls the date at local midnight, not UTC midnight', () => {
    expect(ljDateString(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01')
    expect(ljIsoLocal(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01T00:30:00')
  })

  it('day bounds start at local midnight', () => {
    expect(ljDayBounds('2026-01-15').start.toISOString()).toBe('2026-01-14T23:00:00.000Z')
    expect(ljDayBounds('2026-07-15').start.toISOString()).toBe('2026-07-14T22:00:00.000Z')
  })

  it('handles 23h and 25h DST days', () => {
    const hours = (d: string) => {
      const { start, end } = ljDayBounds(d)
      return (end.getTime() - start.getTime()) / 3_600_000
    }
    expect(hours('2026-03-29')).toBe(23)
    expect(hours('2026-10-25')).toBe(25)
    expect(hours('2026-05-10')).toBe(24)
  })
})
