export interface TotalsItem {
  quantity: number
  unit_price: number // gross
  vat_rate: number
}

export interface InvoiceTotals {
  itemsTotal: number      // Σ qty × gross unit price
  discount: number        // manual discount in EUR (clamped to itemsTotal)
  subtotal: number        // itemsTotal − discount
  loyaltyDiscount: number // value of redeemed points
  total: number           // what the customer pays
  vatAmount: number       // VAT contained in `total`, summed per rate
  vatRate: number         // dominant rate (legacy single-rate column)
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Single source of truth for invoice amounts. The server computes these itself
 * — amounts sent by the browser are only cross-checked, never trusted. VAT is
 * included in the gross prices and is summed per rate (a mixed 22 % / 9.5 %
 * invoice used to be taxed entirely at the first item's rate).
 */
export function computeInvoiceTotals(
  items: TotalsItem[],
  discountValue = 0,
  loyaltyDiscount = 0
): InvoiceTotals {
  const itemsTotal = round2(items.reduce((s, i) => s + i.quantity * i.unit_price, 0))
  const discount = round2(Math.min(Math.max(discountValue, 0), itemsTotal))
  const subtotal = round2(itemsTotal - discount)
  const loyalty = round2(Math.min(Math.max(loyaltyDiscount, 0), subtotal))
  const total = round2(subtotal - loyalty)

  const grossByRate = new Map<number, number>()
  for (const i of items) {
    grossByRate.set(i.vat_rate, (grossByRate.get(i.vat_rate) ?? 0) + i.quantity * i.unit_price)
  }
  const scale = itemsTotal > 0 ? total / itemsTotal : 0
  let vatAmount = 0
  let vatRate = items[0]?.vat_rate ?? 0
  let best = -1
  for (const [rate, gross] of Array.from(grossByRate.entries())) {
    vatAmount += round2(gross * scale * (rate / (100 + rate)))
    if (gross > best) {
      best = gross
      vatRate = rate
    }
  }

  return { itemsTotal, discount, subtotal, loyaltyDiscount: loyalty, total, vatAmount: round2(vatAmount), vatRate }
}
