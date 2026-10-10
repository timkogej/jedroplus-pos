/**
 * Static, non-interactive examples used by the "Termini" page (while there are no
 * appointments yet) and by the guided tour. Marked "Primer" so nobody mistakes
 * them for real data.
 */
const exampleTag = (
  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
    Primer
  </span>
)

/** What an appointment card looks like and where to click. */
export function ExampleAppointmentCard({ highlight = false }: { highlight?: boolean }) {
  return (
    <div
      role="img"
      aria-label="Primer kartice termina: stranka Maja Novak, storitev Striženje, cena 35,00 €, gumb Izstavi"
      data-tour="appt-card"
      className="flex items-center justify-between gap-4 rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <p className="truncate font-semibold text-gray-900">Maja Novak</p>
          {exampleTag}
        </div>
        <p className="truncate text-sm text-gray-600">Striženje</p>
        <p className="mt-0.5 text-xs text-gray-500">
          <span className="font-medium">danes</span> · 10:30 · Ana
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-3">
        <p className="font-semibold text-gray-900">35,00 €</p>
        <span
          data-tour="appt-issue"
          className={`inline-flex items-center rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-sm font-medium text-white ${
            highlight ? 'ring-2 ring-brand ring-offset-2' : ''
          }`}
        >
          Izstavi
        </span>
      </div>
    </div>
  )
}

/** What the invoice looks like after clicking "Izstavi" — already filled in. */
export function ExampleInvoicePreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="img"
      aria-label="Primer računa, ki se odpre po kliku na Izstavi: stranka Maja Novak, Striženje 35,00 €, gumb Potrdi in izstavi račun"
      data-tour="appt-invoice-preview"
      className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Račun za termin</p>
        {exampleTag}
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Stranka</span>
          <span className="font-medium text-gray-900">Maja Novak</span>
        </div>
        <div className="flex justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
          <span className="text-gray-700">Striženje</span>
          <span className="text-gray-900">1 × 35,00 €</span>
        </div>
        <div className="flex justify-between gap-3 border-t border-gray-100 pt-2">
          <span className="font-semibold text-gray-900">Skupaj z DDV</span>
          <span className="font-semibold text-gray-900">35,00 €</span>
        </div>
      </div>
      {!compact && (
        <p className="mt-3 text-xs text-gray-500">Stranka, storitev in cena so že vpisani. Vam ostane še potrditev.</p>
      )}
      <span className="mt-3 flex items-center justify-center rounded-lg bg-[#1d1d1f] py-2 text-sm font-medium text-white">
        Potrdi in izstavi račun
      </span>
    </div>
  )
}
