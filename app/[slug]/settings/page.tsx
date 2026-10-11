import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { requireCompanyForSlug } from '@/lib/auth/serverCompany'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Icon from '@/components/ui/Icon'

function ShieldIcon() {
  return (
    <Icon name="shield" className="w-5 h-5" />
  )
}

function BuildingIcon() {
  return (
    <Icon name="building" className="w-5 h-5" />
  )
}

function PrinterIcon() {
  return (
    <Icon name="print" className="w-5 h-5" />
  )
}

function CompanyIcon() {
  return (
    <Icon name="company" className="w-5 h-5" />
  )
}

function CardIcon() {
  return (
    <Icon name="card" className="w-5 h-5" />
  )
}

function ReceiptIcon() {
  return (
    <Icon name="document" className="w-5 h-5" />
  )
}

function GiftIcon() {
  return (
    <Icon name="gift" className="w-5 h-5" />
  )
}

function StarIcon() {
  return (
    <Icon name="star" className="w-5 h-5" />
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
  {
    key: 'loyalty',
    title: 'Zvestobne točke',
    description: 'Nagrajujte stranke s točkami za vsak nakup',
    Icon: GiftIcon,
  },
  {
    key: 'subscription',
    title: 'Naročnina',
    description: 'Upravljajte svoj paket, plačila in naročnino',
    Icon: StarIcon,
  },
]

export default async function SettingsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const supabase = createServiceClient()

  const company = await requireCompanyForSlug(params.slug)

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={params.slug} title="Nastavitve" />
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-5">
          {sections.map((section, i) => (
            <Link
              key={section.key}
              href={`/${params.slug}/settings/${section.key}`}
              className={`group flex items-center gap-4 py-4 ${i < sections.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <span className="text-gray-500 group-hover:text-gray-900 transition-colors duration-150 flex-shrink-0">
                <section.Icon />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{section.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
              </div>
              <Icon name="chevronRight" className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors duration-150 flex-shrink-0" strokeWidth={2} />
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
