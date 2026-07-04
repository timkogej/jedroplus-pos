import { NextRequest, NextResponse } from 'next/server'
import { checkFursConnection, getActiveCertificate, getFursEnvironment } from '@/lib/furs/api'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'

/**
 * FURS connection status for the sidebar indicator and the certificate page.
 * Returns only non-sensitive certificate metadata — never key material.
 */
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get('company_id') ?? ''
    if (!companyId) {
      return NextResponse.json({ error: 'Manjka company_id' }, { status: 400 })
    }

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    const environment = await getFursEnvironment(companyId)

    let cert
    try {
      cert = await getActiveCertificate(companyId)
    } catch (err) {
      return NextResponse.json({
        status: 'error',
        environment,
        message: err instanceof Error ? err.message : 'Napaka pri branju certifikata',
      })
    }

    if (!cert) {
      return NextResponse.json({ status: 'demo', environment })
    }

    if (cert.isExpired) {
      return NextResponse.json({
        status: 'error',
        environment,
        message: 'Certifikat je potekel',
        validTo: cert.validTo.toISOString(),
        taxNumber: cert.taxNumber,
      })
    }

    const reachable = await checkFursConnection(environment)

    return NextResponse.json({
      status: reachable ? 'connected' : 'error',
      environment,
      message: reachable ? null : 'Povezava s FURS ni uspela',
      validTo: cert.validTo.toISOString(),
      taxNumber: cert.taxNumber,
      isExpiringSoon: cert.isExpiringSoon,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
