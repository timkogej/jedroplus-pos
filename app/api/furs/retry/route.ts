import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { confirmInvoiceWithFurs } from '@/lib/furs/api'
import { buildFursTaxes, singleFursTax } from '@/lib/furs/taxes'
import { formatDateForZoi } from '@/lib/furs/zoi'
import type { FursInvoiceRequest } from '@/lib/furs/types'

// Give up on an invoice once it has been waiting this long. Time-based (not a
// retry count) so it works whatever the call frequency is: vercel.json only
// schedules a daily run (Hobby plan limit); for faster retries call this
// endpoint every ~15 min from an external scheduler (e.g. n8n) with the
// CRON_SECRET bearer token.
const MAX_AGE_MS = 72 * 60 * 60 * 1000
// An invoice claimed by one run is not picked up by another for this long.
const CLAIM_TTL_MS = 10 * 60 * 1000

/**
 * FURS offline retry cron. Protected by CRON_SECRET.
 *
 * Vercel Cron Jobs trigger with a GET request, automatically sending
 * `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set as a project
 * env var — see vercel.json. POST is also exposed for manual/local testing
 * with the same header.
 *
 * Re-submits every 'pending_furs' invoice (issued while FURS was unreachable)
 * with SubsequentSubmit=true. On success the invoice gets its EOR and goes
 * back to 'issued' (or 'storno'); still failing after 72 h → 'furs_failed'.
 * Each invoice is claimed (furs_last_retry) before submission so overlapping
 * cron runs never double-submit, and the stored ZOI/counter are re-sent as is.
 */
export async function GET(req: NextRequest) {
  return handleRetry(req)
}

export async function POST(req: NextRequest) {
  return handleRetry(req)
}

async function handleRetry(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: pending } = await supabase
    .from('pos_invoices')
    .select('id, company_id, invoice_number, invoice_counter, invoice_date, total, vat_rate, vat_amount, zoi, premise_id, device_id, furs_retry_count, is_storno, storno_of')
    .eq('status', 'pending_furs')
    .limit(50)

  const results: Array<{ invoiceId: string; ok: boolean; error?: string }> = []

  for (const inv of pending ?? []) {
    // Claim: only proceed if no other run touched this invoice recently.
    const cutoff = new Date(Date.now() - CLAIM_TTL_MS).toISOString()
    const { data: claimed } = await supabase
      .from('pos_invoices')
      .update({ furs_last_retry: new Date().toISOString() })
      .eq('id', inv.id)
      .eq('status', 'pending_furs')
      .or(`furs_last_retry.is.null,furs_last_retry.lt.${cutoff}`)
      .select('id')
    if (!claimed?.length) continue

    try {
      const [{ data: certRow }, { data: premise }, { data: device }] = await Promise.all([
        supabase
          .from('pos_certificates')
          .select('tax_number')
          .eq('company_id', inv.company_id)
          .eq('is_active', true)
          .maybeSingle(),
        supabase.from('pos_premises').select('premise_id').eq('id', inv.premise_id).single(),
        supabase.from('pos_devices').select('device_id').eq('id', inv.device_id).single(),
      ])

      if (!certRow || !premise || !device) {
        throw new Error('Certifikat, prostor ali naprava ni najdena')
      }

      const { data: itemRows } = await supabase
        .from('pos_invoice_items')
        .select('quantity, unit_price, vat_rate')
        .eq('invoice_id', inv.id)

      const fursRequest: FursInvoiceRequest = {
        taxNumber: certRow.tax_number,
        issueDateTime: formatDateForZoi(new Date(inv.invoice_date)),
        invoiceNumber: inv.invoice_number,
        invoiceCounter: inv.invoice_counter ?? undefined,
        businessPremiseId: premise.premise_id,
        electronicDeviceId: device.device_id,
        invoiceAmount: Number(inv.total).toFixed(2),
        paymentAmount: Number(inv.total).toFixed(2),
        taxesPerSeller: itemRows?.length
          ? buildFursTaxes(
              itemRows.map((i) => ({
                quantity: Number(i.quantity),
                unit_price: Number(i.unit_price),
                vat_rate: Number(i.vat_rate),
              })),
              Number(inv.total)
            )
          : singleFursTax(inv.vat_rate, inv.vat_amount, inv.total),
        subsequentSubmit: true,
      }

      if (inv.is_storno && inv.storno_of) {
        const { data: original } = await supabase
          .from('pos_invoices')
          .select('invoice_number, invoice_counter, invoice_date')
          .eq('id', inv.storno_of)
          .single()
        if (original) {
          fursRequest.referenceInvoice = {
            referenceInvoiceNumber: original.invoice_number,
            referenceInvoiceCounter: original.invoice_counter ?? undefined,
            referenceBusinessPremiseId: premise.premise_id,
            referenceElectronicDeviceId: device.device_id,
            referenceInvoiceIssueDateTime: formatDateForZoi(new Date(original.invoice_date)),
          }
        }
      }

      const fursResponse = await confirmInvoiceWithFurs(fursRequest, inv.company_id, { existingZoi: inv.zoi })

      await supabase
        .from('pos_invoices')
        .update({
          zoi: fursResponse.zoi,
          eor: fursResponse.eor,
          furs_confirmed_at: fursResponse.confirmedAt,
          furs_response: { retried: true },
          status: inv.is_storno ? 'storno' : 'issued',
          furs_last_retry: new Date().toISOString(),
        })
        .eq('id', inv.id)

      results.push({ invoiceId: inv.id, ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown FURS error'
      const newCount = (inv.furs_retry_count ?? 0) + 1
      const tooOld = Date.now() - new Date(inv.invoice_date).getTime() > MAX_AGE_MS

      await supabase
        .from('pos_invoices')
        .update({
          furs_retry_count: newCount,
          furs_last_retry: new Date().toISOString(),
          furs_response: { error: message },
          ...(tooOld ? { status: 'furs_failed' } : {}),
        })
        .eq('id', inv.id)

      results.push({ invoiceId: inv.id, ok: false, error: message })
    }
  }

  return NextResponse.json({
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    results,
  })
}
