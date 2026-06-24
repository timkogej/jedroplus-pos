import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Header from '@/components/layout/Header'
import AppointmentInvoiceCard from '@/components/appointment/AppointmentInvoiceCard'
import Link from 'next/link'
import Button from '@/components/ui/Button'

export const revalidate = 0

export default async function AppointmentsPage({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, slug, name, company_id')
    .eq('slug', params.slug)
    .single()

  if (!company) redirect('/login')

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
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-gray-500 font-medium">Ni dokončanih terminov</p>
            <p className="text-xs text-gray-400 mt-1">Ko so termini dokončani, se pojavijo tukaj</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-2xl mx-auto">
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Za izstavitev ({enriched.length})
              </h2>
              <div className="space-y-2">
                {enriched.map((apt) => (
                  <AppointmentInvoiceCard key={apt.id} appointment={apt} slug={params.slug} />
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
