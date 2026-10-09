import { describe, it, expect } from 'vitest'
import { requiresFursConfirmation } from '@/lib/furs/requirement'

describe('FURS confirmation requirement (ZDavPR)', () => {
  it('cash and card payments are confirmed', () => {
    expect(requiresFursConfirmation('cash')).toBe(true)
    expect(requiresFursConfirmation('card')).toBe(true)
  })

  it('online card payments stay fiscalized', () => {
    expect(requiresFursConfirmation('online')).toBe(true)
  })

  it('direct bank transfers are not sent to FURS', () => {
    expect(requiresFursConfirmation('transfer')).toBe(false)
  })
})
