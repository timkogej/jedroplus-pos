/**
 * The setup guide ("Vodič"): which steps there are and how each one's status is
 * derived. Pure functions only — no database access — so every rule is covered by
 * tests. The data is gathered in lib/guide/facts.ts; the Slovenian copy lives in
 * lib/help/steps.ts.
 */

export type GuideStepId =
  | 'company'
  | 'vat'
  | 'premise'
  | 'testInvoice'
  | 'certificate'
  | 'registration'
  | 'activation'
  | 'realInvoice'
  | 'zReport'

/** In the order the user should do them. */
export const GUIDE_ORDER: GuideStepId[] = [
  'company',
  'vat',
  'premise',
  'testInvoice',
  'certificate',
  'registration',
  'activation',
  'realInvoice',
  'zReport',
]

export interface GuideFacts {
  /** Company name, address, postal code, city, tax number and e-mail are filled in. */
  companyDataComplete: boolean
  /** The user answered "are you a VAT payer?" (onboarding or settings). */
  vatConfirmed: boolean
  /** At least one active premise with a full address and an active device. */
  premiseReady: boolean
  /** Any invoice at all (test invoices count). */
  invoiceCount: number
  certificateActive: boolean
  certificateExpired: boolean
  /** Every active premise is registered with FURS (and there is at least one). */
  premisesRegistered: boolean
  environment: 'test' | 'production'
  activationRequestedAt: string | null
  /** FURS-confirmed, non-demo invoices issued after the real mode was switched on. */
  realInvoiceCount: number
  zReportCount: number
}

/**
 * done    — finished
 * current — the step to do next (exactly one, unless everything is done)
 * todo    — can be done, but isn't next
 * waiting — nothing for the user to do (Jedro+ switches real mode on)
 * locked  — an earlier step is required first
 */
export type GuideStatus = 'done' | 'current' | 'todo' | 'waiting' | 'locked'

export interface GuideStep {
  id: GuideStepId
  status: GuideStatus
  /** Why a step is locked, shown under it ("Najprej naložite certifikat"). */
  lockedBecause?: GuideStepId
}

export interface GuideSummary {
  steps: GuideStep[]
  done: number
  total: number
  nextId: GuideStepId | null
  complete: boolean
}

export function deriveGuideSteps(f: GuideFacts): GuideSummary {
  const certificateOk = f.certificateActive && !f.certificateExpired

  const done: Record<GuideStepId, boolean> = {
    company: f.companyDataComplete,
    vat: f.vatConfirmed,
    premise: f.premiseReady,
    testInvoice: f.invoiceCount > 0,
    certificate: certificateOk,
    registration: f.premisesRegistered,
    activation: f.environment === 'production',
    realInvoice: f.realInvoiceCount > 0,
    zReport: f.zReportCount > 0,
  }

  // Steps that cannot be started before another one is finished.
  const requires: Partial<Record<GuideStepId, GuideStepId>> = {
    testInvoice: 'premise',
    registration: 'certificate',
    realInvoice: 'activation',
    zReport: 'testInvoice',
  }

  const steps: GuideStep[] = GUIDE_ORDER.map((id) => {
    if (done[id]) return { id, status: 'done' as const }

    if (id === 'activation') {
      // Waiting for Jedro+, but only once the user's own part is finished.
      if (done.certificate && done.registration) return { id, status: 'waiting' as const }
      return { id, status: 'locked' as const, lockedBecause: done.certificate ? 'registration' : 'certificate' }
    }

    const needs = requires[id]
    if (needs && !done[needs]) return { id, status: 'locked' as const, lockedBecause: needs }
    return { id, status: 'todo' as const }
  })

  // The first step that isn't finished and isn't locked is "the next one".
  const next = steps.find((s) => s.status === 'todo' || s.status === 'waiting')
  if (next && next.status === 'todo') next.status = 'current'

  const doneCount = steps.filter((s) => s.status === 'done').length
  return {
    steps,
    done: doneCount,
    total: steps.length,
    nextId: next?.id ?? null,
    complete: doneCount === steps.length,
  }
}

/** Is a premise complete enough for FURS (street, house number, city, post code)? */
export function premiseHasFullAddress(p: {
  premise_type: string | null
  address: string | null
  house_number: string | null
  city: string | null
  postal_code: string | null
}): boolean {
  if (p.premise_type === 'movable') return true
  return Boolean(p.address?.trim() && p.house_number?.trim() && p.city?.trim() && p.postal_code?.trim())
}
