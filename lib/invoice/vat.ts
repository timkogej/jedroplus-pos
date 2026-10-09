/** Legal statement for invoices issued by a company that is not a VAT payer. */
export const VAT_EXEMPT_NOTE = 'DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1.'

/** Appends the statement to the notes once. */
export function withVatExemptNote(notes: string | null | undefined): string {
  const current = (notes ?? '').trim()
  if (current.includes(VAT_EXEMPT_NOTE)) return current
  return current ? `${current}\n${VAT_EXEMPT_NOTE}` : VAT_EXEMPT_NOTE
}
