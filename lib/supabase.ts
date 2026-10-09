import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase-config'

// Browser client. The session is stored in cookies (not localStorage) so the
// server can authenticate page requests too — see lib/auth/serverCompany.ts.
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Server-only client — service role, no session persistence.
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  })
}
