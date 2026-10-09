import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createFakeSupabase, type FakeSupabase } from './helpers/fakeSupabase'

const h = vi.hoisted(() => ({
  fake: null as unknown as FakeSupabase,
  event: null as unknown,
  piMeta: {} as Record<string, string>,
  createInvoice: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({ createServiceClient: () => h.fake, supabase: {} }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: () => h.event },
    paymentIntents: { retrieve: async () => ({ metadata: h.piMeta }) },
    subscriptions: { retrieve: async () => ({ items: { data: [] } }) },
  },
}))
vi.mock('@/lib/invoice/create-invoice', async (orig) => {
  const real = await orig<typeof import('@/lib/invoice/create-invoice')>()
  return { ...real, createInvoice: h.createInvoice, findExistingInvoice: vi.fn().mockResolvedValue(null) }
})

import { POST } from '@/app/api/stripe/webhook/route'
import { InvoiceValidationError } from '@/lib/invoice/create-invoice'

function post() {
  return POST(
    new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: '{}',
      headers: { 'stripe-signature': 't=1,v1=x' },
    })
  )
}

function paidSession(meta: Record<string, string>) {
  h.piMeta = meta
  h.event = {
    type: 'checkout.session.completed',
    data: { object: { mode: 'payment', payment_status: 'paid', payment_intent: 'pi_1', metadata: {} } },
  }
}

const meta = (over: Record<string, string> = {}) => ({
  appointmentId: '77', companyId: 'c1', premiseId: 'p1', deviceId: 'd1',
  chargedAmount: '60', paymentMode: 'full', ...over,
})

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  h.createInvoice.mockReset()
  h.createInvoice.mockResolvedValue({ invoiceId: 'i1', invoiceNumber: 'R-1' })
  h.fake = createFakeSupabase({
    Termini: [{ id: '77', Storitev: 'Barvanje', Cena: '50', 'Final cena': '50', Stranka: 'Ana', Email: 'ana@example.com', Valuta: 'EUR' }],
    pos_settings: [{ company_id: 'c1', is_vat_registered: true, default_vat_rate: 22, currency: 'EUR' }],
  })
})

describe('Stripe webhook — booking payments', () => {
  it('rejects a request without a signature', async () => {
    const res = await POST(new NextRequest('http://localhost/api/stripe/webhook', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('invoices exactly what was charged, adding the add-on as its own line', async () => {
    paidSession(meta()) // service 50 EUR, customer paid 60 (10 add-on)
    expect((await post()).status).toBe(200)

    const arg = h.createInvoice.mock.calls[0][0]
    expect(arg.total).toBe(60)
    expect(arg.items).toEqual([
      expect.objectContaining({ description: 'Barvanje', unit_price: 50 }),
      expect.objectContaining({ description: 'Dodatek', unit_price: 10 }),
    ])
    expect(arg.paymentMethod).toBe('online')
    expect(arg.stripePaymentIntentId).toBe('pi_1')
  })

  it('a deposit is invoiced at the deposit amount', async () => {
    paidSession(meta({ paymentMode: 'deposit', chargedAmount: '15' }))
    await post()
    expect(h.createInvoice.mock.calls[0][0].total).toBe(15)
  })

  it('a company that is not a VAT payer gets 0% VAT', async () => {
    h.fake.tables.pos_settings[0].is_vat_registered = false
    paidSession(meta({ chargedAmount: '50' }))
    await post()
    const arg = h.createInvoice.mock.calls[0][0]
    expect(arg.vatRate).toBe(0)
    expect(arg.vatAmount).toBe(0)
  })

  it('a blocked invoice (e.g. closed day) is answered with 200 and flagged for a human — Stripe must not retry forever', async () => {
    h.createInvoice.mockRejectedValue(new InvoiceValidationError('Blagajna za ta dan je že zaključena'))
    paidSession(meta())
    const res = await post()
    expect(res.status).toBe(200)

    const item = h.fake.tables.pos_attention_items[0]
    expect(item).toMatchObject({ company_id: 'c1', kind: 'online_invoice_failed', reference: 'pi_1' })
    expect(String(item.message)).toContain('zaključena')
  })

  it('an unexpected error returns 500 so Stripe retries', async () => {
    h.createInvoice.mockRejectedValue(new Error('db down'))
    paidSession(meta())
    expect((await post()).status).toBe(500)
  })

  it('a Stripe refund raises a "needs storno" item instead of silently ignoring it', async () => {
    h.fake.tables.pos_invoices = [
      { id: 'inv1', company_id: 'c1', invoice_number: 'R-1', status: 'issued', stripe_payment_intent_id: 'pi_1' },
    ]
    h.event = {
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_1', amount: 6000, amount_refunded: 6000, currency: 'eur' } },
    }
    expect((await post()).status).toBe(200)
    expect(h.fake.tables.pos_attention_items[0]).toMatchObject({
      kind: 'refund_needs_storno',
      invoice_id: 'inv1',
      company_id: 'c1',
    })
  })
})
