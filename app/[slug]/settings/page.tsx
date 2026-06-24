import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'

function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}

function PrinterIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )
}

function CompanyIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}

function CardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm4 8h4" />
    </svg>
  )
}

function ReceiptIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

const sections = [
  {
    key: 'company',
    title: 'Podatki podjetja za račune',
    description: 'Naziv, naslov, davčna št., IBAN — prikazano v PDF računu',
    Icon: CompanyIcon,
  },
  {
    key: 'invoices',
    title: 'Nastavitve računov',
    description: 'Predpona, začetna številka in format številke računa',
    Icon: ReceiptIcon,
  },
  {
    key: 'certificate',
    title: 'Certifikat FURS',
    description: 'Naložite .p12 certifikat za podpisovanje računov',
    Icon: ShieldIcon,
  },
  {
    key: 'premises',
    title: 'Poslovni prostori',
    description: 'Upravljajte poslovne prostore in elektronske naprave',
    Icon: BuildingIcon,
  },
  {
    key: 'print',
    title: 'Tiskanje',
    description: 'Privzeti format tiskanja: A4, termalni ali vprašaj',
    Icon: PrinterIcon,
  },
  {
    key: 'payments',
    title: 'Spletna plačila',
    description: 'Povežite Stripe za sprejemanje spletnih plačil rezervacij',
    Icon: CardIcon,
  },
]

export default async function SettingsPage({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, slug, name')
    .eq('slug', params.slug)
    .single()

  if (!company) redirect('/login')

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={params.slug} title="Nastavitve" />
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-2xl border border-gray-100 px-5">
          {sections.map((section, i) => (
            <Link
              key={section.key}
              href={`/${params.slug}/settings/${section.key}`}
              className={`group flex items-center gap-4 py-4 ${i < sections.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <span className="text-gray-400 group-hover:text-gray-900 transition-colors duration-150 flex-shrink-0">
                <section.Icon />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{section.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors duration-150 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
