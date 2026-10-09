import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createServiceClient: () => ({ rpc: h.rpc }), supabase: {} }))

import { rateLimitDb } from '@/lib/rate-limit'

beforeEach(() => h.rpc.mockReset())

describe('rateLimitDb', () => {
  it('asks the database and passes the window in seconds', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null })
    expect(await rateLimitDb('k1', 5, 60_000)).toBe(true)
    expect(h.rpc).toHaveBeenCalledWith('rate_limit_hit', { p_key: 'k1', p_limit: 5, p_window_seconds: 60 })
  })

  it('blocks when the database says the limit is exceeded', async () => {
    h.rpc.mockResolvedValue({ data: false, error: null })
    expect(await rateLimitDb('k2', 5, 60_000)).toBe(false)
  })

  it('falls back to the in-memory limiter (instead of failing open or closed) when the database errors', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'down' } })
    const results = []
    for (let i = 0; i < 4; i++) results.push(await rateLimitDb('fallback-key', 3, 60_000))
    expect(results).toEqual([true, true, true, false])
  })
})
