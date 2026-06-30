import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import { getPointsBalance, normalizeEmail } from '@/lib/loyalty/balance'
import { getLoyaltySettings } from '@/lib/loyalty/award'
import { createServiceClient } from '@/lib/supabase'

/**
 * Locks in a loyalty redemption: validates the client has enough points, then
 * writes a negative 'redeemed' ledger row. Returns the discount amount and the
 * ledger row id (so the caller can link it to an invoice on creation).
 *
 * Reused later by the booking system, which adds an email-verification step on
 * top — not needed for POS, where staff is present in person.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { companyId, clientEmail, pointsToRedeem, invoiceId } = body as {
      companyId?: string
      clientEmail?: string
      pointsToRedeem?: number
      invoiceId?: string | null
    }

    const auth = await requireCompanyAccess(req, companyId)
    if ('response' in auth) return auth.response

    const points = Math.floor(Number(pointsToRedeem))
    if (!clientEmail || !normalizeEmail(clientEmail)) {
      return NextResponse.json({ error: 'Manjka e-poštni naslov stranke' }, { status: 400 })
    }
    if (!Number.isFinite(points) || points <= 0) {
      return NextResponse.json({ error: 'Neveljavno število točk' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const settings = await getLoyaltySettings(supabase, companyId!)
    if (!settings.loyalty_enabled) {
      return NextResponse.json({ error: 'Loyalty program ni omogočen' }, { status: 400 })
    }

    const balance = await getPointsBalance(companyId!, clientEmail, supabase)
    if (points > balance) {
      return NextResponse.json(
        { error: `Stranka nima dovolj točk (na voljo: ${balance})` },
        { status: 400 }
      )
    }

    // If an invoice number is provided/derivable, use it in the description.
    let invoiceNumber: string | null = null
    if (invoiceId) {
      const { data: inv } = await supabase
        .from('pos_invoices')
        .select('invoice_number')
        .eq('id', invoiceId)
        .maybeSingle()
      invoiceNumber = inv?.invoice_number ?? null
    }

    const { data: record, error } = await supabase
      .from('pos_loyalty_points')
      .insert({
        company_id: companyId,
        client_email: normalizeEmail(clientEmail),
        type: 'redeemed',
        points: -points,
        invoice_id: invoiceId ?? null,
        description: invoiceNumber
          ? `Unovceno pri racunu ${invoiceNumber}`
          : 'Unovceno (loyalty)',
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      recordId: record.id,
      points,
      discountAmount: points * settings.loyalty_redeem_value,
      newBalance: balance - points,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
