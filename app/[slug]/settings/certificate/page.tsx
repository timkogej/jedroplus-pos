import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { requireCompanyForSlug } from '@/lib/auth/serverCompany'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import CertificateUpload from '@/components/settings/CertificateUpload'
import HelpTip from '@/components/help/HelpTip'
import Alert from '@/components/ui/Alert'

export const revalidate = 0

export default async function CertificatePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const supabase = createServiceClient()

  const company = await requireCompanyForSlug(params.slug)

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
          <Link href={`/${params.slug}/settings`} className="text-sm text-gray-500 hover:text-gray-600">
            ← Nastavitve
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] shadow-sm p-5">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-gray-900">Digitalni certifikat <HelpTip term="certificate" /></h2>
          <p className="text-sm text-gray-500 mb-5">
            Za potrjevanje računov pri FURS potrebujete digitalni certifikat (.p12) izdan s strani FURS.
          </p>

          <CertificateUpload
            companyId={company.id}
            existingCert={cert ?? null}
          />
        </div>

        {/* Which FURS environment this company is in */}
        {settings?.furs_environment === 'production' ? (
          <Alert variant="success" title="Pravo delovanje" className="mt-4">
            Računi se potrjujejo pri uradnem strežniku FURS.
          </Alert>
        ) : (
          <Alert
            variant="warning"
            title="Testno okolje"
            className="mt-4"
            action={
              <Link href={`/${params.slug}/guide`} className="text-sm font-medium text-amber-900 underline">
                Odpri vodič
              </Link>
            }
          >
            Računi uradno še ne veljajo. Pravo delovanje vam vklopi ekipa Jedro+, ko sta certifikat in registracija
            prostora opravljena.
          </Alert>
        )}
      </main>
    </div>
  )
}
