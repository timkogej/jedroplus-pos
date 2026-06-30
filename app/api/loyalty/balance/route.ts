import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { getPointsBalance } from '@/lib/loyalty/balance'
import { getLoyaltySettings } from '@/lib/loyalty/award'
import { createServiceClient } from '@/lib/supabase'

/**
 * Returns a client's current loyalty balance + its EUR value.
 * Reused later by the booking system.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { companyId, clientEmail } = body as { companyId?: string; clientEmail?: string }

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    if (!clientEmail) {
      return NextResponse.json({ balance: 0, value: 0, enabled: false })
    }

    const supabase = createServiceClient()
    const settings = await getLoyaltySettings(supabase, companyId!)
    const balance = await getPointsBalance(companyId!, clientEmail, supabase)

    return NextResponse.json({
      balance,
      value: balance * settings.loyalty_redeem_value,
      redeemValue: settings.loyalty_redeem_value,
      enabled: settings.loyalty_enabled,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
