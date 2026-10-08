// Shared public Supabase config (URL + anon key are safe to expose; RLS and the
// server-side checks in lib/auth protect the data). Hardcoded fallbacks keep the
// client connecting even if env vars aren't picked up (dev server started
// before .env.local was written).
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xdudtawctybnphdpvlwu.supabase.co'
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdWR0YXdjdHlibnBoZHB2bHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0Mzg2NzMsImV4cCI6MjA3NDAxNDY3M30.zpvaAhMfY2uQBt0GGyCIPceIWuOfA5rqJ9MvvxKvycs'
