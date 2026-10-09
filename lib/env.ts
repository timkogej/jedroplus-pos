/**
 * Environment sanity check. A missing variable otherwise shows up much later as
 * a confusing runtime error (e.g. certificates that cannot be decrypted, Stripe
 * calls failing). Logged at startup (instrumentation.ts) and reported by
 * /api/health. Only variable NAMES are ever reported — never values.
 */
export const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'CERTIFICATE_ENCRYPTION_KEY',
  'CRON_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_POS_PLUS_MONTHLY',
  'STRIPE_POS_PLUS_YEARLY',
  'STRIPE_POS_PRO_MONTHLY',
  'STRIPE_POS_PRO_YEARLY',
  'RESEND_API_KEY',
  'FURS_TEST_URL',
  'FURS_PRODUCTION_URL',
  'FURS_SOFTWARE_SUPPLIER_TAX_NUMBER',
] as const

export interface EnvReport {
  missing: string[]
  warnings: string[]
}

export function checkEnv(env: Record<string, string | undefined> = process.env): EnvReport {
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim())
  const warnings: string[] = []
  const production = env.NODE_ENV === 'production'

  if (production && env.RESEND_TEST_TO) {
    warnings.push('RESEND_TEST_TO je nastavljen: VSA e-pošta se pošilja na ta naslov namesto strankam')
  }
  if (env.FURS_TLS_INSECURE === 'true') {
    warnings.push('FURS_TLS_INSECURE=true: preverjanje TLS pri FURS v produkciji je izklopljeno')
  }
  if (env.FURS_DEBUG === 'true') {
    warnings.push('FURS_DEBUG=true: v dnevnike se izpisujejo podpisani XML in odgovori FURS')
  }
  if (env.CERTIFICATE_ENCRYPTION_KEY && env.CERTIFICATE_ENCRYPTION_KEY.length < 32) {
    warnings.push('CERTIFICATE_ENCRYPTION_KEY je krajši od 32 znakov')
  }
  if (!env.PORTAL_ORIGINS?.trim()) {
    warnings.push('PORTAL_ORIGINS ni nastavljen: portal za stranke ne bo mogel klicati API-ja')
  }
  return { missing, warnings }
}
