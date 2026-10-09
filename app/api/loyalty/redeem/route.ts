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

    // Atomic: lock + re-check balance + insert in one DB transaction, so two
    // parallel requests can never spend the same points.
    let invoiceNumber: string | null = null
    if (invoiceId) {
      const { data: inv } = await supabase
        .from('pos_invoices')
        .select('invoice_number')
        .eq('id', invoiceId)
        .eq('company_id', companyId!)
        .maybeSingle()
      invoiceNumber = inv?.invoice_number ?? null
    }

    const { data: recordId, error } = await supabase.rpc('loyalty_redeem', {
      p_company: companyId,
      p_email: normalizeEmail(clientEmail),
      p_points: points,
      p_invoice: invoiceNumber ? invoiceId : null,
      p_description: invoiceNumber ? `Unovceno pri racunu ${invoiceNumber}` : 'Unovceno (loyalty)',
    })

    if (error) {
      const insufficient = /nima dovolj/i.test(error.message)
      return NextResponse.json({ error: error.message }, { status: insufficient ? 400 : 500 })
    }

    const balance = await getPointsBalance(companyId!, clientEmail, supabase)

    return NextResponse.json({
      recordId,
      points,
      discountAmount: points * settings.loyalty_redeem_value,
      newBalance: balance,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
