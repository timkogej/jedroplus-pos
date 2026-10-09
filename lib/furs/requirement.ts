/**
 * ZDavPR: invoices paid in CASH must be confirmed with FURS. "Cash" includes
 * banknotes/coins, payment and credit cards, cheques and similar — but NOT a
 * direct transfer to a payment-service-provider account (nakazilo). Such
 * invoices are issued normally, without ZOI/EOR.
 *
 * Online card payments (Stripe) are card payments, so they stay fiscalized.
 */
export function requiresFursConfirmation(paymentMethod: string): boolean {
  return paymentMethod !== 'transfer'
}

/** Marker stored in pos_invoices.furs_response for invoices that skip FURS on purpose. */
export const FURS_NOT_REQUIRED = { not_required: true } as const
