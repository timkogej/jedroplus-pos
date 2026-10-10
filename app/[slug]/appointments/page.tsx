import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { requireCompanyForSlug } from '@/lib/auth/serverCompany'
import Header from '@/components/layout/Header'
import AppointmentInvoiceCard from '@/components/appointment/AppointmentInvoiceCard'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import { ExampleAppointmentCard, ExampleInvoicePreview } from '@/components/guide/Examples'

export const revalidate = 0

export default async function AppointmentsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const supabase = createServiceClient()

  const company = await requireCompanyForSlug(params.slug)

  // Load completed, un-invoiced appointments for this company
  // "ID podjetja" contains the short company code (company_id), not the UUID
  const { data: appointments } = await supabase
    .from('Termini')
    .select('*')
    .eq('ID podjetja', company.company_id)
    .eq('Status', 'completed')
    .is('ID računa', null)
    .order('Datum', { ascending: false })
    .limit(100)

  const enriched = (appointments ?? []).map((a) => ({
    ...a,
    clientName: a['Stranka'] ?? '',
  }))

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        slug={params.slug}
        title="Termini"
        action={
          <Link href={`/${params.slug}/invoices/new`}>
            <Button size="sm">+ Nov račun</Button>
          </Link>
        }
      />
      <main className="flex-1 p-4 md:p-6">
        {enriched.length === 0 ? (
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="text-center">
              <p className="text-base font-semibold text-gray-900">Ni dokončanih terminov</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
                Ko v aplikaciji Jedro+ termin označite kot dokončan, se pojavi tukaj. Račun zanj izdate z enim klikom.
              </p>
            </div>

            <section aria-label="Kako to izgleda">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Tako bo izgledalo</h2>
              <div className="space-y-3">
                <ExampleAppointmentCard highlight />
                <p className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  Pritisnite <span className="font-semibold text-gray-900">Izstavi</span> in odpre se račun
                </p>
                <ExampleInvoicePreview />
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-6 max-w-2xl mx-auto">
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Za izstavitev ({enriched.length})
              </h2>
              <div className="space-y-2">
                {enriched.map((apt, i) => (
                  <AppointmentInvoiceCard key={apt.id} appointment={apt} slug={params.slug} tourFirst={i === 0} />
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
