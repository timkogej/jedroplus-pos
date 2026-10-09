export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen" role="status" aria-live="polite" aria-label="Nalaganje">
      <div className="h-16 border-b border-gray-100 bg-white px-6 flex items-center">
        <div className="h-5 w-40 rounded-md bg-gray-100 animate-pulse" />
      </div>
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                <div className="h-6 w-20 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-gray-100 animate-pulse" />
            ))}
          </div>
        </div>
      </main>
      <span className="sr-only">Nalaganje …</span>
    </div>
  )
}
