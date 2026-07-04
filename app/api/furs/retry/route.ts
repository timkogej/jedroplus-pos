import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { confirmInvoiceWithFurs } from '@/lib/furs/api'
import { singleFursTax } from '@/lib/furs/taxes'
import { formatDateForZoi } from '@/lib/furs/zoi'
import type { FursInvoiceRequest } from '@/lib/furs/types'

const MAX_RETRIES = 3

/**
 * FURS offline retry cron. Protected by CRON_SECRET.
 *
 * Trigger with:  Authorization: Bearer $CRON_SECRET
 *
 * Re-submits every 'pending_furs' invoice (issued while FURS was unreachable)
 * with SubsequentSubmit=true. On success the invoice gets its EOR and goes
 * back to 'issued' (or 'storno'); after MAX_RETRIES failures → 'furs_failed'.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: pending } = await supabase
    .from('pos_invoices')
    .select('id, company_id, invoice_number, invoice_date, total, vat_rate, vat_amount, premise_id, device_id, furs_retry_count, is_storno, storno_of')
    .eq('status', 'pending_furs')
    .lt('furs_retry_count', MAX_RETRIES)
    .limit(50)

  const results: Array<{ invoiceId: string; ok: boolean; error?: string }> = []

  for (const inv of pending ?? []) {
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

      const fursRequest: FursInvoiceRequest = {
        taxNumber: certRow.tax_number,
        issueDateTime: formatDateForZoi(new Date(inv.invoice_date)),
        invoiceNumber: inv.invoice_number,
        businessPremiseId: premise.premise_id,
        electronicDeviceId: device.device_id,
        invoiceAmount: Number(inv.total).toFixed(2),
        paymentAmount: Number(inv.total).toFixed(2),
        taxesPerSeller: singleFursTax(inv.vat_rate, inv.vat_amount, inv.total),
        subsequentSubmit: true,
      }

      if (inv.is_storno && inv.storno_of) {
        const { data: original } = await supabase
          .from('pos_invoices')
          .select('invoice_number, invoice_date')
          .eq('id', inv.storno_of)
          .single()
        if (original) {
          fursRequest.referenceInvoice = {
            referenceInvoiceNumber: original.invoice_number,
            referenceBusinessPremiseId: premise.premise_id,
            referenceElectronicDeviceId: device.device_id,
            referenceInvoiceIssueDateTime: formatDateForZoi(new Date(original.invoice_date)),
          }
        }
      }

      const fursResponse = await confirmInvoiceWithFurs(fursRequest, inv.company_id)

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

      await supabase
        .from('pos_invoices')
        .update({
          furs_retry_count: newCount,
          furs_last_retry: new Date().toISOString(),
          furs_response: { error: message },
          ...(newCount >= MAX_RETRIES ? { status: 'furs_failed' } : {}),
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
