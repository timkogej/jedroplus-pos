import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { certExpiryStatus, shouldEmailCertWarning } from '@/lib/furs/certExpiry'
import { sendCertExpiryEmail } from '@/lib/furs/certExpiryEmail'

export const dynamic = 'force-dynamic'

/**
 * Daily cron (CRON_SECRET): emails companies whose active FURS certificate is
 * about to expire or already has. Same auth as the other cron endpoints.
 */
export async function GET(req: NextRequest) {
  return handle(req)
}
export async function POST(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: certs } = await supabase
    .from('pos_certificates')
    .select('company_id, valid_to')
    .eq('is_active', true)

  const results: Array<{ companyId: string; sent: boolean; reason?: string }> = []

  for (const cert of certs ?? []) {
    const companyId = cert.company_id as string
    const status = certExpiryStatus(cert.valid_to as string | null)
    if (!status || !shouldEmailCertWarning(status)) continue

    const [{ data: company }, { data: companyData }] = await Promise.all([
      supabase.from('companies').select('slug, name').eq('id', companyId).maybeSingle(),
      supabase.from('pos_company_data').select('email, company_name').eq('company_id', companyId).maybeSingle(),
    ])
    if (!company || !companyData?.email) {
      results.push({ companyId, sent: false, reason: 'no-email' })
      continue
    }

    const r = await sendCertExpiryEmail({
      to: companyData.email,
      companyName: companyData.company_name ?? company.name,
      slug: company.slug,
      validTo: cert.valid_to as string,
      status,
    })
    results.push({ companyId, sent: r.success, reason: r.error })
  }

  return NextResponse.json({ checked: certs?.length ?? 0, notified: results.filter((r) => r.sent).length, results })
}
