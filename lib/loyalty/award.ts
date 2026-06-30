import type { SupabaseClient } from '@supabase/supabase-js'
import { getPointsBalance, normalizeEmail } from '@/lib/loyalty/balance'

export interface LoyaltySettings {
  loyalty_enabled: boolean
  loyalty_earn_rate: number
  loyalty_redeem_value: number
}

const DEFAULTS: LoyaltySettings = {
  loyalty_enabled: false,
  loyalty_earn_rate: 1,
  loyalty_redeem_value: 0.05,
}

/** Loads loyalty config for a company, falling back to defaults. */
export async function getLoyaltySettings(
  supabase: SupabaseClient,
  companyId: string
): Promise<LoyaltySettings> {
  const { data } = await supabase
    .from('pos_settings')
    .select('loyalty_enabled, loyalty_earn_rate, loyalty_redeem_value')
    .eq('company_id', companyId)
    .maybeSingle()

  return {
    loyalty_enabled: data?.loyalty_enabled ?? DEFAULTS.loyalty_enabled,
    loyalty_earn_rate: data?.loyalty_earn_rate ?? DEFAULTS.loyalty_earn_rate,
    loyalty_redeem_value: data?.loyalty_redeem_value ?? DEFAULTS.loyalty_redeem_value,
  }
}

/**
 * Awards earned points for a freshly created (non-storno) invoice, if the
 * loyalty program is enabled and the buyer has an email. Idempotent per
 * invoice: won't insert a second 'earned' row for the same invoice_id.
 * Returns the awarded points + the buyer's new balance, or null if nothing
 * was awarded.
 */
export async function awardPointsForInvoice(
  supabase: SupabaseClient,
  params: {
    companyId: string
    clientEmail: string | null | undefined
    clientId?: string | null
    invoiceId: string
    invoiceNumber: string
    total: number
    settings?: LoyaltySettings
  }
): Promise<{ points: number; newBalance: number } | null> {
  const { companyId, invoiceId, invoiceNumber, total, clientId } = params
  if (!params.clientEmail) return null
  const email = normalizeEmail(params.clientEmail)
  if (!email) return null

  // Never award on storno / negative-amount invoices.
  if (total <= 0) return null

  const settings = params.settings ?? (await getLoyaltySettings(supabase, companyId))
  if (!settings.loyalty_enabled) return null

  const points = Math.floor(total * settings.loyalty_earn_rate)
  if (points <= 0) return null

  // Guard against double-award (e.g. duplicate webhook delivery).
  const { data: existing } = await supabase
    .from('pos_loyalty_points')
    .select('id')
    .eq('invoice_id', invoiceId)
    .eq('type', 'earned')
    .maybeSingle()
  if (existing) {
    return { points, newBalance: await getPointsBalance(companyId, email, supabase) }
  }

  const { error } = await supabase.from('pos_loyalty_points').insert({
    company_id: companyId,
    client_id: clientId ?? null,
    client_email: email,
    type: 'earned',
    points,
    invoice_id: invoiceId,
    description: `Zasluzeno za racun ${invoiceNumber}`,
  })
  if (error) {
    console.error('[loyalty] award insert failed:', error.message)
    return null
  }

  return { points, newBalance: await getPointsBalance(companyId, email, supabase) }
}

/**
 * Reverses points earned for an invoice that has been storno'd. Finds the
 * 'earned' record for the original invoice and inserts an offsetting
 * 'redeemed' (negative) record. No-op if nothing was earned or it was already
 * reversed.
 */
export async function reversePointsForStorno(
  supabase: SupabaseClient,
  params: { companyId: string; originalInvoiceId: string; originalInvoiceNumber: string }
): Promise<void> {
  const { companyId, originalInvoiceId, originalInvoiceNumber } = params

  const { data: earned } = await supabase
    .from('pos_loyalty_points')
    .select('id, client_email, client_id, points')
    .eq('company_id', companyId)
    .eq('invoice_id', originalInvoiceId)
    .eq('type', 'earned')
    .maybeSingle()

  if (!earned || earned.points <= 0) return

  // Already reversed? Look for an existing storno-reversal redeemed row.
  const { data: reversal } = await supabase
    .from('pos_loyalty_points')
    .select('id')
    .eq('company_id', companyId)
    .eq('invoice_id', originalInvoiceId)
    .eq('type', 'redeemed')
    .ilike('description', 'Odbitek zaradi storna%')
    .maybeSingle()
  if (reversal) return

  await supabase.from('pos_loyalty_points').insert({
    company_id: companyId,
    client_id: earned.client_id ?? null,
    client_email: earned.client_email,
    type: 'redeemed',
    points: -Math.abs(earned.points),
    invoice_id: originalInvoiceId,
    description: `Odbitek zaradi storna racuna ${originalInvoiceNumber}`,
  })
}

export interface InvoiceLoyaltyDisplay {
  redeemed: { points: number; amount: number } | null
  earned: { points: number; balance: number } | null
}

/**
 * Computes loyalty lines to render on an invoice's PDF / email: how many points
 * were redeemed on it (and their EUR value), and how many were earned (with the
 * buyer's current total balance). Reads straight from the ledger by invoice_id
 * so both the PDF generator and the email route stay in sync.
 */
export async function getInvoiceLoyaltyDisplay(
  supabase: SupabaseClient,
  params: { companyId: string; invoiceId: string; clientEmail: string | null | undefined }
): Promise<InvoiceLoyaltyDisplay> {
  const { companyId, invoiceId } = params
  const empty: InvoiceLoyaltyDisplay = { redeemed: null, earned: null }
  if (!params.clientEmail) return empty

  const settings = await getLoyaltySettings(supabase, companyId)
  if (!settings.loyalty_enabled) return empty

  const { data: rows } = await supabase
    .from('pos_loyalty_points')
    .select('type, points')
    .eq('company_id', companyId)
    .eq('invoice_id', invoiceId)

  if (!rows?.length) return empty

  const earnedPoints = rows
    .filter((r) => r.type === 'earned')
    .reduce((s, r) => s + (r.points as number), 0)
  const redeemedPoints = rows
    .filter((r) => r.type === 'redeemed' && (r.points as number) < 0)
    .reduce((s, r) => s + Math.abs(r.points as number), 0)

  const result: InvoiceLoyaltyDisplay = { redeemed: null, earned: null }
  if (redeemedPoints > 0) {
    result.redeemed = {
      points: redeemedPoints,
      amount: redeemedPoints * settings.loyalty_redeem_value,
    }
  }
  if (earnedPoints > 0) {
    const balance = await getPointsBalance(companyId, params.clientEmail, supabase)
    result.earned = { points: earnedPoints, balance }
  }
  return result
}
