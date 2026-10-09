import { describe, it, expect } from 'vitest'
import { pdfPathFromUrl, pdfStorageKey } from '@/lib/invoice/storage'

describe('pdf storage helpers', () => {
  it('extracts the object path from a legacy public URL', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/invoices/abc/R-2026-PS1-EN1-00042.pdf'
    expect(pdfPathFromUrl(url, 'invoices')).toBe('abc/R-2026-PS1-EN1-00042.pdf')
  })

  it('handles the new random-segment paths and encoded characters', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/invoices/c/uuid-1/R_00042_2026.pdf?t=1'
    expect(pdfPathFromUrl(url, 'invoices')).toBe('c/uuid-1/R_00042_2026.pdf')
    expect(pdfPathFromUrl('https://x/object/public/invoices/a%20b/c.pdf', 'invoices')).toBe('a b/c.pdf')
  })

  it('rejects URLs from another bucket or empty input', () => {
    expect(pdfPathFromUrl('https://x/storage/v1/object/public/z-reports/a.pdf', 'invoices')).toBeNull()
    expect(pdfPathFromUrl(null, 'invoices')).toBeNull()
  })

  it('builds unguessable, filesystem-safe keys', () => {
    const a = pdfStorageKey('co', '00042/2026')
    const b = pdfStorageKey('co', '00042/2026')
    expect(a).not.toBe(b)
    expect(a).toMatch(/^co\/[0-9a-f-]{36}\/00042_2026\.pdf$/)
  })
})
