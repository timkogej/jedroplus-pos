'use client'
import { Suspense, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * A thin progress line at the top of the page that appears as soon as any
 * internal link is clicked and disappears when the new page has arrived. Server
 * pages take a moment to render; without this the click looked like nothing
 * happened.
 */
function Bar() {
  const pathname = usePathname()
  const search = useSearchParams()
  const [active, setActive] = useState(false)

  // New page arrived → done.
  useEffect(() => {
    setActive(false)
  }, [pathname, search])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement | null)?.closest?.('a')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      setActive(true)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // Never leave the bar stuck if a navigation fails or is cancelled.
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setActive(false), 15000)
    return () => clearTimeout(t)
  }, [active])

  if (!active) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden" role="progressbar" aria-label="Nalaganje strani">
      <div className="nav-progress-bar h-full w-1/3 gradient-bg" />
    </div>
  )
}

export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  )
}
