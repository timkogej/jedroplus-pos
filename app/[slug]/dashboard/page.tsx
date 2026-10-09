import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { requireCompanyForSlug } from '@/lib/auth/serverCompany'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import Link from 'next/link'
import SubscriptionSuccessToast from '@/components/dashboard/SubscriptionSuccessToast'
import OnboardingCompleteToast from '@/components/dashboard/OnboardingCompleteToast'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import { certExpiryStatus } from '@/lib/furs/certExpiry'
import DashboardBody from './DashboardBody'
import DashboardSkeleton from './DashboardSkeleton'
import AttentionBanner from '@/components/dashboard/AttentionBanner'
import RevenueChart, { type RevenuePoint } from '@/components/dashboard/RevenueChart'
import type { PosInvoice } from '@/types'
import { ljDateString, ljMidnightUtc } from '@/lib/time'

export const revalidate = 0

export default async function DashboardPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const supabase = createServiceClient()

  const company = await requireCompanyForSlug(params.slug)

  // --- Onboarding gate ----------------------------------------------------
  // New companies (just subscribed) have no company data or premises yet. Send
  // them through the onboarding flow unless they've explicitly skipped it
  // (cookie set by the "Preskočite nastavitev" link).
  const [
    { data: onboardingCompanyData },
    { count: premiseCount },
    { data: activeCerts },
    { data: attentionItems },
    { data: loyaltySettings },
  ] = await Promise.all([
    supabase.from('pos_company_data').select('id').eq('company_id', company.id).maybeSingle(),
    supabase.from('pos_premises').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    supabase
      .from('pos_certificates')
      .select('valid_to')
      .eq('company_id', company.id)
      .eq('is_active', true)
      .limit(1),
    supabase
      .from('pos_attention_items')
      .select('id, kind, message, invoice_id')
      .eq('company_id', company.id)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('pos_settings').select('loyalty_enabled').eq('company_id', company.id).maybeSingle(),
  ])

  const onboardingSkipped = (await cookies()).get('onboarding_skipped')?.value === params.slug
  const needsOnboarding = !onboardingCompanyData || (premiseCount ?? 0) === 0
  if (needsOnboarding && !onboardingSkipped) {
    redirect(`/${params.slug}/onboarding/step1`)
  }

  // Show the FURS reminder banner whenever there's no active certificate yet —
  // until then invoices are issued in FURS test mode.
  const showFursBanner = (activeCerts?.length ?? 0) === 0
  const certStatus = certExpiryStatus(activeCerts?.[0]?.valid_to as string | undefined)

  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={null}>
        <SubscriptionSuccessToast />
        <OnboardingCompleteToast />
      </Suspense>
      <Header
        slug={params.slug}
        title="Pregled"
        action={
          <Link href={`/${params.slug}/invoices/new`}>
            <Button size="sm" className="gradient-bg text-white hover:opacity-95">+ Izstavi račun</Button>
          </Link>
        }
      />
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {(attentionItems?.length ?? 0) > 0 && (
            <AttentionBanner items={attentionItems!} companyId={company.id} slug={params.slug} />
          )}

          {certStatus && certStatus.state !== 'ok' && (
            <div
              role="alert"
              className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                certStatus.state === 'expired' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div>
                <p className={`text-sm font-semibold ${certStatus.state === 'expired' ? 'text-red-900' : 'text-amber-900'}`}>
                  {certStatus.state === 'expired'
                    ? 'FURS certifikat je potekel — računov ni več mogoče potrjevati'
                    : `FURS certifikat poteče čez ${certStatus.daysLeft} dni`}
                </p>
                <p className={`mt-0.5 text-xs ${certStatus.state === 'expired' ? 'text-red-700' : 'text-amber-700'}`}>
                  Naročite novo potrdilo pri FURS (e-Davki) in ga naložite v nastavitvah.
                </p>
              </div>
              <Link href={`/${params.slug}/settings/certificate`} className="flex-shrink-0">
                <Button size="sm">Naloži nov certifikat →</Button>
              </Link>
            </div>
          )}

          {/* FURS certificate reminder — shown until an active certificate exists */}
          {showFursBanner && (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-900">Za produkcijsko delovanje dodajte FURS certifikat</p>
                  <p className="mt-0.5 text-xs text-amber-700">V testnem načinu so računi označeni kot TESTNI.</p>
                </div>
              </div>
              <Link href={`/${params.slug}/settings/certificate`} className="flex-shrink-0">
                <Button size="sm">Dodaj certifikat →</Button>
              </Link>
            </div>
          )}

          <Suspense fallback={<DashboardSkeleton />}>
            <DashboardBody
              company={company}
              slug={params.slug}
              loyaltyEnabled={Boolean(loyaltySettings?.loyalty_enabled)}
              premiseCount={premiseCount ?? 0}
              hasCert={(activeCerts?.length ?? 0) > 0}
            />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
