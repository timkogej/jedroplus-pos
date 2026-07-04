import type { FursTax } from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Groups invoice items (gross unit prices) into per-VAT-rate FURS tax entries.
 * When an invoice-level discount was applied, each rate's gross share is scaled
 * so the groups sum to the actually charged total.
 */
export function buildFursTaxes(
  items: Array<{ quantity: number; unit_price: number; vat_rate: number }>,
  chargedTotal: number
): FursTax[] {
  const grossByRate = new Map<number, number>()
  for (const item of items) {
    const gross = item.quantity * item.unit_price
    grossByRate.set(item.vat_rate, (grossByRate.get(item.vat_rate) ?? 0) + gross)
  }

  const grossSum = Array.from(grossByRate.values()).reduce((a, b) => a + b, 0)
  const scale = grossSum > 0 ? chargedTotal / grossSum : 1

  return Array.from(grossByRate.entries()).map(([rate, gross]) => {
    const scaledGross = round2(gross * scale)
    const taxAmount = round2(scaledGross * (rate / (100 + rate)))
    return { taxRate: rate, taxableAmount: round2(scaledGross - taxAmount), taxAmount }
  })
}

/** Single-rate variant for rows that only carry invoice-level totals. */
export function singleFursTax(vatRate: number, vatAmount: number, total: number): FursTax[] {
  return [{ taxRate: vatRate, taxableAmount: round2(total - vatAmount), taxAmount: round2(vatAmount) }]
}
