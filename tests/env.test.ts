import { describe, it, expect } from 'vitest'
import { checkEnv, REQUIRED_ENV } from '@/lib/env'

const full = () => Object.fromEntries(REQUIRED_ENV.map((n) => [n, 'x'.repeat(40)]))

describe('checkEnv', () => {
  it('passes when everything is set (portal origin aside)', () => {
    const r = checkEnv({ ...full(), PORTAL_ORIGINS: 'https://portal.jedroplus.com' })
    expect(r.missing).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it('lists missing variables by name only', () => {
    const e = full() as Record<string, string | undefined>
    delete e.CERTIFICATE_ENCRYPTION_KEY
    e.STRIPE_SECRET_KEY = '   '
    const r = checkEnv(e)
    expect(r.missing).toEqual(expect.arrayContaining(['CERTIFICATE_ENCRYPTION_KEY', 'STRIPE_SECRET_KEY']))
    expect(JSON.stringify(r)).not.toContain('xxxx')
  })

  it('warns about risky settings in production', () => {
    const r = checkEnv({ ...full(), PORTAL_ORIGINS: 'https://p', NODE_ENV: 'production', RESEND_TEST_TO: 'me@x.si', FURS_TLS_INSECURE: 'true' })
    expect(r.warnings.join(' ')).toMatch(/RESEND_TEST_TO/)
    expect(r.warnings.join(' ')).toMatch(/FURS_TLS_INSECURE/)
  })

  it('warns about a short encryption key', () => {
    const r = checkEnv({ ...full(), PORTAL_ORIGINS: 'https://p', CERTIFICATE_ENCRYPTION_KEY: 'short' })
    expect(r.warnings.join(' ')).toMatch(/32/)
  })
})
