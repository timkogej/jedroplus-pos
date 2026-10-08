import { NextRequest, NextResponse } from 'next/server'

/**
 * CORS for the customer portal, which runs on its own origin. Allowed origins
 * come from PORTAL_ORIGINS (comma-separated, e.g. "https://portal.jedroplus.si")
 * plus localhost for development. Unknown origins get no CORS headers at all.
 */
function allowedOrigins(): string[] {
  const configured = (process.env.PORTAL_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  return [...configured, 'http://localhost:3000', 'http://localhost:5173']
}

export function portalCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin')
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
  if (origin && allowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

export function portalOptions(req: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: portalCorsHeaders(req) })
}
