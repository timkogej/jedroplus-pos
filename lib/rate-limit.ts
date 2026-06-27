import { NextRequest } from 'next/server'

/**
 * Tiny in-memory fixed-window rate limiter. Good enough for a single-instance
 * deployment; swap for @upstash/ratelimit if the app is scaled horizontally
 * (a Map is per-process and won't be shared across instances).
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) return false

  record.count++
  return true
}

/** Best-effort client IP extraction from common proxy headers. */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

// Periodically drop expired entries so the Map doesn't grow unbounded.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
declare global {
  // eslint-disable-next-line no-var
  var __rateLimitCleanup: ReturnType<typeof setInterval> | undefined
}
if (!globalThis.__rateLimitCleanup) {
  globalThis.__rateLimitCleanup = setInterval(() => {
    const now = Date.now()
    rateLimitMap.forEach((record, key) => {
      if (now > record.resetTime) rateLimitMap.delete(key)
    })
  }, CLEANUP_INTERVAL_MS)
  // Don't keep the event loop alive just for cleanup.
  if (typeof globalThis.__rateLimitCleanup.unref === 'function') {
    globalThis.__rateLimitCleanup.unref()
  }
}
