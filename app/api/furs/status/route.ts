import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { checkFursEcho, getActiveCertificate, getFursEnvironment } from '@/lib/furs/api'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'

/**
 * FURS connection status for the sidebar indicator and the certificate page.
 * Returns only non-sensitive certificate metadata — never key material.
 */
async function computeStatus(companyId: string) {
  const environment = await getFursEnvironment(companyId)

  let cert
  try {
    cert = await getActiveCertificate(companyId)
  } catch (err) {
    return {
      status: 'error' as const,
      environment,
      message: err instanceof Error ? err.message : 'Napaka pri branju certifikata',
    }
  }

  if (!cert) return { status: 'demo' as const, environment }

  if (cert.isExpired) {
    return {
      status: 'error' as const,
      environment,
      message: 'Certifikat je potekel',
      validTo: cert.validTo.toISOString(),
      taxNumber: cert.taxNumber,
    }
  }

  const reachable = await checkFursEcho(environment, cert)

  return {
    status: (reachable ? 'connected' : 'error') as 'connected' | 'error',
    environment,
    message: reachable ? null : 'Povezava s FURS ni uspela',
    validTo: cert.validTo.toISOString(),
    taxNumber: cert.taxNumber,
    isExpiringSoon: cert.isExpiringSoon,
  }
}

// Decrypting + parsing the certificate and a real round trip to FURS are
// expensive, and the indicator asks on every page load — reuse the answer for
// 5 minutes (cleared when a certificate is uploaded).
const getCachedStatus = unstable_cache(computeStatus, ['furs-status'], {
  revalidate: 300,
  tags: ['furs-status'],
})

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get('company_id') ?? ''
    if (!companyId) {
      return NextResponse.json({ error: 'Manjka company_id' }, { status: 400 })
    }

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    // ?fresh=1 (certificate page, right after uploading) bypasses the cache.
    const fresh = req.nextUrl.searchParams.get('fresh') === '1'
    return NextResponse.json(fresh ? await computeStatus(companyId) : await getCachedStatus(companyId))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
