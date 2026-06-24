import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Auth is handled client-side by AuthGuard (which calls supabase.auth.getUser()).
// The browser Supabase client stores sessions in localStorage, not cookies, so
// middleware cannot read the session — the cookie check would always fail and
// redirect every logged-in user back to /login.
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts).*)'],
}
