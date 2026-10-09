export type CertExpiryState = 'ok' | 'expiring' | 'expired'

export interface CertExpiryStatus {
  state: CertExpiryState
  /** Whole days until expiry (negative once expired). */
  daysLeft: number
}

/** Warn this many days before the certificate expires. */
export const CERT_WARNING_DAYS = 30

/** Days-before-expiry on which the daily cron sends an email. */
export const CERT_EMAIL_DAYS = [30, 14, 7, 3, 2, 1, 0]

export function certExpiryStatus(validTo: string | Date | null | undefined, now: Date = new Date()): CertExpiryStatus | null {
  if (!validTo) return null
  const end = new Date(validTo).getTime()
  if (!Number.isFinite(end)) return null
  const daysLeft = Math.floor((end - now.getTime()) / 86_400_000)
  if (end <= now.getTime()) return { state: 'expired', daysLeft }
  return { state: daysLeft <= CERT_WARNING_DAYS ? 'expiring' : 'ok', daysLeft }
}

/** Should the daily cron send an email today? Expired certificates keep nagging weekly. */
export function shouldEmailCertWarning(status: CertExpiryStatus): boolean {
  if (status.state === 'ok') return false
  if (status.state === 'expired') return status.daysLeft === -1 || (status.daysLeft < 0 && Math.abs(status.daysLeft) % 7 === 0)
  return CERT_EMAIL_DAYS.includes(status.daysLeft)
}
