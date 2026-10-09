import { describe, it, expect } from 'vitest'
import { computeInvoiceTotals } from '@/lib/invoice/totals'

describe('computeInvoiceTotals', () => {
  it('single 22% rate', () => {
    const r = computeInvoiceTotals([{ quantity: 1, unit_price: 122, vat_rate: 22 }])
    expect(r.total).toBe(122)
    expect(r.vatAmount).toBe(22)
  })

  it('sums VAT per rate on mixed invoices', () => {
    const r = computeInvoiceTotals([
      { quantity: 1, unit_price: 122, vat_rate: 22 },
      { quantity: 1, unit_price: 10.95, vat_rate: 9.5 },
    ])
    expect(r.total).toBe(132.95)
    expect(r.vatAmount).toBeCloseTo(22.95, 2)
    expect(r.vatRate).toBe(22) // dominant by gross
  })

  it('applies manual discount and scales VAT to the charged total', () => {
    const r = computeInvoiceTotals([{ quantity: 2, unit_price: 50, vat_rate: 22 }], 10)
    expect(r.subtotal).toBe(90)
    expect(r.total).toBe(90)
    expect(r.vatAmount).toBeCloseTo(16.23, 2)
  })

  it('loyalty discount reduces total, not subtotal', () => {
    const r = computeInvoiceTotals([{ quantity: 1, unit_price: 100, vat_rate: 22 }], 0, 30)
    expect(r.subtotal).toBe(100)
    expect(r.loyaltyDiscount).toBe(30)
    expect(r.total).toBe(70)
    expect(r.vatAmount).toBeCloseTo(12.62, 2)
  })

  it('never lets discounts push the total below zero', () => {
    const r = computeInvoiceTotals([{ quantity: 1, unit_price: 10, vat_rate: 22 }], 50, 50)
    expect(r.discount).toBe(10)
    expect(r.total).toBe(0)
  })

  it('ignores negative discounts', () => {
    const r = computeInvoiceTotals([{ quantity: 1, unit_price: 10, vat_rate: 0 }], -5, -5)
    expect(r.total).toBe(10)
  })
})
