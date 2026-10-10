import { describe, it, expect } from 'vitest'
import { friendlyError, GENERIC_ERROR } from '@/lib/errors'

describe('friendlyError', () => {
  it('translates known Supabase and network messages', () => {
    expect(friendlyError('Invalid login credentials')).toBe('Napačna e-pošta ali geslo.')
    expect(friendlyError(new Error('Failed to fetch'))).toMatch(/Povezava/)
    expect(friendlyError({ message: 'duplicate key value violates unique constraint "x"' })).toBe('Ta vnos že obstaja.')
    expect(friendlyError('Unauthorized')).toMatch(/Prijavite/)
  })

  it('keeps messages that are already Slovenian', () => {
    expect(friendlyError('Blagajna za ta dan je že zaključena (Z-poročilo).')).toBe(
      'Blagajna za ta dan je že zaključena (Z-poročilo).'
    )
  })

  it('hides raw technical messages and empty values', () => {
    expect(friendlyError('relation "pos_x" does not exist')).toBe(GENERIC_ERROR)
    expect(friendlyError(undefined)).toBe(GENERIC_ERROR)
    expect(friendlyError('', 'Napaka pri prijavi')).toBe('Napaka pri prijavi')
  })
})
