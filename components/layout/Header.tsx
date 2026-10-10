'use client'
import FursStatusIndicator from '@/components/layout/FursStatusIndicator'
import JedroLogo from '@/components/layout/JedroLogo'

interface HeaderProps {
  slug: string
  title: string
  action?: React.ReactNode
}

const titleClass = 'min-w-0 truncate text-[24px] font-semibold tracking-tight text-gray-900 md:text-[21px]'

export default function Header({ slug, title, action }: HeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/75 backdrop-blur-xl">
        <div className="px-4 md:px-6">
          {/* Phone: one slim brand row (the sidebar is hidden there); settings and logout live under "Več" */}
          <div className="flex h-12 items-center justify-between gap-3 md:hidden">
            <JedroLogo height={22} tagline inline />
            <FursStatusIndicator slug={slug} compact className="flex-shrink-0" />
          </div>

          {/* Desktop: page title + status + page action in the bar */}
          <div className="hidden h-16 items-center justify-between gap-3 md:flex">
            <h1 className={titleClass}>{title}</h1>
            <div className="flex flex-shrink-0 items-center justify-end gap-2">
              <FursStatusIndicator slug={slug} compact className="flex-shrink-0" />
              {action && <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{action}</div>}
            </div>
          </div>
        </div>
      </header>

      {/* Phone: the page title and action are part of the page, not the sticky bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pb-1 pt-4 md:hidden">
        <h1 className={titleClass}>{title}</h1>
        {action && <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{action}</div>}
      </div>
    </>
  )
}
