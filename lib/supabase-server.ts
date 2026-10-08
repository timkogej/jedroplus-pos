import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase-config'

/**
 * Supabase client bound to the request's session cookies. Use it ONLY to find
 * out who is logged in (auth.getUser()); data access goes through the service
 * client after an explicit authorization check.
 */
export function createSessionClient() {
  const cookieStore = cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component — cookies are refreshed by middleware instead.
        }
      },
    },
  })
}
