import { supabase } from '@/lib/supabase'

/**
 * Browser fetch wrapper that attaches the logged-in user's Supabase access
 * token as a Bearer Authorization header. Use this for every call to our own
 * /api routes so the server can authenticate the request.
 *
 * Existing headers are preserved, so it's safe with JSON bodies and FormData
 * uploads alike (we never set Content-Type here).
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = new Headers(init.headers)
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  return fetch(input, { ...init, headers })
}
