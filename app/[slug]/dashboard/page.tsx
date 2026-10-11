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
import GuideCard from '@/components/guide/GuideCard'
import { loadGuideData } from '@/lib/guide/facts'
import AttentionBanner from '@/components/dashboard/AttentionBanner'
import RevenueChart, { type RevenuePoint } from '@/components/dashboard/RevenueChart'
import type { PosInvoice } from '@/types'
import { ljDateString, ljMidnightUtc } from '@/lib/time'
import Alert from '@/components/ui/Alert'

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
    guide,
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
    loadGuideData(supabase, company.id),
  ])

  const onboardingSkipped = (await cookies()).get('onboarding_skipped')?.value === params.slug
  const needsOnboarding = !onboardingCompanyData || (premiseCount ?? 0) === 0
  if (needsOnboarding && !onboardingSkipped) {
    redirect(`/${params.slug}/onboarding/step1`)
  }

  // Show the FURS reminder banner whenever there's no active certificate yet —
  // until then invoices are issued in FURS test mode.
  const hiddenUntil = guide.state.guideHiddenUntil ? new Date(guide.state.guideHiddenUntil) : null
  const showGuide = !guide.summary.complete && !guide.state.guideDismissed && !(hiddenUntil && hiddenUntil > new Date())
  // The guide already explains the missing certificate; keep the reminder only when the guide is hidden.
  const showFursBanner = (activeCerts?.length ?? 0) === 0 && !showGuide
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
            <Button size="sm">+ Izstavi račun</Button>
          </Link>
        }
      />
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {(attentionItems?.length ?? 0) > 0 && (
            <AttentionBanner items={attentionItems!} companyId={company.id} slug={params.slug} />
          )}

          {showGuide && (
            <GuideCard
              summary={guide.summary}
              slug={params.slug}
              activationRequestedAt={guide.state.activationRequestedAt}
            />
          )}

          {certStatus && certStatus.state !== 'ok' && (
            <Alert
              variant={certStatus.state === 'expired' ? 'error' : 'warning'}
              title={
                certStatus.state === 'expired'
                  ? 'Certifikat je potekel — računov ni več mogoče potrjevati'
                  : `Certifikat poteče čez ${certStatus.daysLeft} dni`
              }
              action={
                <Link href={`/${params.slug}/settings/certificate`}>
                  <Button size="sm">Naloži nov certifikat →</Button>
                </Link>
              }
            >
              Naročite novo potrdilo pri FURS (eDavki) in ga naložite v nastavitvah.
            </Alert>
          )}

          {/* Certificate reminder — shown while the guide is hidden and there is no certificate yet */}
          {showFursBanner && (
            <Alert
              variant="warning"
              title="Za prave račune dodajte digitalno potrdilo (certifikat)"
              action={
                <Link href={`/${params.slug}/settings/certificate`}>
                  <Button size="sm">Dodaj certifikat →</Button>
                </Link>
              }
            >
              Do takrat so računi označeni TESTNI.
            </Alert>
          )}

          <Suspense fallback={<DashboardSkeleton />}>
            <DashboardBody
              company={company}
              slug={params.slug}
              loyaltyEnabled={Boolean(loyaltySettings?.loyalty_enabled)}
            />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
