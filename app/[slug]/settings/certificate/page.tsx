import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import CertificateUpload from '@/components/settings/CertificateUpload'

export const revalidate = 0

export default async function CertificatePage({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, slug, name')
    .eq('slug', params.slug)
    .single()

  if (!company) redirect('/login')

  const { data: cert } = await supabase
    .from('pos_certificates')
    .select('tax_number, valid_from, valid_to')
    .eq('company_id', company.id)
    .eq('is_active', true)
    .single()

  const { data: settings } = await supabase
    .from('pos_settings')
    .select('furs_environment')
    .eq('company_id', company.id)
    .single()

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={params.slug} title="Certifikat FURS" />
      <main className="flex-1 p-4 md:p-6 max-w-xl mx-auto w-full">
        <div className="mb-4">
          <Link href={`/${params.slug}/settings`} className="text-sm text-gray-400 hover:text-gray-600">
            ← Nastavitve
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Digitalni certifikat</h2>
          <p className="text-sm text-gray-500 mb-5">
            Za potrjevanje računov pri FURS potrebujete digitalni certifikat (.p12) izdan s strani FURS.
          </p>

          <CertificateUpload
            companyId={company.id}
            existingCert={cert ?? null}
          />
        </div>

        {/* FURS environment info */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-700">Okolje FURS</p>
          <p className="text-sm text-amber-600 mt-1">
            Trenutno: <strong>{settings?.furs_environment === 'production' ? 'Produkcija' : 'Test'}</strong>
          </p>
          <p className="text-xs text-amber-500 mt-1">
            {settings?.furs_environment === 'test'
              ? 'Računi se pošiljajo na testni strežnik FURS. Za pravo poslovanje preklopite na produkcijo.'
              : 'Računi se potrjujejo pri uradnem FURS strežniku.'}
          </p>
        </div>
      </main>
    </div>
  )
}
