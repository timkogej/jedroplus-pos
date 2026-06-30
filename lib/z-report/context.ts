import type { SupabaseClient } from '@supabase/supabase-js'
import type { PosCompanyData } from '@/types'

export interface ZReportPdfContext {
  companyName: string
  companyData: PosCompanyData | null
  brandPrimary: string
  premiseCode?: string
  deviceCode?: string
  currency: string
  isTestMode: boolean
}

/**
 * Loads everything the Z-report PDF needs: company display data, branding
 * colour, premise/device codes and FURS test-mode flag. Mirrors the data
 * gathering done by the invoice PDF route.
 */
export async function loadZReportPdfContext(
  supabase: SupabaseClient,
  companyId: string,
  premiseId: string | null,
  deviceId: string | null
): Promise<ZReportPdfContext> {
  const [{ data: company }, { data: companyData }, { data: settings }, { data: premise }, { data: device }] =
    await Promise.all([
      supabase.from('companies').select('name, company_id').eq('id', companyId).single(),
      supabase.from('pos_company_data').select('*').eq('company_id', companyId).maybeSingle(),
      supabase.from('pos_settings').select('currency, furs_environment').eq('company_id', companyId).maybeSingle(),
      premiseId
        ? supabase.from('pos_premises').select('premise_id').eq('id', premiseId).maybeSingle()
        : Promise.resolve({ data: null }),
      deviceId
        ? supabase.from('pos_devices').select('device_id').eq('id', deviceId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

  let brandPrimary = '#6D5EF7'
  if (company?.company_id) {
    const { data: branding } = await supabase
      .from('Podatki podjetij')
      .select('brand_primary')
      .eq('ID Podjetja', company.company_id)
      .maybeSingle()
    if (branding?.brand_primary) brandPrimary = branding.brand_primary as string
  }

  return {
    companyName: company?.name ?? '',
    companyData: (companyData as PosCompanyData | null) ?? null,
    brandPrimary,
    premiseCode: (premise as { premise_id?: string } | null)?.premise_id,
    deviceCode: (device as { device_id?: string } | null)?.device_id,
    currency: (settings?.currency as string | undefined) ?? 'EUR',
    isTestMode: (settings?.furs_environment ?? 'test') === 'test',
  }
}
