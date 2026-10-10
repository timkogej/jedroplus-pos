import { requireCompanyForSlug } from '@/lib/auth/serverCompany'
import Header from '@/components/layout/Header'
import RestartTours from '@/components/guide/RestartTours'
import { GLOSSARY } from '@/lib/help/glossary'
import { HELP_CASES } from '@/lib/help/cases'
import { SUPPORT_EMAIL } from '@/lib/help/contact'

export const revalidate = 0

const card = 'rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'

export default async function HelpPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  await requireCompanyForSlug(params.slug)

  return (
    <div className="flex min-h-screen flex-col">
      <Header slug={params.slug} title="Pomoč" />
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <section className={`${card} p-5`}>
            <h2 className="text-base font-semibold text-gray-900">Ne najdete odgovora?</h2>
            <p className="mt-1 text-sm text-gray-600">Napišite nam in odgovorimo čim prej.</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-3 inline-flex items-center rounded-lg bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-black focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {SUPPORT_EMAIL}
            </a>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Vodeni ogled</h2>
            <RestartTours slug={params.slug} />
          </section>

          <section id="primeri" className="scroll-mt-24">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Pogosti primeri</h2>
            <div className={`${card} divide-y divide-gray-100`}>
              {HELP_CASES.map((c) => (
                <details key={c.id} className="group px-5 py-3.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-medium text-gray-900 outline-none focus-visible:underline">
                    {c.title}
                    <svg className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-gray-600">
                    {c.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  {c.note && <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">{c.note}</p>}
                </details>
              ))}
            </div>
          </section>

          <section id="pojmi" className="scroll-mt-24">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Pojmi</h2>
            <dl className={`${card} divide-y divide-gray-100`}>
              {Object.entries(GLOSSARY).map(([key, g]) => (
                <div key={key} className="px-5 py-3.5">
                  <dt className="text-[15px] font-semibold text-gray-900">{g.term}</dt>
                  <dd className="mt-1 text-sm text-gray-600">
                    {g.short}
                    {g.more && <span className="mt-1 block text-gray-500">{g.more}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
    </div>
  )
}
