import { describe, it, expect } from 'vitest'
import { accessTokenSecondsLeft } from '@/lib/auth/tokenExpiry'

const b64url = (s: string) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (exp: number) => `${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify({ exp }))}.sig`
const NOW = 1_800_000_000

describe('accessTokenSecondsLeft', () => {
  it('reads the expiry from a plain JSON session cookie', () => {
    const value = JSON.stringify({ access_token: jwt(NOW + 3000) })
    expect(accessTokenSecondsLeft([{ name: 'sb-abc-auth-token', value }], NOW)).toBe(3000)
  })

  it('reads a base64-encoded session cookie', () => {
    const value = 'base64-' + b64url(JSON.stringify({ access_token: jwt(NOW + 120) }))
    expect(accessTokenSecondsLeft([{ name: 'sb-abc-auth-token', value }], NOW)).toBe(120)
  })

  it('joins chunked cookies in order', () => {
    const full = JSON.stringify({ access_token: jwt(NOW + 500) })
    const mid = Math.floor(full.length / 2)
    const cookies = [
      { name: 'sb-abc-auth-token.1', value: full.slice(mid) },
      { name: 'sb-abc-auth-token.0', value: full.slice(0, mid) },
    ]
    expect(accessTokenSecondsLeft(cookies, NOW)).toBe(500)
  })

  it('is negative once expired, so a refresh happens', () => {
    const value = JSON.stringify({ access_token: jwt(NOW - 10) })
    expect(accessTokenSecondsLeft([{ name: 'sb-abc-auth-token', value }], NOW)).toBe(-10)
  })

  it('returns null (=> refresh/verify via Supabase) when there is no usable session', () => {
    expect(accessTokenSecondsLeft([], NOW)).toBeNull()
    expect(accessTokenSecondsLeft([{ name: 'other', value: 'x' }], NOW)).toBeNull()
    expect(accessTokenSecondsLeft([{ name: 'sb-abc-auth-token', value: 'garbage' }], NOW)).toBeNull()
  })
})
