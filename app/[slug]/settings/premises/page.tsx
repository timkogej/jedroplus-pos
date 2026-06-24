import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import PremisesForm from '@/components/settings/PremisesForm'
import type { PosPremise, PosDevice } from '@/types'

export const revalidate = 0

export default async function PremisesPage({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, slug, name')
    .eq('slug', params.slug)
    .single()

  if (!company) redirect('/login')

  const [{ data: premises }, { data: devices }] = await Promise.all([
    supabase.from('pos_premises').select('*').eq('company_id', company.id).order('created_at'),
    supabase.from('pos_devices').select('*').eq('company_id', company.id).order('created_at'),
  ])

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={params.slug} title="Poslovni prostori" />
      <main className="flex-1 p-4 md:p-6 max-w-xl mx-auto w-full">
        <div className="mb-4">
          <Link href={`/${params.slug}/settings`} className="text-sm text-gray-400 hover:text-gray-600">
            ← Nastavitve
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Poslovni prostori in naprave</h2>
          <p className="text-sm text-gray-500 mb-5">
            Za izstavljanje računov potrebujete vsaj en poslovni prostor in eno elektronsko napravo.
          </p>

          <PremisesForm
            companyId={company.id}
            initialPremises={(premises ?? []) as PosPremise[]}
            initialDevices={(devices ?? []) as PosDevice[]}
          />
        </div>
      </main>
    </div>
  )
}
