import { ljParts } from '@/lib/time'

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * The code printed as QR / PDF417 / Code128 on a fiscal invoice (FURS technical
 * documentation, chapter 11) — 60 digits:
 *   1. ZOI converted from hex to decimal, left-padded with zeros to 39 digits
 *   2. the issuer's tax number (8 digits)
 *   3. issue date and time as YYMMDDHHMMSS (12 digits, Slovenian local time)
 *   4. a check digit: the sum of all digits above, modulo 10
 * Returns null when the ZOI or tax number is not in the expected format.
 */
export function buildFursQrCode(
  zoiHex: string | null | undefined,
  taxNumber: string | null | undefined,
  issuedAt: Date
): string | null {
  if (!zoiHex || !/^[0-9a-fA-F]{32}$/.test(zoiHex)) return null
  if (!taxNumber || !/^\d{8}$/.test(taxNumber)) return null

  const zoiDecimal = BigInt('0x' + zoiHex).toString(10).padStart(39, '0')
  const p = ljParts(issuedAt)
  const stamp = `${pad2(p.year % 100)}${pad2(p.month)}${pad2(p.day)}${pad2(p.hour)}${pad2(p.minute)}${pad2(p.second)}`

  const body = `${zoiDecimal}${taxNumber}${stamp}`
  const check = body.split('').reduce((sum, d) => sum + Number(d), 0) % 10
  return `${body}${check}`
}
