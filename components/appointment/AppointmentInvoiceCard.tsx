'use client'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import type { Appointment } from '@/types'

interface Props {
  appointment: Appointment & { alreadyInvoiced?: boolean; clientName?: string }
  slug: string
}

export default function AppointmentInvoiceCard({ appointment, slug }: Props) {
  const router = useRouter()

  function handleInvoice() {
    const params = new URLSearchParams({
      appointmentId: appointment.id,
      service: appointment['Storitev'] ?? '',
      price: String(appointment['Final cena'] ?? appointment['Cena'] ?? 0),
      originalPrice: String(appointment['Cena'] ?? 0),
      discount: String(appointment['Popust'] ?? 0),
      discountType: appointment['Popust type'] ?? '%',
      clientName: appointment.clientName ?? '',
      clientEmail: appointment['Email stranke'] ?? '',
      currency: appointment['Valuta'] ?? '',
    })
    if (appointment['ID storitve 2']) params.set('service2Id', appointment['ID storitve 2'])
    if (appointment['ID storitve 3']) params.set('service3Id', appointment['ID storitve 3'])
    router.push(`/${slug}/invoices/new?${params.toString()}`)
  }

  const datum = appointment['Datum']
  const ura = appointment['Ura']
  const dateStr = datum ? new Date(datum).toLocaleDateString('sl-SI') : '—'
  const finalPrice = appointment['Final cena'] ?? appointment['Cena'] ?? 0
  const originalPrice = appointment['Cena'] ?? 0
  const hasDiscount = finalPrice < originalPrice

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-4 ${appointment.alreadyInvoiced ? 'opacity-60' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-semibold text-gray-900 truncate">{appointment.clientName ?? appointment['Stranka'] ?? 'Neznana stranka'}</p>
          {appointment.alreadyInvoiced && <Badge variant="success">Fakturirano</Badge>}
        </div>
        <p className="text-sm text-gray-600 truncate">{appointment['Storitev']}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-gray-500 font-medium">{dateStr}</span>
          {ura && <span className="text-xs text-gray-400">{ura}</span>}
          {appointment['Oseba'] && <span className="text-xs text-gray-400">· {appointment['Oseba']}</span>}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="font-semibold text-gray-900">{Number(finalPrice).toFixed(2)} €</p>
          {hasDiscount && (
            <p className="text-xs text-gray-400 line-through">{Number(originalPrice).toFixed(2)} €</p>
          )}
        </div>
        {!appointment.alreadyInvoiced && (
          <Button size="sm" onClick={handleInvoice}>
            Izstavi
          </Button>
        )}
      </div>
    </motion.div>
  )
}
