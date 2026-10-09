import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase-config'
import { accessTokenSecondsLeft } from '@/lib/auth/tokenExpiry'

// Keeps the Supabase session cookie fresh so Server Components can trust
// auth.getUser(). Actual authorization (is this user allowed to see this
// company?) happens in lib/auth/serverCompany.ts, not here. /api routes use
// Bearer tokens and are excluded.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  // A token that is still valid for a while needs no refresh, so skip the call to
  // Supabase Auth — it used to run on EVERY navigation and prefetch (one extra
  // network round trip each time). Without a readable session it falls through.
  const secondsLeft = accessTokenSecondsLeft(request.cookies.getAll())
  if (secondsLeft !== null && secondsLeft > 90) return response

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts|api).*)'],
}
