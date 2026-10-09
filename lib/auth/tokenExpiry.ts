/**
 * Seconds until the Supabase access token in the session cookie expires, read
 * WITHOUT verifying it — or null if there is no readable session cookie.
 *
 * Used only by the middleware to decide whether a (network) token refresh is
 * needed at all. It makes no authorization decision: pages still verify the user
 * with auth.getUser() (lib/auth/serverCompany.ts), so a forged cookie gains
 * nothing here.
 */
function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function accessTokenSecondsLeft(
  cookies: Array<{ name: string; value: string }>,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): number | null {
  try {
    const authCookies = cookies.filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    if (authCookies.length === 0) return null

    // The session can be split into numbered chunks (name.0, name.1, …).
    const base = authCookies[0].name.replace(/\.\d+$/, '')
    const parts = authCookies
      .filter((c) => c.name.replace(/\.\d+$/, '') === base)
      .sort((a, b) => Number(a.name.split('.').pop() ?? 0) - Number(b.name.split('.').pop() ?? 0))

    let raw = parts.map((p) => p.value).join('')
    if (raw.startsWith('base64-')) raw = decodeBase64Url(raw.slice('base64-'.length))

    const session = JSON.parse(raw) as { access_token?: string }
    const token = session.access_token
    if (!token) return null

    const payload = JSON.parse(decodeBase64Url(token.split('.')[1])) as { exp?: number }
    if (typeof payload.exp !== 'number') return null
    return payload.exp - nowSeconds
  } catch {
    return null
  }
}
