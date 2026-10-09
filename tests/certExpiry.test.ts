import { describe, it, expect } from 'vitest'
import { certExpiryStatus, shouldEmailCertWarning } from '@/lib/furs/certExpiry'

const now = new Date('2026-10-09T12:00:00Z')
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000 + 3_600_000)

describe('certificate expiry', () => {
  it('is fine far from expiry', () => {
    expect(certExpiryStatus(inDays(120), now)).toMatchObject({ state: 'ok' })
  })

  it('warns within 30 days and counts whole days', () => {
    expect(certExpiryStatus(inDays(30), now)).toEqual({ state: 'expiring', daysLeft: 30 })
    expect(certExpiryStatus(inDays(7), now)).toEqual({ state: 'expiring', daysLeft: 7 })
  })

  it('is expired once the end has passed', () => {
    expect(certExpiryStatus(new Date('2026-10-01T00:00:00Z'), now)?.state).toBe('expired')
  })

  it('handles missing or invalid dates', () => {
    expect(certExpiryStatus(null, now)).toBeNull()
    expect(certExpiryStatus('nonsense', now)).toBeNull()
  })

  it('emails on 30/14/7/3/2/1/0 days before expiry, not on other days', () => {
    for (const d of [30, 14, 7, 3, 2, 1, 0]) {
      expect(shouldEmailCertWarning({ state: 'expiring', daysLeft: d })).toBe(true)
    }
    for (const d of [29, 20, 10, 5]) {
      expect(shouldEmailCertWarning({ state: 'expiring', daysLeft: d })).toBe(false)
    }
    expect(shouldEmailCertWarning({ state: 'ok', daysLeft: 200 })).toBe(false)
  })

  it('keeps nagging about an expired certificate, weekly after the first day', () => {
    expect(shouldEmailCertWarning({ state: 'expired', daysLeft: -1 })).toBe(true)
    expect(shouldEmailCertWarning({ state: 'expired', daysLeft: -3 })).toBe(false)
    expect(shouldEmailCertWarning({ state: 'expired', daysLeft: -7 })).toBe(true)
  })
})
