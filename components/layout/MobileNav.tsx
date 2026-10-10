'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { usePosStore } from '@/store/posStore'
import { useZReportWarning } from '@/components/layout/useZReportWarning'
import { useOptionalGuide } from '@/components/guide/GuideProvider'

interface MobileNavProps {
  slug: string
}

function Icon({ d, size = 22, sw = 1.7 }: { d: string | string[]; size?: number; sw?: number }) {
  const paths = Array.isArray(d) ? d : [d]
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={sw} aria-hidden="true">
      {paths.map((p) => (
        <path key={p} strokeLinecap="round" strokeLinejoin="round" d={p} />
      ))}
    </svg>
  )
}

const ICON = {
  home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  plus: "M12 4v16m8-8H4",
  invoices: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  customers: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  report: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  settings: ["M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z", "M15 12a3 3 0 11-6 0 3 3 0 016 0z"],
  logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  guide: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  help: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
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

  const tabs = [
    { href: `${base}/dashboard`, label: 'Pregled', icon: ICON.home, tour: 'dashboard' },
    { href: `${base}/appointments`, label: 'Termini', icon: ICON.calendar, tour: 'appointments' },
    { href: `${base}/invoices/new`, label: 'Nov račun', icon: ICON.plus, center: true, tour: 'new' },
    { href: `${base}/invoices`, label: 'Računi', icon: ICON.invoices, tour: 'invoices' },
  ]

  const moreLinks: Array<{ href: string; label: string; hint: string; icon: string | string[]; warn?: boolean; pill?: string }> = [
    ...(guide && !guide.complete
      ? [{ href: `${base}/guide`, label: 'Vodič', hint: 'Pot do prvega računa', icon: ICON.guide, pill: `${guide.done}/${guide.total}` }]
      : []),
    { href: `${base}/customers`, label: 'Stranke', hint: 'Seznam strank in zvestobne točke', icon: ICON.customers },
    { href: `${base}/z-report`, label: 'Z-poročilo', hint: zWarning ? 'Danes še ni zaključeno' : 'Dnevni zaključek blagajne', icon: ICON.report, warn: zWarning },
    { href: `${base}/settings`, label: 'Nastavitve', hint: 'Podjetje, računi, certifikat, prostori', icon: ICON.settings },
    { href: `${base}/help`, label: 'Pomoč', hint: 'Razlage pojmov in navodila', icon: ICON.help },
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
                    <Icon d={tab.icon} size={26} sw={2.2} />
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
                <span className={active ? 'text-brand' : 'text-gray-500'}><Icon d={tab.icon} /></span>
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
              <Icon d={ICON.more} sw={2.6} />
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
                        <Icon d={l.icon} size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-gray-900">{l.label}</span>
                        <span className={`block truncate text-[12px] ${l.warn ? 'font-medium text-red-600' : 'text-gray-500'}`}>{l.hint}</span>
                      </span>
                      {l.pill && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{l.pill}</span>}
                      {l.warn && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />}
                      <svg className="h-4 w-4 flex-shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-red-600 outline-none active:bg-gray-50 focus-visible:ring-2 focus-visible:ring-red-300"
              >
                <Icon d={ICON.logout} size={20} />
                Odjava
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
