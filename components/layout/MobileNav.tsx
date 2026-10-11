'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { usePosStore } from '@/store/posStore'
import { useZReportWarning } from '@/components/layout/useZReportWarning'
import { useOptionalGuide } from '@/components/guide/GuideProvider'
import Icon, { type IconName } from '@/components/ui/Icon'

interface MobileNavProps {
  slug: string
}

export default function MobileNav({ slug }: MobileNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const clearCompanyData = usePosStore((s) => s.clearCompanyData)
  const zWarning = useZReportWarning()
  const guide = useOptionalGuide()?.summary ?? null
  const base = `/${slug}`
  const [moreOpen, setMoreOpen] = useState(false)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Close the sheet whenever the page changes.
  useEffect(() => setMoreOpen(false), [pathname])

  // Escape closes; focus moves into the sheet and back to the button afterwards.
  useEffect(() => {
    if (!moreOpen) return
    const button = moreButtonRef.current
    const raf = requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>('a,button')?.focus())
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      button?.focus?.()
    }
  }, [moreOpen])

  async function handleLogout() {
    clearCompanyData()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const isActive = (href: string) => {
    if (href === `${base}/invoices`) {
      return pathname === href || (pathname.startsWith(href + '/') && !pathname.startsWith(`${base}/invoices/new`))
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  const tabs: Array<{ href: string; label: string; icon: IconName; center?: boolean; tour: string }> = [
    { href: `${base}/dashboard`, label: 'Pregled', icon: 'home', tour: 'dashboard' },
    { href: `${base}/appointments`, label: 'Termini', icon: 'calendar', tour: 'appointments' },
    { href: `${base}/invoices/new`, label: 'Nov račun', icon: 'plus', center: true, tour: 'new' },
    { href: `${base}/invoices`, label: 'Računi', icon: 'document', tour: 'invoices' },
  ]

  const moreLinks: Array<{ href: string; label: string; hint: string; icon: IconName; warn?: boolean; pill?: string }> = [
    ...(guide && !guide.complete
      ? [{ href: `${base}/guide`, label: 'Vodič', hint: 'Pot do prvega računa', icon: 'map' as IconName, pill: `${guide.done}/${guide.total}` }]
      : []),
    { href: `${base}/customers`, label: 'Stranke', hint: 'Seznam strank in zvestobne točke', icon: 'customers' },
    { href: `${base}/z-report`, label: 'Z-poročilo', hint: zWarning ? 'Danes še ni zaključeno' : 'Dnevni zaključek blagajne', icon: 'report', warn: zWarning },
    { href: `${base}/settings`, label: 'Nastavitve', hint: 'Podjetje, računi, certifikat, prostori', icon: 'settings' },
    { href: `${base}/help`, label: 'Pomoč', hint: 'Razlage pojmov in navodila', icon: 'help' },
  ]
  const moreActive = moreLinks.some((l) => isActive(l.href))

  return (
    <>
      <nav
        aria-label="Glavni meni"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-white/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="grid h-16 grid-cols-5 items-center px-1">
          {tabs.map((tab) => {
            const active = isActive(tab.href)
            if (tab.center) {
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-label={tab.label}
                  data-tour="new-invoice"
                  className="flex h-full items-center justify-center outline-none"
                >
                  <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full gradient-bg text-white shadow-lg shadow-brand/30 ring-4 ring-white transition-transform active:scale-95">
                    <Icon name={tab.icon} className="h-[26px] w-[26px]" strokeWidth={2.2} />
                  </span>
                </Link>
              )
            }
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                data-tour={`nav-${tab.tour}`}
                aria-current={active ? 'page' : undefined}
                className="flex h-full flex-col items-center justify-center gap-0.5 outline-none focus-visible:bg-black/[0.04]"
              >
                <span className={active ? 'text-brand' : 'text-gray-500'}><Icon name={tab.icon} className="h-[22px] w-[22px]" strokeWidth={1.7} /></span>
                <span className={`text-[11px] ${active ? 'font-semibold text-brand' : 'font-medium text-gray-500'}`}>{tab.label}</span>
              </Link>
            )
          })}

          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            data-tour="nav-more"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className="relative flex h-full flex-col items-center justify-center gap-0.5 outline-none focus-visible:bg-black/[0.04]"
          >
            <span className={`relative ${moreActive || moreOpen ? 'text-brand' : 'text-gray-500'}`}>
              <Icon name="more" className="h-[22px] w-[22px]" strokeWidth={2.6} />
              {zWarning && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
            </span>
            <span className={`text-[11px] ${moreActive || moreOpen ? 'font-semibold text-brand' : 'font-medium text-gray-500'}`}>Več</span>
            {zWarning && <span className="sr-only">Blagajna danes še ni zaključena</span>}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              className="absolute inset-0 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMoreOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-label="Več možnosti"
              className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-[#f5f5f7] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => info.offset.y > 80 && setMoreOpen(false)}
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" aria-hidden="true" />

              <ul className="overflow-hidden rounded-2xl bg-white">
                {moreLinks.map((l, i) => (
                  <li key={l.href} className={i > 0 ? 'border-t border-gray-100' : ''}>
                    <Link href={l.href} className="flex items-center gap-3 px-4 py-3.5 outline-none active:bg-gray-50 focus-visible:bg-gray-50">
                      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] ${isActive(l.href) ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-600'}`}>
                        <Icon name={l.icon} className="h-5 w-5" strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-gray-900">{l.label}</span>
                        <span className={`block truncate text-[12px] ${l.warn ? 'font-medium text-red-600' : 'text-gray-500'}`}>{l.hint}</span>
                      </span>
                      {l.pill && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{l.pill}</span>}
                      {l.warn && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />}
                      <Icon name="chevronRight" className="h-4 w-4 flex-shrink-0 text-gray-300" strokeWidth={2.2} />
                    </Link>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-red-600 outline-none active:bg-gray-50 focus-visible:ring-2 focus-visible:ring-red-300"
              >
                <Icon name="logout" className="h-5 w-5" strokeWidth={1.7} />
                Odjava
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
