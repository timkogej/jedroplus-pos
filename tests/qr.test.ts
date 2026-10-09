import { describe, it, expect } from 'vitest'
import { buildFursQrCode } from '@/lib/furs/qr'

// Worked examples from the FURS technical documentation (chapter 11).
describe('FURS QR / verification code', () => {
  it('matches the official example 1', () => {
    // 15.8.2015 10:13:32 (summer time) — Slovenian local time
    const issued = new Date('2015-08-15T08:13:32Z')
    expect(buildFursQrCode('a7e5f55e1dbb48b799268e1a6d8618a3', '12345678', issued)).toBe(
      '223175087923687075112234402528973166755123456781508151013321'
    )
  })

  it('left-pads the decimal ZOI to 39 digits (official example 2)', () => {
    const issued = new Date('2015-08-15T08:13:32Z')
    const code = buildFursQrCode('3024e56bf1ddd2e7eeb5715c6859a913', '12345678', issued)!
    expect(code).toHaveLength(60)
    expect(code.startsWith('063994519708649896901260100447252359443')).toBe(true)
  })

  it('check digit is the digit sum modulo 10', () => {
    const code = buildFursQrCode('a7e5f55e1dbb48b799268e1a6d8618a3', '12345678', new Date('2015-08-15T08:13:32Z'))!
    const sum = code.slice(0, 59).split('').reduce((s, d) => s + Number(d), 0)
    expect(Number(code[59])).toBe(sum % 10)
  })

  it('rejects malformed input', () => {
    const d = new Date()
    expect(buildFursQrCode('xyz', '12345678', d)).toBeNull()
    expect(buildFursQrCode('a7e5f55e1dbb48b799268e1a6d8618a3', '123', d)).toBeNull()
    expect(buildFursQrCode(null, '12345678', d)).toBeNull()
  })
})
