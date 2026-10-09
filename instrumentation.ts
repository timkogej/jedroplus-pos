// Runs once when the server starts. Logs configuration problems loudly so a bad
// deploy is obvious in the Vercel logs instead of failing later in odd ways.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { checkEnv } = await import('@/lib/env')
  const { missing, warnings } = checkEnv()
  if (missing.length > 0) {
    console.error(`[env] MANJKAJOČE spremenljivke okolja: ${missing.join(', ')}`)
  }
  for (const w of warnings) console.warn(`[env] ${w}`)
}
