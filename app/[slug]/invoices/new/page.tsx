import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Header from '@/components/layout/Header'
import InvoiceForm from '@/components/invoice/InvoiceForm'
import type { PosPremise, PosDevice, PosSettings, PosCompanyData, InvoiceItemForm } from '@/types'

export const revalidate = 0

/** Coerce a DB price value (which may arrive as a string, possibly with a
 *  comma decimal separator) into a finite number. Falls back to 0. */
function toPrice(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

interface SearchParams {
  appointmentId?: string
  service?: string
  price?: string
  originalPrice?: string
  discount?: string
  discountType?: string
  clientName?: string
  clientEmail?: string
  currency?: string
  service2Id?: string
  service3Id?: string
}

export default async function NewInvoicePage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: SearchParams
}) {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, slug, name')
    .eq('slug', params.slug)
    .single()

  if (!company) redirect('/login')

  const [{ data: settings }, { data: premises }, { data: devices }, { data: companyData }] = await Promise.all([
    supabase.from('pos_settings').select('*').eq('company_id', company.id).single(),
    supabase.from('pos_premises').select('*').eq('company_id', company.id).eq('is_active', true),
    supabase.from('pos_devices').select('*').eq('company_id', company.id).eq('is_active', true),
    supabase.from('pos_company_data').select('*').eq('company_id', company.id).maybeSingle(),
  ])

  if (!premises?.length) {
    redirect(`/${params.slug}/settings/premises`)
  }

  let prefill: Record<string, unknown> | undefined
  if (searchParams.appointmentId) {
    const defaultVat = (settings as PosSettings | null)?.default_vat_rate ?? 22
    const price = parseFloat(searchParams.price ?? '0')
    const originalPrice = parseFloat(searchParams.originalPrice ?? '0')
    const discount = parseFloat(searchParams.discount ?? '0')
    const discountType = searchParams.discountType as '%' | '€' | undefined
    const currency = searchParams.currency || (settings as PosSettings | null)?.currency || 'EUR'

    let clientName = decodeURIComponent(searchParams.clientName ?? '')
    let clientEmail = decodeURIComponent(searchParams.clientEmail ?? '')
    let clientPhone = ''

    // Fetch termin to get all service IDs, client ID, and currency
    const { data: termin } = await supabase
      .from('Termini')
      .select('"ID stranke", "ID storitve", "ID storitve 2", "ID storitve 3", "Valuta"')
      .eq('id', searchParams.appointmentId)
      .single()

    const strankaId = termin?.['ID stranke']
    const service1Id = termin?.['ID storitve']
    const service2Id = termin?.['ID storitve 2'] || searchParams.service2Id
    const service3Id = termin?.['ID storitve 3'] || searchParams.service3Id
    const appointmentCurrency = termin?.['Valuta'] || currency

    console.log('[Invoice] Fetching appointment', searchParams.appointmentId, {
      service1Id,
      service2Id,
      service3Id,
      strankaId,
    })

    // Resolve client and all three services in parallel
    const [strankaResult, svc1Result, svc2Result, svc3Result] = await Promise.all([
      strankaId
        ? supabase
            .from('Stranke')
            .select('Ime, Priimek, Stranka, "Email stranke", "Telefonska številka"')
            .eq('ID stranke', strankaId)
            .single()
        : Promise.resolve({ data: null }),
      service1Id
        ? supabase.from('Storitve').select('"Naziv", "Cena"').eq('id', parseInt(String(service1Id), 10)).single()
        : Promise.resolve({ data: null }),
      service2Id
        ? supabase.from('Storitve').select('"Naziv", "Cena"').eq('id', parseInt(String(service2Id), 10)).single()
        : Promise.resolve({ data: null }),
      service3Id
        ? supabase.from('Storitve').select('"Naziv", "Cena"').eq('id', parseInt(String(service3Id), 10)).single()
        : Promise.resolve({ data: null }),
    ])

    console.log('[Invoice] Lookup results:', {
      svc1: svc1Result.data,
      svc2: svc2Result.data,
      svc3: svc3Result.data,
      stranka: strankaResult.data,
    })

    if (strankaResult.data) {
      const stranka = strankaResult.data
      const ime = (stranka['Ime'] as string | null) ?? ''
      const priimek = (stranka['Priimek'] as string | null) ?? ''
      clientName =
        (stranka['Stranka'] as string | null) ||
        (ime + (priimek ? ' ' + priimek : '')).trim() ||
        clientName
      clientEmail = (stranka['Email stranke'] as string | null) || clientEmail
      clientPhone = (stranka['Telefonska številka'] as string | null) ?? ''
    }

    // Build invoice items — each service is a separate line with its own Cena
    const items: InvoiceItemForm[] = []

    if (svc1Result.data) {
      items.push({
        description: (svc1Result.data['Naziv'] as string) ?? decodeURIComponent(searchParams.service ?? 'Storitev'),
        quantity: 1,
        unit_price: toPrice(svc1Result.data['Cena']),
        vat_rate: defaultVat,
      })
    } else {
      // Fallback: name from URL param, price from appointment total
      items.push({
        description: decodeURIComponent(searchParams.service ?? 'Storitev'),
        quantity: 1,
        unit_price: originalPrice > 0 ? originalPrice : price,
        vat_rate: defaultVat,
      })
    }

    if (svc2Result.data) {
      items.push({
        description: (svc2Result.data['Naziv'] as string) ?? 'Storitev 2',
        quantity: 1,
        unit_price: toPrice(svc2Result.data['Cena']),
        vat_rate: defaultVat,
      })
    }

    if (svc3Result.data) {
      items.push({
        description: (svc3Result.data['Naziv'] as string) ?? 'Storitev 3',
        quantity: 1,
        unit_price: toPrice(svc3Result.data['Cena']),
        vat_rate: defaultVat,
      })
    }

    prefill = {
      appointmentId: searchParams.appointmentId,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone,
      currency: appointmentCurrency,
      items,
      discount_amount: discount,
      discount_type: discountType ?? '%',
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={params.slug} title={searchParams.appointmentId ? 'Račun za termin' : 'Nov račun'} />
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full pb-12">
        <InvoiceForm
          companyId={company.id}
          slug={params.slug}
          settings={settings as PosSettings | null}
          premises={(premises ?? []) as PosPremise[]}
          devices={(devices ?? []) as PosDevice[]}
          prefill={prefill as Parameters<typeof InvoiceForm>[0]['prefill']}
          companyName={company.name}
          companyData={companyData as PosCompanyData | null}
        />
      </main>
    </div>
  )
}
