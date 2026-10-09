import type { SupabaseClient } from '@supabase/supabase-js'

export type AttentionKind = 'online_invoice_failed' | 'refund_needs_storno' | 'furs_failed'

/**
 * Records something a human must resolve (shown on the dashboard). Deduped on
 * (kind, reference) so webhook retries don't pile up duplicates.
 */
export async function raiseAttention(
  supabase: SupabaseClient,
  item: {
    companyId: string
    kind: AttentionKind
    reference: string
    message: string
    invoiceId?: string | null
    details?: Record<string, unknown>
  }
): Promise<void> {
  const { error } = await supabase.from('pos_attention_items').upsert(
    {
      company_id: item.companyId,
      kind: item.kind,
      reference: item.reference,
      invoice_id: item.invoiceId ?? null,
      message: item.message,
      details: item.details ?? null,
    },
    { onConflict: 'kind,reference', ignoreDuplicates: true }
  )
  if (error) console.error('[attention] could not record item:', error.message, item)
}
