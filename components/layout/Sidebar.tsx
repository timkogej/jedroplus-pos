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
import Icon from '@/components/ui/Icon'

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
        <Icon name="home" className="h-full w-full" strokeWidth={1.7} />
      ),
    },
    {
      href: `${base}/appointments`,
      label: 'Termini',
      tour: 'appointments',
      icon: (
        <Icon name="calendar" className="h-full w-full" strokeWidth={1.7} />
      ),
    },
    {
      href: `${base}/customers`,
      label: 'Stranke',
      tour: 'customers',
      icon: (
        <Icon name="customers" className="h-full w-full" strokeWidth={1.7} />
      ),
    },
    {
      href: `${base}/invoices`,
      label: 'Računi',
      tour: 'invoices',
      icon: (
        <Icon name="document" className="h-full w-full" strokeWidth={1.7} />
      ),
    },
    {
      href: `${base}/invoices/new`,
      label: 'Nov račun',
      tour: 'new',
      icon: (
        <Icon name="plus" className="h-full w-full" strokeWidth={1.7} />
      ),
    },
    {
      href: `${base}/z-report`,
      label: 'Z-poročilo',
      tour: 'z-report',
      badge: zReportWarning,
      icon: (
        <Icon name="report" className="h-full w-full" strokeWidth={1.7} />
      ),
    },
    {
      href: `${base}/settings`,
      label: 'Nastavitve',
      tour: 'settings',
      icon: (
        <Icon name="settings" className="h-full w-full" strokeWidth={1.7} />
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
            <Icon name="map" className="h-full w-full" strokeWidth={1.7} />
          ),
        }
      : null
  const helpItem: NavItem = {
    href: `${base}/help`,
    label: 'Pomoč',
    tour: 'help',
    icon: (
      <Icon name="help" className="h-full w-full" strokeWidth={1.7} />
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
          <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
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
            <Icon name="logout" className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </aside>
  )
}
