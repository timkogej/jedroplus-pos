'use client'
import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import Popover from '@/components/ui/Popover'
import { GLOSSARY, type GlossaryKey } from '@/lib/help/glossary'
import { useOptionalCompany } from '@/components/layout/CompanyContext'

/**
 * A small "?" next to a term. Opens a short plain-language explanation from the
 * glossary (lib/help/glossary.ts), with a link to the full Pomoč page.
 */
export default function HelpTip({ term, className = '' }: { term: GlossaryKey; className?: string }) {
  const entry = GLOSSARY[term]
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const company = useOptionalCompany()
  const slug = company?.slug

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Pojasnilo: ${entry.term}`}
        aria-expanded={open}
        className={`relative inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border border-gray-300 text-[11px] font-semibold leading-none text-gray-500 outline-none transition-colors before:absolute before:-inset-2.5 before:content-[''] hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/40 ${className}`}
      >
        ?
      </button>
      <Popover open={open} onClose={close} anchorRef={ref} label={entry.term}>
        <p className="text-[13px] font-semibold text-gray-900">{entry.term}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-gray-600">{entry.short}</p>
        {slug && (
          <Link
            href={`/${slug}/help#pojmi`}
            onClick={close}
            className="mt-2 inline-block text-[12px] font-medium text-brand hover:underline"
          >
            Vsi pojmi →
          </Link>
        )}
      </Popover>
    </>
  )
}
