import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from './helpers/fakeSupabase'

const h = vi.hoisted(() => ({
  fake: null as unknown as FakeSupabase,
  confirm: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => h.fake,
  supabase: {},
}))
vi.mock('@/lib/furs/api', () => ({ confirmInvoiceWithFurs: h.confirm }))
vi.mock('@/lib/invoice/pdf-server', () => ({ generateInvoicePdf: async () => Buffer.from('pdf') }))

import {
  createInvoice,
  DuplicateInvoiceError,
  InvoiceValidationError,
  type CreateInvoiceInput,
} from '@/lib/invoice/create-invoice'
import { FursError } from '@/lib/furs/types'

const COMPANY = 'c1'
const PREMISE = 'p1'
const DEVICE = 'd1'

function seed(extra: Record<string, Record<string, unknown>[]> = {}) {
  return {
    pos_settings: [{ company_id: COMPANY, furs_environment: 'test', is_vat_registered: true, loyalty_enabled: false }],
    pos_premises: [{ id: PREMISE, company_id: COMPANY, premise_id: 'PS1', address: 'Cesta 1', city: 'Ljubljana', postal_code: '1000' }],
    pos_devices: [{ id: DEVICE, company_id: COMPANY, premise_id: PREMISE, device_id: 'EN1' }],
    pos_certificates: [{ company_id: COMPANY, is_active: true, tax_number: '12345678' }],
    companies: [{ id: COMPANY, name: 'Salon', company_id: 'SAL1' }],
    ...extra,
  }
}

function input(over: Partial<CreateInvoiceInput> = {}): CreateInvoiceInput {
  return {
    companyId: COMPANY,
    premiseId: PREMISE,
    deviceId: DEVICE,
    paymentMethod: 'cash',
    items: [{ description: 'Striženje', quantity: 1, unit_price: 122, vat_rate: 22 }],
    subtotal: 122,
    vatRate: 22,
    vatAmount: 22,
    total: 122,
    buyer: { name: 'Ana', email: 'ana@example.com' },
    ...over,
  }
}

beforeEach(() => {
  h.confirm.mockReset()
  h.confirm.mockResolvedValue({ zoi: 'a'.repeat(32), eor: 'eor-1', confirmedAt: new Date().toISOString() })
})

describe('createInvoice', () => {
  it('fiscalizes a cash invoice and stores ZOI, EOR and the counter', async () => {
    h.fake = createFakeSupabase(seed())
    const res = await createInvoice(input())

    expect(h.confirm).toHaveBeenCalledTimes(1)
    const inv = h.fake.tables.pos_invoices[0]
    expect(inv.status).toBe('issued')
    expect(inv.zoi).toBe('a'.repeat(32))
    expect(inv.eor).toBe('eor-1')
    expect(inv.invoice_counter).toBe(1)
    expect(res.invoiceNumber).toMatch(/^R-\d{4}-PS1-EN1-00001$/)
    expect(h.fake.rpcCalls[0].name).toBe('increment_invoice_counter')
  })

  it('refuses a second invoice for the same appointment BEFORE touching FURS or the counter', async () => {
    h.fake = createFakeSupabase(
      seed({ pos_invoices: [{ id: 'old', company_id: COMPANY, appointment_id: '77', invoice_number: 'R-1', status: 'issued' }] })
    )
    await expect(createInvoice(input({ appointmentId: '77' }))).rejects.toBeInstanceOf(DuplicateInvoiceError)
    expect(h.confirm).not.toHaveBeenCalled()
    expect(h.fake.rpcCalls).toHaveLength(0)
    expect(h.fake.tables.pos_invoices).toHaveLength(1)
  })

  it('still allows a new invoice when the earlier one for the appointment was stornoed', async () => {
    h.fake = createFakeSupabase(
      seed({ pos_invoices: [{ id: 'old', company_id: COMPANY, appointment_id: '77', invoice_number: 'R-1', status: 'cancelled' }] })
    )
    await expect(createInvoice(input({ appointmentId: '77' }))).resolves.toBeTruthy()
  })

  it('does NOT send bank-transfer invoices to FURS and uses the separate N series', async () => {
    h.fake = createFakeSupabase(seed())
    const res = await createInvoice(input({ paymentMethod: 'transfer' }))

    expect(h.confirm).not.toHaveBeenCalled()
    const inv = h.fake.tables.pos_invoices[0]
    expect(inv.status).toBe('issued')
    expect(inv.zoi).toBeNull()
    expect(inv.eor).toBeNull()
    expect(inv.furs_response).toEqual({ not_required: true })
    expect(res.invoiceNumber).toMatch(/-RN-|^RN-/)
    expect(h.fake.rpcCalls[0].name).toBe('increment_nonfiscal_counter')
  })

  it('issues offline with the real ZOI when FURS is unreachable (pending_furs)', async () => {
    h.confirm.mockRejectedValue(new FursError('NETWORK', 'timeout', 'b'.repeat(32)))
    h.fake = createFakeSupabase(seed())
    await createInvoice(input())

    const inv = h.fake.tables.pos_invoices[0]
    expect(inv.status).toBe('pending_furs')
    expect(inv.zoi).toBe('b'.repeat(32))
    expect(inv.eor).toBeNull()
  })

  it('rejects an invoice on a day already closed with a Z-report, without FURS or a number', async () => {
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Ljubljana' }).format(new Date())
    h.fake = createFakeSupabase(seed({ pos_z_reports: [{ company_id: COMPANY, report_date: today }] }))
    await expect(createInvoice(input())).rejects.toBeInstanceOf(InvoiceValidationError)
    expect(h.confirm).not.toHaveBeenCalled()
    expect(h.fake.rpcCalls).toHaveLength(0)
  })

  it("refuses another company's premise or a device that doesn't belong to the premise", async () => {
    h.fake = createFakeSupabase(
      seed({ pos_premises: [{ id: PREMISE, company_id: 'OTHER', premise_id: 'PS9' }] })
    )
    await expect(createInvoice(input())).rejects.toBeInstanceOf(InvoiceValidationError)

    h.fake = createFakeSupabase(
      seed({ pos_devices: [{ id: DEVICE, company_id: COMPANY, premise_id: 'another-premise', device_id: 'EN1' }] })
    )
    await expect(createInvoice(input())).rejects.toBeInstanceOf(InvoiceValidationError)
    expect(h.confirm).not.toHaveBeenCalled()
  })

  it('refuses a premise that was permanently closed at FURS', async () => {
    h.fake = createFakeSupabase(
      seed({ pos_premises: [{ id: PREMISE, company_id: COMPANY, premise_id: 'PS1', furs_closed: true }] })
    )
    await expect(createInvoice(input())).rejects.toThrow(/zaprt/)
    expect(h.confirm).not.toHaveBeenCalled()
  })

  it('production without a certificate cannot issue a fiscal invoice', async () => {
    h.fake = createFakeSupabase(
      seed({
        pos_settings: [{ company_id: COMPANY, furs_environment: 'production', is_vat_registered: true }],
        pos_certificates: [],
      })
    )
    await expect(createInvoice(input())).rejects.toThrow(/Certifikat/)
  })

  it('sends no VAT breakdown to FURS for a company that is not a VAT payer', async () => {
    h.fake = createFakeSupabase(
      seed({ pos_settings: [{ company_id: COMPANY, furs_environment: 'test', is_vat_registered: false }] })
    )
    await createInvoice(input({ items: [{ description: 'X', quantity: 1, unit_price: 50, vat_rate: 0 }], total: 50, subtotal: 50, vatAmount: 0, vatRate: 0 }))
    expect(h.confirm.mock.calls[0][0].taxesPerSeller).toEqual([])
  })

  it('books redeemed loyalty points only after the invoice exists', async () => {
    h.fake = createFakeSupabase(seed())
    await createInvoice(input({ loyaltyPoints: 40, loyaltyDiscount: 2 }))
    const redeem = h.fake.rpcCalls.find((c) => c.name === 'loyalty_redeem')
    expect(redeem?.args).toMatchObject({ p_company: COMPANY, p_email: 'ana@example.com', p_points: 40, p_force: true })
    expect(redeem?.args.p_invoice).toBe(h.fake.tables.pos_invoices[0].id)
  })

  it('does not touch loyalty points when the invoice fails', async () => {
    h.fake = createFakeSupabase(seed({ pos_premises: [] }))
    await expect(createInvoice(input({ loyaltyPoints: 40 }))).rejects.toBeInstanceOf(InvoiceValidationError)
    expect(h.fake.rpcCalls.find((c) => c.name === 'loyalty_redeem')).toBeUndefined()
  })

  it('awards points on the paid total when the programme is enabled', async () => {
    h.fake = createFakeSupabase(
      seed({
        pos_settings: [{ company_id: COMPANY, furs_environment: 'test', is_vat_registered: true, loyalty_enabled: true, loyalty_earn_rate: 1, loyalty_redeem_value: 0.05 }],
      })
    )
    await createInvoice(input())
    const earned = h.fake.tables.pos_loyalty_points?.[0]
    expect(earned).toMatchObject({ type: 'earned', points: 122, client_email: 'ana@example.com' })
  })
})
