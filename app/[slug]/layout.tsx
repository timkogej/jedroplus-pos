import { createServiceClient } from '@/lib/supabase'
import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireCompanyForSlug } from '@/lib/auth/serverCompany'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import AuthGuard from '@/components/layout/AuthGuard'
import NavigationProgress from '@/components/layout/NavigationProgress'
import { GuideProvider } from '@/components/guide/GuideProvider'
import SubscriptionBanner from '@/components/layout/SubscriptionBanner'
import MissedClosingBanner from '@/components/layout/MissedClosingBanner'
import { dayBounds, localDateString } from '@/lib/z-report/calculate'

const getLayoutData = unstable_cache(
  async (companyId: string, companyCode: string | null, yesterday: string) => {
    const supabase = createServiceClient()
    const { start: yStart, end: yEnd } = dayBounds(yesterday)
    const [{ data: subscription }, { data: yesterdayReport }, { count }, { data: branding }] = await Promise.all([
      supabase
        .from('pos_subscriptions')
        .select('status, trial_ends_at, current_period_end, canceled_at')
        .eq('company_id', companyId)
        .maybeSingle(),
      supabase.from('pos_z_reports').select('id').eq('company_id', companyId).eq('report_date', yesterday).maybeSingle(),
      supabase
        .from('pos_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('invoice_date', yStart)
        .lt('invoice_date', yEnd),
      companyCode
        ? supabase.from('Podatki podjetij').select('"Naziv Podjetja"').eq('ID Podjetja', companyCode).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    return {
      subscription: subscription ?? null,
      yesterdayReport: yesterdayReport ?? null,
      yesterdayInvoiceCount: count ?? 0,
      branding: (branding as Record<string, string | null> | null) ?? null,
    }
  },
  ['company-layout-data'],
  { revalidate: 60, tags: ['layout-data'] }
)

export default async function CompanyLayout(
  props: {
    children: React.ReactNode
    params: Promise<{ slug: string }>
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const supabase = createServiceClient()

  // Verify the slug exists at all; redirect to login if not.
  const company = await requireCompanyForSlug(params.slug)

  // Subscription, yesterday's closing and the display name — cached for 60 s per
  // company (the Stripe webhook clears it when a subscription changes), so most
  // navigations skip these database round trips entirely.
  const yesterday = localDateString(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const { subscription, yesterdayReport, yesterdayInvoiceCount, branding } = await getLayoutData(
    company.id,
    company.company_id,
    yesterday
  )

  // --- Subscription guard -------------------------------------------------
  // The slug identifies the company, so we can gate access server-side without
  // the user session (which lives in localStorage, not cookies). No subscription
  // or a canceled one → send them to /pricing to (re)subscribe.
  const status = subscription?.status ?? null
  const currentPeriodEnd = subscription?.current_period_end ?? null
  const canceledAt = subscription?.canceled_at ?? null
  // The paid period is still running if its end is in the future.
  const periodActive = currentPeriodEnd ? new Date(currentPeriodEnd) > new Date() : false

  // A canceled subscription keeps full access until the paid period actually
  // ends — access is blocked only once status='canceled' AND the period has
  // lapsed. trialing/active/past_due always have access.
  let hasAccess = status === 'trialing' || status === 'active' || status === 'past_due'
  if (status === 'canceled' && periodActive) hasAccess = true
  if (!hasAccess) redirect('/pricing')

  // Show the cancellation banner whenever a cancellation is scheduled (canceled_at
  // set) and access is still valid.
  const showCanceledBanner = canceledAt != null && periodActive

  // --- Missed daily closing: yesterday had invoices but no Z-report ----------
  const showMissedClosing = !yesterdayReport && (yesterdayInvoiceCount ?? 0) > 0

  // Prefer the display name from "Podatki podjetij"
  const displayName = (branding?.['Naziv Podjetja'] as string | undefined) || company.name

  return (
    // The session and the company were verified above (requireCompanyForSlug);
    // AuthGuard only syncs the client store and reacts to sign-out.
    <AuthGuard
      slug={params.slug}
      company={{ id: company.id, company_id: company.company_id, name: company.name, displayName }}
    >
      <GuideProvider>
      <NavigationProgress />
      <div className="flex min-h-screen">
        <Sidebar slug={params.slug} companyName={displayName} />
        <div className="flex-1 flex flex-col min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:ml-60 md:pb-0">
          {showMissedClosing && <MissedClosingBanner slug={params.slug} date={yesterday} />}
          {showCanceledBanner ? (
            <SubscriptionBanner
              slug={params.slug}
              companyId={company.id}
              status="canceled"
              currentPeriodEnd={currentPeriodEnd}
            />
          ) : (
            status === 'past_due' && (
              <SubscriptionBanner
                slug={params.slug}
                companyId={company.id}
                status={status}
              />
            )
          )}
          {children}
        </div>
        <MobileNav slug={params.slug} />
      </div>
      </GuideProvider>
    </AuthGuard>
  )
}
