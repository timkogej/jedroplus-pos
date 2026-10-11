/** Helpers for amount/quantity fields typed by people (comma or dot as separator). */

/** "0,5" / "0.5" / "12" → number; anything unusable (empty, ",") → 0. */
export function parseDecimal(text: string): number {
  const n = parseFloat(text.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Number → what the field shows: Slovenian comma, and nothing at all for 0. */
export function formatDecimal(n: number): string {
  return n ? String(n).replace('.', ',') : ''
}

/** Which texts may be typed: digits, then optionally a separator and up to `decimals` digits. */
export function decimalPattern(decimals: number): RegExp {
  return new RegExp(`^\\d*(?:[.,]\\d{0,${decimals}})?$`)
}
