import { createClient } from '@supabase/supabase-js'

// Hardcoded fallbacks so the client always connects even if env vars aren't
// picked up (e.g. dev server started before .env.local was written).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xdudtawctybnphdpvlwu.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdWR0YXdjdHlibnBoZHB2bHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0Mzg2NzMsImV4cCI6MjA3NDAxNDY3M30.zpvaAhMfY2uQBt0GGyCIPceIWuOfA5rqJ9MvvxKvycs'

if (typeof window !== 'undefined') {
  console.log('[supabase] URL:', SUPABASE_URL)
  console.log('[supabase] anon key loaded:', SUPABASE_ANON_KEY.slice(0, 20) + '...')
}

// Browser client — no global header override so auth requests flow normally.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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
