import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createFakeSupabase, type FakeSupabase } from './helpers/fakeSupabase'

const h = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase, confirm: vi.fn() }))

vi.mock('@/lib/supabase', () => ({ createServiceClient: () => h.fake, supabase: {} }))
vi.mock('@/lib/furs/api', () => ({ confirmInvoiceWithFurs: h.confirm }))
vi.mock('@/lib/invoice/pdf-server', () => ({ generateInvoicePdf: async () => Buffer.from('pdf') }))
vi.mock('@/lib/auth/apiAuth', () => ({
  requireInvoiceAccess: async () => ({ user: { id: 'u1', email: 'staff@example.com' }, companyId: 'c1' }),
}))

import { POST } from '@/app/api/invoices/[id]/storno/route'

function call(id: string) {
  const req = new NextRequest(`http://localhost/api/invoices/${id}/storno`, { method: 'POST' })
  return POST(req, { params: Promise.resolve({ id }) })
}

function seed(over: Record<string, Record<string, unknown>[]> = {}) {
  return {
    pos_settings: [{ company_id: 'c1', furs_environment: 'test', is_vat_registered: true }],
    pos_premises: [{ id: 'p1', company_id: 'c1', premise_id: 'PS1' }],
    pos_devices: [{ id: 'd1', company_id: 'c1', premise_id: 'p1', device_id: 'EN1' }],
    pos_certificates: [{ company_id: 'c1', is_active: true, tax_number: '12345678' }],
    companies: [{ id: 'c1', name: 'Salon', company_id: 'SAL1' }],
    pos_invoices: [
      {
        id: 'inv1', company_id: 'c1', premise_id: 'p1', device_id: 'd1', invoice_number: 'R-2026-PS1-EN1-00007',
        invoice_counter: 7, invoice_date: '2026-10-01T10:00:00Z', status: 'issued', payment_method: 'cash',
        zoi: 'a'.repeat(32), eor: 'e1', subtotal: 122, discount_amount: 0, vat_rate: 22, vat_amount: 22, total: 122,
        client_email: 'ana@example.com',
        pos_invoice_items: [{ description: 'Striženje', quantity: 1, unit_price: 122, vat_rate: 22, vat_amount: 22, total: 122 }],
      },
    ],
    ...over,
  }
}

beforeEach(() => {
  h.confirm.mockReset()
  h.confirm.mockResolvedValue({ zoi: 'c'.repeat(32), eor: 'storno-eor', confirmedAt: new Date().toISOString() })
})

describe('storno', () => {
  it('sends a negative storno to FURS that references the original, and marks the original', async () => {
    h.fake = createFakeSupabase(seed())
    const res = await call('inv1')
    expect(res.status).toBe(200)

    const req = h.confirm.mock.calls[0][0]
    expect(req.invoiceAmount).toBe('-122.00')
    expect(req.referenceInvoice).toMatchObject({ referenceInvoiceNumber: 'R-2026-PS1-EN1-00007', referenceInvoiceCounter: 7 })
    expect(req.taxesPerSeller[0]).toMatchObject({ taxRate: 22, taxAmount: -22 })

    const [orig, storno] = h.fake.tables.pos_invoices
    expect(orig.status).toBe('storno_original')
    expect(storno).toMatchObject({ is_storno: true, storno_of: 'inv1', status: 'storno', total: -122 })
  })

  it('a second storno of the same invoice is refused and never reaches FURS again', async () => {
    h.fake = createFakeSupabase(seed())
    expect((await call('inv1')).status).toBe(200)
    h.confirm.mockClear()

    const second = await call('inv1')
    expect(second.status).toBe(400)
    expect(h.confirm).not.toHaveBeenCalled()
    expect(h.fake.tables.pos_invoices.filter((i) => i.is_storno)).toHaveLength(1)
  })

  it('does not storno an invoice that is already being stornoed by another request', async () => {
    const rows = seed()
    rows.pos_invoices[0].status = 'storno_pending'
    h.fake = createFakeSupabase(rows)
    const res = await call('inv1')
    expect(res.status).toBe(400)
    expect(h.confirm).not.toHaveBeenCalled()
  })

  it('a bank-transfer invoice (never sent to FURS) is stornoed without FURS, in the N series', async () => {
    const rows = seed()
    Object.assign(rows.pos_invoices[0], { payment_method: 'transfer', zoi: null, eor: null })
    h.fake = createFakeSupabase(rows)
    const res = await call('inv1')
    expect(res.status).toBe(200)
    expect(h.confirm).not.toHaveBeenCalled()
    expect(h.fake.tables.pos_invoices[1]).toMatchObject({ status: 'storno', zoi: null })
    expect(h.fake.rpcCalls[0].name).toBe('increment_nonfiscal_counter')
  })

  it('releases the original again when FURS storno fails hard', async () => {
    h.confirm.mockRejectedValue(new Error('certificate broken'))
    h.fake = createFakeSupabase(seed())
    const res = await call('inv1')
    expect(res.status).toBe(500)
    expect(h.fake.tables.pos_invoices[0].status).toBe('issued')
  })

  it('returns the points the buyer spent and takes back the ones earned', async () => {
    h.fake = createFakeSupabase(
      seed({
        pos_loyalty_points: [
          { id: 'l1', company_id: 'c1', invoice_id: 'inv1', client_email: 'ana@example.com', type: 'earned', points: 100, description: 'x' },
          { id: 'l2', company_id: 'c1', invoice_id: 'inv1', client_email: 'ana@example.com', type: 'redeemed', points: -40, description: 'Unovceno pri racunu' },
        ],
      })
    )
    expect((await call('inv1')).status).toBe(200)
    const rows = h.fake.tables.pos_loyalty_points
    expect(rows.find((r) => String(r.description).startsWith('Odbitek'))?.points).toBe(-100)
    expect(rows.find((r) => r.type === 'adjustment')?.points).toBe(40)
  })

  it('refuses a storno on a day already closed with a Z-report', async () => {
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Ljubljana' }).format(new Date())
    h.fake = createFakeSupabase(seed({ pos_z_reports: [{ company_id: 'c1', report_date: today }] }))
    const res = await call('inv1')
    expect(res.status).toBe(400)
    expect(h.confirm).not.toHaveBeenCalled()
    expect(h.fake.tables.pos_invoices[0].status).toBe('issued')
  })
})
