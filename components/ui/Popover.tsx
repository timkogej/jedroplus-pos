'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MARGIN = 12
const GAP = 8

/**
 * A small panel anchored under (or above) a trigger element. Closes on Escape,
 * on a click outside and when the page is scrolled far. Stays inside the screen,
 * so it also works on phones.
 */
export default function Popover({
  open,
  onClose,
  anchorRef,
  width = 300,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  width?: number
  label: string
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; w: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect()
      if (!a) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.min(width, vw - MARGIN * 2)
      const h = panelRef.current?.offsetHeight ?? 120
      const left = Math.max(MARGIN, Math.min(a.left + a.width / 2 - w / 2, vw - w - MARGIN))
      const below = a.bottom + GAP + h <= vh - MARGIN
      const top = below ? a.bottom + GAP : Math.max(MARGIN, a.top - GAP - h)
      setPos({ top, left, w })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchorRef, width])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open, onClose, anchorRef])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      className="fixed z-[70] rounded-2xl bg-white p-4 text-left shadow-xl ring-1 ring-black/10"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.w ?? width }}
    >
      {children}
    </div>,
    document.body
  )
}
