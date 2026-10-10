import type { SupabaseClient } from '@supabase/supabase-js'
import { deriveGuideSteps, premiseHasFullAddress, type GuideFacts, type GuideSummary } from '@/lib/guide/steps'

export interface GuideState {
  guideHiddenUntil: string | null
  guideDismissed: boolean
  tourSeen: Record<string, boolean>
  activationRequestedAt: string | null
  activatedAt: string | null
}

export interface GuideData {
  summary: GuideSummary
  state: GuideState
  environment: 'test' | 'production'
  facts: GuideFacts
}

const NO_STATE: GuideState = {
  guideHiddenUntil: null,
  guideDismissed: false,
  tourSeen: {},
  activationRequestedAt: null,
  activatedAt: null,
}

/**
 * Collects what the guide needs to know about a company in one round of queries
 * (service-role client). Every rule that turns this into step statuses is in
 * lib/guide/steps.ts. A missing pos_onboarding_state table (migration 030 not run
 * yet) just means "no saved choices".
 */
export async function loadGuideData(supabase: SupabaseClient, companyId: string): Promise<GuideData> {
  const [
    { data: companyData },
    { data: stateRow },
    { data: premises },
    { data: devices },
    { count: invoiceCount },
    { data: certs },
    { data: settings },
    { count: zReportCount },
  ] = await Promise.all([
    supabase
      .from('pos_company_data')
      .select('company_name, address, postal_code, city, tax_number, email')
      .eq('company_id', companyId)
      .maybeSingle(),
    supabase
      .from('pos_onboarding_state')
      .select('vat_confirmed, guide_hidden_until, guide_dismissed, tour_seen, activation_requested_at, activated_at')
      .eq('company_id', companyId)
      .maybeSingle(),
    supabase
      .from('pos_premises')
      .select('id, premise_type, address, house_number, city, postal_code, is_active, furs_closed, furs_registered')
      .eq('company_id', companyId),
    supabase.from('pos_devices').select('premise_id, is_active').eq('company_id', companyId),
    supabase.from('pos_invoices').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('pos_certificates').select('valid_to').eq('company_id', companyId).eq('is_active', true).limit(1),
    supabase.from('pos_settings').select('furs_environment').eq('company_id', companyId).maybeSingle(),
    supabase.from('pos_z_reports').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
  ])

  const state: GuideState = stateRow
    ? {
        guideHiddenUntil: (stateRow.guide_hidden_until as string | null) ?? null,
        guideDismissed: Boolean(stateRow.guide_dismissed),
        tourSeen: (stateRow.tour_seen as Record<string, boolean> | null) ?? {},
        activationRequestedAt: (stateRow.activation_requested_at as string | null) ?? null,
        activatedAt: (stateRow.activated_at as string | null) ?? null,
      }
    : NO_STATE

  const environment: 'test' | 'production' = settings?.furs_environment === 'production' ? 'production' : 'test'

  const activePremises = (premises ?? []).filter((p) => p.is_active && !p.furs_closed)
  const activeDevices = (devices ?? []).filter((d) => d.is_active)
  const premiseReady = activePremises.some(
    (p) =>
      premiseHasFullAddress(p as Parameters<typeof premiseHasFullAddress>[0]) &&
      activeDevices.some((d) => d.premise_id === p.id)
  )

  const cd = companyData as Record<string, string | null> | null
  const companyDataComplete = Boolean(
    cd?.company_name?.trim() && cd?.address?.trim() && cd?.postal_code?.trim() && cd?.city?.trim() && cd?.tax_number?.trim() && cd?.email?.trim()
  )

  const validTo = certs?.[0]?.valid_to ? new Date(certs[0].valid_to as string) : null
  const certificateActive = Boolean(certs?.length)
  const certificateExpired = certificateActive && validTo !== null && validTo.getTime() < Date.now()

  // "Real" invoices: FURS-confirmed, not demo, issued after real mode was switched on.
  let realInvoiceCount = 0
  if (state.activatedAt) {
    const { data: confirmed } = await supabase
      .from('pos_invoices')
      .select('furs_response')
      .eq('company_id', companyId)
      .not('eor', 'is', null)
      .gte('created_at', state.activatedAt)
      .limit(20)
    realInvoiceCount = (confirmed ?? []).filter(
      (i) => (i.furs_response as { demo?: boolean } | null)?.demo !== true
    ).length
  }

  const facts: GuideFacts = {
    companyDataComplete,
    vatConfirmed: Boolean(stateRow?.vat_confirmed),
    premiseReady,
    invoiceCount: invoiceCount ?? 0,
    certificateActive,
    certificateExpired,
    premisesRegistered: activePremises.length > 0 && activePremises.every((p) => p.furs_registered),
    environment,
    activationRequestedAt: state.activationRequestedAt,
    realInvoiceCount,
    zReportCount: zReportCount ?? 0,
  }

  return { summary: deriveGuideSteps(facts), state, environment, facts }
}
