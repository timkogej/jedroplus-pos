import { describe, it, expect } from 'vitest'
import { decimalPattern, formatDecimal, parseDecimal } from '@/lib/decimal'

describe('parseDecimal', () => {
  it('reads comma and dot', () => {
    expect(parseDecimal('0,5')).toBe(0.5)
    expect(parseDecimal('0.5')).toBe(0.5)
    expect(parseDecimal('12')).toBe(12)
    expect(parseDecimal('35,90')).toBe(35.9)
  })
  it('treats empty or unusable text as 0', () => {
    expect(parseDecimal('')).toBe(0)
    expect(parseDecimal(',')).toBe(0)
    expect(parseDecimal('abc')).toBe(0)
  })
})

describe('formatDecimal', () => {
  it('shows a Slovenian comma and nothing for 0', () => {
    expect(formatDecimal(0.5)).toBe('0,5')
    expect(formatDecimal(35)).toBe('35')
    expect(formatDecimal(0)).toBe('')
  })
})

describe('decimalPattern', () => {
  const two = decimalPattern(2)
  it('allows what people type on the way to a number', () => {
    for (const ok of ['', '1', '12', '1,', '1.', '1,5', '1,55', ',5', '0.05']) expect(two.test(ok)).toBe(true)
  })
  it('rejects letters, a second separator, a minus and too many decimals', () => {
    for (const bad of ['a', '1,2,3', '1.2.3', '-1', '1,555', '1 000', '€']) expect(two.test(bad)).toBe(false)
  })
  it('quantity may have three decimals', () => {
    expect(decimalPattern(3).test('0,125')).toBe(true)
    expect(decimalPattern(3).test('0,1255')).toBe(false)
  })
})
