export default function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="Nalaganje pregleda">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 space-y-3">
            <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
            <div className="h-6 w-20 rounded bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
        <div className="h-4 w-40 rounded bg-gray-100 animate-pulse mb-4" />
        <div className="h-44 w-full rounded-xl bg-gray-50 animate-pulse" />
      </div>
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 w-full rounded bg-gray-100 animate-pulse" />
        ))}
      </div>
      <span className="sr-only">Nalaganje …</span>
    </div>
  )
}
