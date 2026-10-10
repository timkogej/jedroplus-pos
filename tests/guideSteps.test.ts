import { describe, it, expect } from 'vitest'
import { deriveGuideSteps, premiseHasFullAddress, type GuideFacts } from '@/lib/guide/steps'

const empty: GuideFacts = {
  companyDataComplete: false,
  vatConfirmed: false,
  premiseReady: false,
  invoiceCount: 0,
  certificateActive: false,
  certificateExpired: false,
  premisesRegistered: false,
  environment: 'test',
  activationRequestedAt: null,
  realInvoiceCount: 0,
  zReportCount: 0,
}
const status = (f: GuideFacts, id: string) => deriveGuideSteps(f).steps.find((s) => s.id === id)!

describe('deriveGuideSteps', () => {
  it('a brand new company starts at "company details"', () => {
    const s = deriveGuideSteps(empty)
    expect(s.nextId).toBe('company')
    expect(s.done).toBe(0)
    expect(status(empty, 'company').status).toBe('current')
    expect(status(empty, 'testInvoice').status).toBe('locked')
    expect(status(empty, 'registration').status).toBe('locked')
    expect(status(empty, 'realInvoice').status).toBe('locked')
  })

  it('the test invoice is possible before the certificate', () => {
    const f = { ...empty, companyDataComplete: true, vatConfirmed: true, premiseReady: true }
    expect(deriveGuideSteps(f).nextId).toBe('testInvoice')
    expect(status(f, 'certificate').status).toBe('todo')
  })

  it('registration needs a valid certificate', () => {
    const f = { ...empty, premiseReady: true, certificateActive: true }
    expect(status(f, 'registration').status).not.toBe('locked')
    const expired = { ...f, certificateExpired: true }
    expect(status(expired, 'certificate').status).not.toBe('done')
    expect(status(expired, 'registration').status).toBe('locked')
    expect(status(expired, 'registration').lockedBecause).toBe('certificate')
  })

  it('activation waits for Jedro+ only after certificate and registration', () => {
    const early = { ...empty, certificateActive: true }
    expect(status(early, 'activation').status).toBe('locked')
    expect(status(early, 'activation').lockedBecause).toBe('registration')
    const ready = { ...early, premisesRegistered: true, premiseReady: true }
    expect(status(ready, 'activation').status).toBe('waiting')
  })

  it('the first real invoice is locked until real mode is on', () => {
    const f = { ...empty, certificateActive: true, premisesRegistered: true }
    expect(status(f, 'realInvoice').status).toBe('locked')
    const live = { ...f, environment: 'production' as const }
    expect(status(live, 'activation').status).toBe('done')
    expect(status(live, 'realInvoice').status).not.toBe('locked')
  })

  it('the Z-report needs at least one invoice', () => {
    expect(status(empty, 'zReport').status).toBe('locked')
    expect(status({ ...empty, invoiceCount: 1, premiseReady: true }, 'zReport').status).not.toBe('locked')
  })

  it('everything done is complete and has no next step', () => {
    const all: GuideFacts = {
      companyDataComplete: true,
      vatConfirmed: true,
      premiseReady: true,
      invoiceCount: 5,
      certificateActive: true,
      certificateExpired: false,
      premisesRegistered: true,
      environment: 'production',
      activationRequestedAt: null,
      realInvoiceCount: 2,
      zReportCount: 1,
    }
    const s = deriveGuideSteps(all)
    expect(s.complete).toBe(true)
    expect(s.done).toBe(s.total)
    expect(s.nextId).toBeNull()
  })

  it('exactly one step is "current" while something is open', () => {
    const f = { ...empty, companyDataComplete: true, vatConfirmed: true }
    const current = deriveGuideSteps(f).steps.filter((s) => s.status === 'current')
    expect(current).toHaveLength(1)
    expect(current[0].id).toBe('premise')
  })
})

describe('premiseHasFullAddress', () => {
  const base = { premise_type: 'premises', address: 'Slovenska cesta', house_number: '1', city: 'Ljubljana', postal_code: '1000' }
  it('needs street, house number, city and post code for a fixed premise', () => {
    expect(premiseHasFullAddress(base)).toBe(true)
    expect(premiseHasFullAddress({ ...base, house_number: '' })).toBe(false)
    expect(premiseHasFullAddress({ ...base, address: null })).toBe(false)
  })
  it('a mobile cash register needs no address', () => {
    expect(premiseHasFullAddress({ premise_type: 'movable', address: null, house_number: null, city: null, postal_code: null })).toBe(true)
  })
})
