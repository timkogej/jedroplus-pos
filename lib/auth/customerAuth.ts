import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * Customer (portal) authentication. A customer signs in to the portal with
 * Supabase Auth (email + one-time token), and the portal calls /api/portal/*
 * with that session's access token as a Bearer header.
 *
 * Identity comes ONLY from the verified token: the email is read from the JWT
 * (never from the request body or query string), so a customer can only ever
 * see their own data. A customer token grants no access to staff routes — those
 * additionally require profiles.default_company_id (lib/auth/apiAuth.ts).
 */
export interface AuthedCustomer {
  userId: string
  email: string
}

export async function authenticateCustomer(
  req: NextRequest,
  headers: Record<string, string>
): Promise<{ customer: AuthedCustomer } | { response: NextResponse }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!token) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers }) }
  }

  const supabase = createServiceClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  // The email must be verified — the one-time token flow confirms it, but an
  // account created some other way with an unverified address must not read
  // the data of whoever owns that address.
  if (error || !user?.email || !(user.email_confirmed_at ?? user.confirmed_at)) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers }) }
  }

  return { customer: { userId: user.id, email: user.email.trim().toLowerCase() } }
}
