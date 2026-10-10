import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyForSlug } from '@/lib/auth/serverCompany'
import { loadGuideData } from '@/lib/guide/facts'
import Header from '@/components/layout/Header'
import GuideStepList from '@/components/guide/GuideStepList'
import RestartTours from '@/components/guide/RestartTours'

export const revalidate = 0

export default async function GuidePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  const company = await requireCompanyForSlug(params.slug)
  const { summary, state } = await loadGuideData(createServiceClient(), company.id)
  const percent = Math.round((summary.done / summary.total) * 100)

  return (
    <div className="flex min-h-screen flex-col">
      <Header slug={params.slug} title="Vodič" />
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-5">
          <section className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h2 className="text-lg font-semibold text-gray-900">
              {summary.complete ? 'Vse je nared' : 'Pot do prvega računa'}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {summary.complete
                ? 'Vse korake ste opravili. Blagajna je pripravljena za vsakodnevno delo.'
                : 'Prve korake opravite v nekaj minutah, potrdilo pa izda FURS. Vsak korak ima razlago in gumb, ki vas pelje na pravo mesto.'}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"
                role="progressbar"
                aria-valuenow={summary.done}
                aria-valuemin={0}
                aria-valuemax={summary.total}
                aria-label="Napredek nastavitve"
              >
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {summary.done} / {summary.total}
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-black/[0.06] bg-white px-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <GuideStepList
              steps={summary.steps}
              slug={params.slug}
              activationRequestedAt={state.activationRequestedAt}
              detailed
            />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Vodeni ogled</h2>
            <p className="mb-3 text-sm text-gray-600">Ogled obkroži posamezne dele aplikacije in pove, čemu služijo.</p>
            <RestartTours slug={params.slug} />
          </section>

          <p className="text-sm text-gray-600">
            Razlage pojmov in navodila za pogoste primere najdete v razdelku{' '}
            <Link href={`/${params.slug}/help`} className="font-medium text-brand hover:underline">
              Pomoč
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
