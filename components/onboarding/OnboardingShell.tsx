'use client'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
  step: 1 | 2
  companyName?: string | null
  title: string
  subtitle: string
  children: React.ReactNode
}

/**
 * Full-screen wrapper for the post-subscription onboarding flow. Renders on top
 * of the company layout chrome (sidebar/mobile nav) via a fixed overlay so the
 * first-run experience stays focused. Per the design system the primary button
 * stays solid black; only the slim header bar carries the brand gradient.
 */
export default function OnboardingShell({ slug, step, companyName, title, subtitle, children }: Props) {
  const router = useRouter()

  function skip() {
    const ok = window.confirm('Brez nastavitev ne boste mogli izdajati računov. Želite vseeno nadaljevati?')
    if (!ok) return
    // Remember the skip so the dashboard doesn't bounce the user straight back
    // into onboarding. Read server-side from cookies() on the dashboard.
    document.cookie = `onboarding_skipped=${slug}; path=/; max-age=${60 * 60 * 24 * 365}`
    router.replace(`/${slug}/dashboard`)
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-gray-50">
      {/* Slim brand gradient header bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#6D5EF7] to-[#2AD4C5]" />

      <div className="mx-auto w-full max-w-[600px] px-4 py-8 md:py-12">
        {/* Top row: brand + progress */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#6D5EF7] to-[#2AD4C5] text-[13px] font-bold text-white">
              J
            </div>
            <span className="text-sm font-semibold text-gray-900">
              Jedro+ {companyName ? <span className="font-normal text-gray-400">· {companyName}</span> : null}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <span>Korak {step} od 2</span>
            <span className="text-base leading-none tracking-tight">
              <span className="text-[#6D5EF7]">●</span>
              <span className={step >= 2 ? 'text-[#6D5EF7]' : 'text-gray-300'}>{step >= 2 ? '●' : '○'}</span>
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 md:text-2xl">{title}</h1>
          <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>
        </div>

        {/* White card with the form */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 md:p-6">{children}</div>

        {/* Skip link */}
        <div className="mt-4 text-right">
          <button
            onClick={skip}
            className="text-xs text-gray-400 transition-colors hover:text-gray-600"
          >
            Preskočite nastavitev
          </button>
        </div>
      </div>
    </div>
  )
}
