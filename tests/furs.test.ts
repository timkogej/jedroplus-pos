import { describe, it, expect } from 'vitest'
import { buildZoiInput, formatDateForZoi } from '@/lib/furs/zoi'
import { buildInvoiceRequestXml, extractInvoiceCounter, zoiDateTimeToIso } from '@/lib/furs/xml'
import { buildFursTaxes } from '@/lib/furs/taxes'
import type { FursInvoiceRequest } from '@/lib/furs/types'

const base: FursInvoiceRequest = {
  taxNumber: '12345678',
  issueDateTime: '15.01.2026 12:30:00',
  invoiceNumber: 'R-2026-PS1-EN1-00042',
  invoiceCounter: 42,
  businessPremiseId: 'PS1',
  electronicDeviceId: 'EN1',
  invoiceAmount: '122.00',
  paymentAmount: '122.00',
  taxesPerSeller: [{ taxRate: 22, taxableAmount: 100, taxAmount: 22 }],
}

describe('ZOI input', () => {
  it('uses the bare counter, matching fu:InvoiceNumber in the XML', () => {
    expect(buildZoiInput(base)).toBe('1234567815.01.2026 12:30:00' + '42' + 'PS1' + 'EN1' + '122.00')
  })

  it('falls back to parsing the formatted number when no counter is stored', () => {
    const { invoiceCounter, ...legacy } = base
    void invoiceCounter
    expect(buildZoiInput(legacy as FursInvoiceRequest)).toContain('42PS1EN1')
  })

  it('formats the issue datetime in Slovenian local time', () => {
    expect(formatDateForZoi(new Date('2026-07-15T11:30:00Z'))).toBe('15.07.2026 13:30:00')
  })
})

describe('invoice counter extraction', () => {
  it('parses the common formats', () => {
    expect(extractInvoiceCounter('R-2026-PS1-EN1-00042')).toBe('42')
    expect(extractInvoiceCounter('R00042')).toBe('42')
  })

  it('is ambiguous for year-last formats — that is why invoice_counter is stored', () => {
    expect(extractInvoiceCounter('00042/2026')).toBe('2026')
  })
})

describe('InvoiceRequest XML', () => {
  it('sends the stored counter and ISO local time', () => {
    const { xml } = buildInvoiceRequestXml({ ...base, invoiceNumber: '00042/2026' }, 'a'.repeat(32))
    expect(xml).toContain('<fu:InvoiceNumber>42</fu:InvoiceNumber>')
    expect(xml).toContain('<fu:IssueDateTime>2026-01-15T12:30:00</fu:IssueDateTime>')
    expect(xml).toContain('<fu:ProtectedID>' + 'a'.repeat(32) + '</fu:ProtectedID>')
  })

  it('marks resubmissions', () => {
    const { xml } = buildInvoiceRequestXml({ ...base, subsequentSubmit: true }, 'b'.repeat(32))
    expect(xml).toContain('<fu:SubsequentSubmit>true</fu:SubsequentSubmit>')
  })

  it('converts ZOI datetimes to ISO', () => {
    expect(zoiDateTimeToIso('04.07.2026 14:30:00')).toBe('2026-07-04T14:30:00')
  })
})

describe('buildFursTaxes', () => {
  it('splits per VAT rate and scales to the charged total', () => {
    const taxes = buildFursTaxes(
      [
        { quantity: 1, unit_price: 122, vat_rate: 22 },
        { quantity: 1, unit_price: 10.95, vat_rate: 9.5 },
      ],
      132.95
    )
    expect(taxes).toHaveLength(2)
    const sum = taxes.reduce((s, t) => s + t.taxableAmount + t.taxAmount, 0)
    expect(sum).toBeCloseTo(132.95, 2)
  })

  it('reverses signs for storno items', () => {
    const [t] = buildFursTaxes([{ quantity: 1, unit_price: -122, vat_rate: 22 }], -122)
    expect(t.taxAmount).toBe(-22)
    expect(t.taxableAmount).toBe(-100)
  })
})


describe('companies that are not VAT payers', () => {
  it('report no tax breakdown to FURS', () => {
    expect(buildFursTaxes([{ quantity: 1, unit_price: 50, vat_rate: 0 }], 50, false)).toEqual([])
  })

  it('omit TaxesPerSeller from the XML when there is no breakdown', () => {
    const { xml } = buildInvoiceRequestXml({ ...base, taxesPerSeller: [] }, 'c'.repeat(32))
    expect(xml).not.toContain('TaxesPerSeller')
    expect(xml).toContain('<fu:ProtectedID>')
  })
})
