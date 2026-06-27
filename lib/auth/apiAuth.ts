import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * Server-side API authentication + authorization helpers.
 *
 * Every protected API route must:
 *  1. verify the caller is a logged-in user (valid Supabase access token), and
 *  2. verify that user is actually attached to the company whose data the
 *     request touches.
 *
 * The service-role client bypasses RLS, so without (2) an authenticated user
 * of company A could pass company B's id in the request body and read/write
 * B's data. These helpers close that hole.
 */

export interface AuthedUser {
  id: string
  email: string | null
}

/** Pulls the bearer token from the Authorization header. */
function getBearerToken(req: NextRequest): string {
  return req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
}

/**
 * Validates the request's bearer token. Returns the user on success, or a ready
 * to return 401 NextResponse on failure.
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<{ user: AuthedUser } | { response: NextResponse }> {
  const token = getBearerToken(req)
  if (!token) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const supabase = createServiceClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return { user: { id: user.id, email: user.email ?? null } }
}

/** Resolves the company a user is attached to (profiles.default_company_id). */
export async function getUserCompanyId(userId: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('default_company_id')
    .eq('id', userId)
    .single()
  return (data?.default_company_id as string | undefined) ?? null
}

/**
 * Authenticates the request AND checks the user owns `companyId`.
 * Returns the user, or a 401/403 NextResponse to return immediately.
 */
export async function requireCompanyAccess(
  req: NextRequest,
  companyId: string | null | undefined
): Promise<{ user: AuthedUser } | { response: NextResponse }> {
  const auth = await authenticateRequest(req)
  if ('response' in auth) return auth

  if (!companyId) {
    return { response: NextResponse.json({ error: 'Manjka companyId' }, { status: 400 }) }
  }

  const ownCompanyId = await getUserCompanyId(auth.user.id)
  if (!ownCompanyId || ownCompanyId !== companyId) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user: auth.user }
}

/**
 * Authenticates the request AND checks the user owns the company that the given
 * invoice belongs to. Returns the invoice's company_id alongside the user.
 */
export async function requireInvoiceAccess(
  req: NextRequest,
  invoiceId: string
): Promise<{ user: AuthedUser; companyId: string } | { response: NextResponse }> {
  const auth = await authenticateRequest(req)
  if ('response' in auth) return auth

  const supabase = createServiceClient()
  const { data: invoice } = await supabase
    .from('pos_invoices')
    .select('company_id')
    .eq('id', invoiceId)
    .maybeSingle()

  if (!invoice) {
    return { response: NextResponse.json({ error: 'Račun ni najden' }, { status: 404 }) }
  }

  const ownCompanyId = await getUserCompanyId(auth.user.id)
  if (!ownCompanyId || ownCompanyId !== invoice.company_id) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user: auth.user, companyId: invoice.company_id as string }
}
