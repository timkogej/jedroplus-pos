import { createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import AuthGuard from '@/components/layout/AuthGuard'
import SubscriptionBanner from '@/components/layout/SubscriptionBanner'
import MissedClosingBanner from '@/components/layout/MissedClosingBanner'
import { dayBounds, localDateString } from '@/lib/z-report/calculate'

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  const supabase = createServiceClient()

  // Verify the slug exists at all; redirect to login if not.
  const { data: company, error } = await supabase
    .from('companies')
    .select('id, slug, name, company_id')
    .eq('slug', params.slug)
    .single()

  if (error || !company) redirect('/login')

  // --- Subscription guard -------------------------------------------------
  // The slug identifies the company, so we can gate access server-side without
  // the user session (which lives in localStorage, not cookies). No subscription
  // or a canceled one → send them to /pricing to (re)subscribe.
  const { data: subscription } = await supabase
    .from('pos_subscriptions')
    .select('status, trial_ends_at, current_period_end, canceled_at')
    .eq('company_id', company.id)
    .maybeSingle()

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

  // --- Missed daily closing -----------------------------------------------
  // If yesterday had invoices but no Z-report, nudge the user to close it.
  const yesterday = localDateString(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const { start: yStart, end: yEnd } = dayBounds(yesterday)
  const [{ data: yesterdayReport }, { count: yesterdayInvoiceCount }] = await Promise.all([
    supabase
      .from('pos_z_reports')
      .select('id')
      .eq('company_id', company.id)
      .eq('report_date', yesterday)
      .maybeSingle(),
    supabase
      .from('pos_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .gte('invoice_date', yStart)
      .lt('invoice_date', yEnd),
  ])
  const showMissedClosing = !yesterdayReport && (yesterdayInvoiceCount ?? 0) > 0

  // Prefer the display name from "Podatki podjetij"
  let displayName = company.name
  if (company.company_id) {
    const { data: branding } = await supabase
      .from('Podatki podjetij')
      .select('"Naziv Podjetja"')
      .eq('ID Podjetja', company.company_id)
      .maybeSingle()
    if (branding?.['Naziv Podjetja']) {
      displayName = branding['Naziv Podjetja'] as string
    }
  }

  return (
    // AuthGuard runs client-side: verifies session, confirms slug belongs to the
    // logged-in user, and redirects to the correct slug if mismatched.
    <AuthGuard slug={params.slug}>
      <div className="flex min-h-screen">
        <Sidebar slug={params.slug} companyName={displayName} />
        <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
          {showMissedClosing && <MissedClosingBanner slug={params.slug} date={yesterday} />}
          {showCanceledBanner ? (
            <SubscriptionBanner
              slug={params.slug}
              companyId={company.id}
              status="canceled"
              currentPeriodEnd={currentPeriodEnd}
            />
          ) : (
            (status === 'trialing' || status === 'past_due') && (
              <SubscriptionBanner
                slug={params.slug}
                companyId={company.id}
                status={status}
                trialEndsAt={subscription?.trial_ends_at ?? null}
              />
            )
          )}
          {children}
        </div>
        <MobileNav slug={params.slug} />
      </div>
    </AuthGuard>
  )
}
