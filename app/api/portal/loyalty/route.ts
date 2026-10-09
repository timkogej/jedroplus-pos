import { NextRequest, NextResponse } from 'next/server'
import { authenticateCustomer } from '@/lib/auth/customerAuth'
import { portalCorsHeaders, portalOptions } from '@/lib/portalCors'
import { createServiceClient } from '@/lib/supabase'
import { getLoyaltySettings } from '@/lib/loyalty/award'
import { getPointsBalance } from '@/lib/loyalty/balance'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export function OPTIONS(req: NextRequest) {
  return portalOptions(req)
}

/**
 * GET /api/portal/loyalty?companySlug=...
 * The signed-in customer's loyalty balance and recent history at one company.
 */
export async function GET(req: NextRequest) {
  const headers = portalCorsHeaders(req)

  const auth = await authenticateCustomer(req, headers)
  if ('response' in auth) return auth.response
  const { customer } = auth

  if (!rateLimit(`portal:loyalty:${customer.userId}`, 60, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers })
  }

  const slug = req.nextUrl.searchParams.get('companySlug')
  if (!slug) return NextResponse.json({ error: 'Manjka companySlug' }, { status: 400, headers })

  const supabase = createServiceClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (!company) return NextResponse.json({ error: 'Podjetje ni najdeno' }, { status: 404, headers })

  const settings = await getLoyaltySettings(supabase, company.id)
  if (!settings.loyalty_enabled) {
    return NextResponse.json({ enabled: false, balance: 0, value: 0, history: [] }, { headers })
  }

  const [balance, { data: rows }] = await Promise.all([
    getPointsBalance(company.id, customer.email, supabase),
    supabase
      .from('pos_loyalty_points')
      .select('type, points, description, created_at')
      .eq('company_id', company.id)
      .eq('client_email', customer.email)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return NextResponse.json(
    {
      enabled: true,
      balance,
      value: Math.round(balance * settings.loyalty_redeem_value * 100) / 100,
      earnRate: settings.loyalty_earn_rate, // points per 1 EUR
      redeemValue: settings.loyalty_redeem_value, // EUR per point
      history: rows ?? [],
    },
    { headers }
  )
}
