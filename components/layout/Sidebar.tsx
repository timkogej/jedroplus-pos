'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { usePosStore } from '@/store/posStore'
import FursStatusIndicator from '@/components/layout/FursStatusIndicator'
import JedroLogo from '@/components/layout/JedroLogo'
import NavPending from '@/components/layout/NavPending'
import { useZReportWarning } from '@/components/layout/useZReportWarning'
import { useOptionalGuide } from '@/components/guide/GuideProvider'

interface SidebarProps {
  slug: string
  companyName: string
}

function NavIcon({ children }: { children: React.ReactNode }) {
  return <span className="w-5 h-5 flex-shrink-0">{children}</span>
}

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: boolean
  /** Small text on the right, e.g. guide progress "4/9". */
  pill?: string
  /** Name used by the guided tour (data-tour="nav-…"). */
  tour: string
}

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      data-tour={`nav-${item.tour}`}
      aria-current={isActive ? 'page' : undefined}
      className={`relative flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 ${
        isActive ? 'font-semibold text-brand' : 'font-medium text-gray-600 hover:bg-black/[0.04] hover:text-gray-900'
      }`}
    >
      {isActive && (
        <motion.span
          layoutId="sidebar-pill"
          className="absolute inset-0 rounded-[10px] bg-brand/10"
          transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
        />
      )}
      <span className="relative h-[18px] w-[18px] flex-shrink-0">{item.icon}</span>
      <span className="relative">{item.label}</span>
      <NavPending />
      {item.pill && (
        <span className="relative ml-auto rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-semibold text-gray-600">
          {item.pill}
        </span>
      )}
      {'badge' in item && item.badge && (
        <span className="relative ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-red-500" title="Blagajna še ni zaključena">
          <span className="sr-only">Blagajna še ni zaključena</span>
        </span>
      )}
    </Link>
  )
}

export default function Sidebar({ slug, companyName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const clearCompanyData = usePosStore((s) => s.clearCompanyData)
  const base = `/${slug}`

  const zReportWarning = useZReportWarning()
  const guide = useOptionalGuide()?.summary ?? null

  async function handleLogout() {
    clearCompanyData()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const navItems = [
    {
      href: `${base}/dashboard`,
      label: 'Pregled',
      tour: 'dashboard',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: `${base}/appointments`,
      label: 'Termini',
      tour: 'appointments',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: `${base}/customers`,
      label: 'Stranke',
      tour: 'customers',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      href: `${base}/invoices`,
      label: 'Računi',
      tour: 'invoices',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      href: `${base}/invoices/new`,
      label: 'Nov račun',
      tour: 'new',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      href: `${base}/z-report`,
      label: 'Z-poročilo',
      tour: 'z-report',
      badge: zReportWarning,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      href: `${base}/settings`,
      label: 'Nastavitve',
      tour: 'settings',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  function isNavItemActive(href: string) {
    if (href === `${base}/invoices`) {
      return pathname === href || (pathname.startsWith(href + '/') && !pathname.startsWith(`${base}/invoices/new`))
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  const guideItem: NavItem | null =
    guide && !guide.complete
      ? {
          href: `${base}/guide`,
          label: 'Vodič',
          tour: 'guide',
          pill: `${guide.done}/${guide.total}`,
          icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          ),
        }
      : null
  const helpItem: NavItem = {
    href: `${base}/help`,
    label: 'Pomoč',
    tour: 'help',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }
  const baseItems = navItems.filter((i) => i.label !== 'Nov račun' && i.label !== 'Nastavitve')
  const mainItems = guideItem ? [baseItems[0], guideItem, ...baseItems.slice(1)] : baseItems
  const newInvoice = navItems.find((i) => i.label === 'Nov račun')!
  const settings = navItems.find((i) => i.label === 'Nastavitve')!
  const initials = companyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  return (
    <aside className="hidden h-screen flex-col border-r border-black/[0.06] bg-white/75 backdrop-blur-xl md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-60">
      {/* Brand */}
      <div className="px-5 pb-4 pt-6">
        <JedroLogo height={34} tagline />
      </div>

      {/* Primary action */}
      <div className="px-3 pb-3">
        <Link
          href={newInvoice.href}
          data-tour="new-invoice"
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] text-[14px] font-semibold text-white shadow-sm outline-none transition hover:bg-black focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nov račun
        </Link>
      </div>

      {/* Nav */}
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-1" aria-label="Glavni meni">
        {mainItems.map((item) => (
          <NavLink key={item.href} item={item} isActive={isNavItemActive(item.href)} />
        ))}
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 space-y-1 border-t border-black/[0.06] p-3">
        <NavLink item={helpItem} isActive={isNavItemActive(helpItem.href)} />
        <NavLink item={settings} isActive={isNavItemActive(settings.href)} />
        <FursStatusIndicator slug={slug} />
        <div className="mt-1 flex items-center gap-2.5 rounded-xl bg-black/[0.04] p-2">
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-gray-700 shadow-sm"
            aria-hidden="true"
          >
            {initials || 'J'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-gray-900">{companyName}</p>
            <p className="text-[11px] leading-tight text-gray-500">Prijavljeni ste</p>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Odjava"
            title="Odjava"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 outline-none transition-colors hover:bg-black/[0.06] hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
