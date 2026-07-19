'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface MobileNavProps {
  slug: string
}

export default function MobileNav({ slug }: MobileNavProps) {
  const pathname = usePathname()
  const base = `/${slug}`

  const items = [
    {
      href: `${base}/dashboard`,
      label: 'Pregled',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: `${base}/appointments`,
      label: 'Termini',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: `${base}/invoices/new`,
      label: 'Nov račun',
      center: true,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      href: `${base}/invoices`,
      label: 'Računi',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      href: `${base}/z-report`,
      label: 'Z poročilo',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/90 backdrop-blur-md border-t border-gray-100">
      <div className="flex justify-around items-center h-16 px-2">
        {items.map((item) => {
          const isActive = isNavItemActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2"
            >
              {item.center ? (
                <div className={`gradient-bg rounded-full p-2.5 ${isActive ? 'opacity-100' : 'opacity-90'}`}>
                  <span className="text-white block">{item.icon}</span>
                </div>
              ) : (
                <span className={`transition-colors ${isActive ? 'text-[#6D5EF7]' : 'text-gray-400'}`}>
                  {item.icon}
                </span>
              )}
              {!item.center && (
                <span className={`text-[10px] transition-colors ${isActive ? 'text-[#6D5EF7] font-medium' : 'text-gray-400'}`}>
                  {item.label}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
