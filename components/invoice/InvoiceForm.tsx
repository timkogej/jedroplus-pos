'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { pdf } from '@react-pdf/renderer'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import InvoicePDF from '@/components/invoice/InvoicePDF'
import { printThermal } from '@/lib/invoice/thermal-print'
import { authFetch } from '@/lib/authFetch'
import type { InvoiceFormData, InvoiceItemForm, PosPremise, PosDevice, PosSettings, PosInvoice, PosInvoiceItem, PosCompanyData } from '@/types'

interface InvoiceFormProps {
  companyId: string
  slug: string
  settings: PosSettings | null
  premises: PosPremise[]
  devices: PosDevice[]
  prefill?: Partial<InvoiceFormData> & { appointmentId?: string }
  companyName: string
  companyData?: PosCompanyData | null
}

const VAT_OPTIONS = [
  { value: '22', label: '22% DDV' },
  { value: '9.5', label: '9,5% DDV' },
  { value: '0', label: '0% DDV' },
]

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Gotovina' },
  { value: 'card', label: 'Kartica' },
  { value: 'transfer', label: 'Bančno nakazilo' },
]

function emptyItem(defaultVat: number): InvoiceItemForm {
  return { description: '', quantity: 1, unit_price: 0, vat_rate: defaultVat }
}

export default function InvoiceForm({
  companyId,
  slug,
  settings,
  premises,
  devices,
  prefill,
  companyName,
  companyData,
}: InvoiceFormProps) {
  const router = useRouter()
  const defaultVat = settings?.default_vat_rate ?? 22
  const defaultCurrency = prefill?.currency || settings?.currency || 'EUR'
  const currencySymbol = defaultCurrency === 'EUR' ? '€' : defaultCurrency

  // Client type
  const [clientType, setClientType] = useState<'physical' | 'legal'>('physical')
  const [clientName, setClientName] = useState(prefill?.client_name ?? '')
  const [clientEmail, setClientEmail] = useState(prefill?.client_email ?? '')
  const [clientPhone, setClientPhone] = useState(prefill?.client_phone ?? '')
  const [clientTax, setClientTax] = useState(prefill?.client_tax_number ?? '')
  const [clientCompanyName, setClientCompanyName] = useState('')
  const [clientCompanyTax, setClientCompanyTax] = useState('')

  const [invoiceDate, setInvoiceDate] = useState(
    prefill?.invoice_date ?? new Date().toISOString().split('T')[0]
  )
  const [paymentMethod, setPaymentMethod] = useState(prefill?.payment_method ?? 'cash')
  const [items, setItems] = useState<InvoiceItemForm[]>(
    prefill?.items?.length ? prefill.items : [emptyItem(defaultVat)]
  )
  const [discountAmount, setDiscountAmount] = useState(prefill?.discount_amount ?? 0)
  const [discountType, setDiscountType] = useState<'%' | '€'>(
    (prefill?.discount_type as '%' | '€') ?? '%'
  )
  const [notes, setNotes] = useState(prefill?.notes ?? '')
  const [premiseId, setPremiseId] = useState(prefill?.premise_id ?? premises[0]?.id ?? '')
  const [deviceId, setDeviceId] = useState(prefill?.device_id ?? '')

  // Loyalty points
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false)
  const [loyaltyBalance, setLoyaltyBalance] = useState(0)
  const [loyaltyRedeemValue, setLoyaltyRedeemValue] = useState(settings?.loyalty_redeem_value ?? 0)
  const [pointsToRedeem, setPointsToRedeem] = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailWarning, setEmailWarning] = useState('')
  const [deliveryModal, setDeliveryModal] = useState(false)
  const [printFormatModal, setPrintFormatModal] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [issuedInvoice, setIssuedInvoice] = useState<{
    id: string
    invoiceNumber: string
    eor: string | null
    zoi: string
    pdfUrl?: string
    invoiceRecord?: Partial<PosInvoice>
  } | null>(null)

  useEffect(() => {
    const premiseDevices = devices.filter((d) => d.premise_id === premiseId)
    if (premiseDevices.length > 0 && !premiseDevices.find((d) => d.id === deviceId)) {
      setDeviceId(premiseDevices[0].id)
    }
  }, [premiseId, devices])

  useEffect(() => {
    setEmailInput(clientEmail)
  }, [clientEmail])

  // Look up the client's loyalty balance whenever their email changes.
  useEffect(() => {
    const email = clientEmail.trim()
    if (!settings?.loyalty_enabled || !email || !email.includes('@')) {
      setLoyaltyEnabled(false)
      setLoyaltyBalance(0)
      setPointsToRedeem(0)
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await authFetch('/api/loyalty/balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, clientEmail: email }),
        })
        const data = await res.json()
        if (cancelled || !res.ok) return
        setLoyaltyEnabled(Boolean(data.enabled))
        setLoyaltyBalance(Number(data.balance) || 0)
        if (typeof data.redeemValue === 'number') setLoyaltyRedeemValue(data.redeemValue)
        setPointsToRedeem(0)
      } catch {
        // best-effort; loyalty card just stays hidden
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [clientEmail, companyId, settings?.loyalty_enabled])

  const itemsTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  const discountValue =
    discountAmount > 0
      ? discountType === '%'
        ? (itemsTotal * discountAmount) / 100
        : discountAmount
      : 0
  const subtotal = itemsTotal - discountValue
  const vatRate = items[0]?.vat_rate ?? defaultVat
  // Cap redeemable points so the invoice total never drops to 0 — at least
  // 0.01 must remain (a 0-total invoice is invalid and would fail FURS confirm).
  const maxRedeemablePoints =
    loyaltyRedeemValue > 0
      ? Math.min(loyaltyBalance, Math.max(0, Math.floor((subtotal - 0.01) / loyaltyRedeemValue)))
      : 0
  const redeemCapped = maxRedeemablePoints < loyaltyBalance
  const clampedPoints = Math.max(0, Math.min(pointsToRedeem, maxRedeemablePoints))
  const loyaltyDiscount = clampedPoints * loyaltyRedeemValue
  const total = Math.max(0, subtotal - loyaltyDiscount)
  const vatAmount = total * (vatRate / (100 + vatRate))

  function updateItem(index: number, field: keyof InvoiceItemForm, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem(vatRate)])
  }

  function removeItem(index: number) {
    if (items.length === 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    setError('')
    if (!premiseId || !deviceId) {
      setError('Izberite poslovni prostor in napravo')
      return
    }
    if (items.some((i) => !i.description || i.unit_price <= 0)) {
      setError('Izpolnite vse postavke računa')
      return
    }

    setLoading(true)
    try {
      // Lock in any loyalty redemption first, then attach it to the invoice.
      let loyaltyRedeemRecordId: string | null = null
      let finalNotes = notes
      if (clampedPoints > 0 && loyaltyEnabled) {
        const redeemRes = await authFetch('/api/loyalty/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, clientEmail: clientEmail.trim(), pointsToRedeem: clampedPoints }),
        })
        const redeemData = await redeemRes.json()
        if (!redeemRes.ok) throw new Error(redeemData.error || 'Napaka pri unovčenju točk')
        loyaltyRedeemRecordId = redeemData.recordId
        const note = `Loyalty popust: -${loyaltyDiscount.toFixed(2)} ${currencySymbol} (${clampedPoints} točk)`
        finalNotes = finalNotes ? `${finalNotes}\n${note}` : note
      }

      const res = await authFetch('/api/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          premiseId,
          deviceId,
          appointmentId: prefill?.appointmentId ?? null,
          clientName,
          clientEmail,
          clientPhone,
          clientTax,
          clientType,
          clientCompanyName: clientType === 'legal' ? clientCompanyName : '',
          clientCompanyTax: clientType === 'legal' ? clientCompanyTax : '',
          paymentMethod,
          discountType,
          discountValue,
          subtotal,
          vatRate,
          vatAmount,
          total,
          items,
          notes: finalNotes,
          currency: defaultCurrency,
          loyaltyRedeemRecordId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka pri izstavitvi')

      setIssuedInvoice({
        id: data.invoiceId,
        invoiceNumber: data.invoiceNumber,
        eor: data.eor,
        zoi: data.zoi,
        pdfUrl: data.pdfUrl ?? undefined,
        invoiceRecord: {
          id: data.invoiceId,
          invoice_number: data.invoiceNumber,
          invoice_date: new Date().toISOString(),
          client_name: clientName || null,
          client_email: clientEmail || null,
          client_phone: clientPhone || null,
          client_tax_number: clientTax || null,
          payment_method: paymentMethod as 'cash' | 'card' | 'transfer',
          eor: data.eor,
          zoi: data.zoi,
          total,
          subtotal,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          discount_amount: discountValue,
          discount_type: discountAmount > 0 ? discountType : null,
          notes: finalNotes || null,
          furs_response: data.isDemoMode ? { demo: true } : null,
          pdf_url: data.pdfUrl ?? null,
          pos_invoice_items: items.map((item, i) => ({
            id: `temp-${i}`,
            invoice_id: data.invoiceId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            vat_rate: item.vat_rate,
            vat_amount: item.quantity * item.unit_price * item.vat_rate / (100 + item.vat_rate),
            total: item.quantity * item.unit_price,
            created_at: new Date().toISOString(),
          })),
        } as PosInvoice,
      })

      const delivery = settings?.receipt_delivery ?? 'ask'
      if (delivery === 'ask') {
        setDeliveryModal(true)
      } else {
        await handleDelivery(delivery, data.invoiceId, data.pdfUrl)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Napaka pri izstavitvi')
    } finally {
      setLoading(false)
    }
  }

  async function openPdfInTab() {
    if (!issuedInvoice?.id) return
    try {
      const res = await authFetch(`/api/invoices/${issuedInvoice.id}/pdf`)
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch {
      // fallback to client-side generation
      if (!issuedInvoice.invoiceRecord) return
      const blob = await pdf(
        <InvoicePDF
          invoice={issuedInvoice.invoiceRecord as PosInvoice & { pos_invoice_items?: PosInvoiceItem[] }}
          companyName={companyName}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    }
  }

  async function executePrint(format: 'a4' | 'thermal') {
    if (format === 'thermal' && issuedInvoice?.invoiceRecord) {
      printThermal({
        invoice: issuedInvoice.invoiceRecord as PosInvoice,
        companyName,
      })
    } else {
      await openPdfInTab()
    }
  }

  async function handlePrintFormat(format: 'a4' | 'thermal') {
    setPrintFormatModal(false)
    await executePrint(format)
    if (issuedInvoice) {
      router.push(`/${slug}/invoices/${issuedInvoice.id}`)
    }
  }

  async function handleDelivery(method: string, invoiceId: string, pdfUrl?: string | null) {
    setDeliveryModal(false)
    let emailFailed = false
    const emailTo = emailInput || clientEmail

    if ((method === 'email' || method === 'both') && emailTo) {
      try {
        const res = await authFetch(`/api/invoices/${invoiceId}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName }),
        })
        const json = await res.json()
        if (!json.success) emailFailed = true
      } catch {
        emailFailed = true
      }
    }

    if (method === 'print' || method === 'both') {
      const printFormat = settings?.print_format ?? 'ask'
      if (printFormat === 'ask') {
        setPrintFormatModal(true)
        return
      }
      await executePrint(printFormat)
    }

    if (emailFailed) {
      setEmailWarning('E-pošta ni bila poslana. Račun je bil uspešno ustvarjen.')
      await new Promise<void>((r) => setTimeout(r, 3500))
    }

    router.push(`/${slug}/invoices/${invoiceId}`)
  }

  const premiseOptions = premises.map((p) => ({ value: p.id, label: `${p.premise_id} - ${p.address ?? ''}` }))
  const deviceOptions = devices
    .filter((d) => !premiseId || d.premise_id === premiseId)
    .map((d) => ({ value: d.id, label: d.device_id }))

  return (
    <div className="space-y-4">
      {/* Client type toggle */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Vrsta stranke</h3>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden w-fit">
          {(['physical', 'legal'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setClientType(type)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                clientType === type ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {type === 'physical' ? 'Fizična oseba' : 'Pravna oseba / podjetje'}
            </button>
          ))}
        </div>
      </div>

      {/* Client */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Stranka</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Ime in priimek" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Janez Novak" />
          <Input label="E-pošta" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="janez@email.si" />
          <Input label="Telefon" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+386 41 000 000" />
          <Input label="Davčna številka" value={clientTax} onChange={(e) => setClientTax(e.target.value)} placeholder="SI12345678" />
          {clientType === 'legal' && (
            <>
              <Input label="Naziv podjetja stranke" value={clientCompanyName} onChange={(e) => setClientCompanyName(e.target.value)} placeholder="Podjetje d.o.o." />
              <Input label="Davčna številka stranke" value={clientCompanyTax} onChange={(e) => setClientCompanyTax(e.target.value)} placeholder="SI12345678" />
            </>
          )}
        </div>
      </div>

      {/* Invoice details */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Podrobnosti računa</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Datum" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          <Select
            label="Plačilni način"
            options={PAYMENT_OPTIONS}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'transfer')}
          />
          <Select
            label="Poslovni prostor"
            options={premiseOptions}
            value={premiseId}
            onChange={(e) => setPremiseId(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <Select
            label="Elektronska naprava"
            options={deviceOptions.length ? deviceOptions : [{ value: '', label: 'Ni naprav' }]}
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          />
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Postavke</h3>
          <button
            onClick={addItem}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900 hover:text-[#6D5EF7] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Dodaj postavko
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Mobile layout */}
              <div className="sm:hidden bg-gray-50 rounded-xl p-3 relative">
                <button
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors disabled:opacity-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="mb-2 pr-8">
                  <Input
                    placeholder="Opis storitve..."
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    min="1"
                    step="0.5"
                    placeholder="Kol."
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={`Cena ${currencySymbol}`}
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  />
                  <Select
                    options={VAT_OPTIONS}
                    value={String(item.vat_rate)}
                    onChange={(e) => updateItem(index, 'vat_rate', parseFloat(e.target.value))}
                  />
                </div>
              </div>

              {/* Desktop layout */}
              <div className="hidden sm:grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Input
                    label={index === 0 ? 'Opis storitve' : ''}
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    placeholder="Storitev..."
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label={index === 0 ? 'Kol.' : ''}
                    type="number"
                    min="1"
                    step="0.5"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label={index === 0 ? `Cena (${currencySymbol})` : ''}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <Select
                    label={index === 0 ? 'DDV' : ''}
                    options={VAT_OPTIONS}
                    value={String(item.vat_rate)}
                    onChange={(e) => updateItem(index, 'vat_rate', parseFloat(e.target.value))}
                  />
                </div>
                <div className="col-span-1 flex justify-center pb-0.5">
                  <button
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Discount */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <h4 className="text-xs font-medium text-gray-500 mb-3">Popust</h4>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              {(['%', '€'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setDiscountType(type)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    discountType === type
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-4">
          <label className="text-sm font-medium text-gray-700 block mb-1">Opomba (neobvezno)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opomba na računu..."
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all duration-150 resize-none"
          />
        </div>
      </div>

      {/* Loyalty redemption */}
      {loyaltyEnabled && loyaltyBalance > 0 && (
        <div className="bg-white rounded-2xl border border-[#6D5EF7]/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎁</span>
            <p className="text-sm font-semibold text-gray-900">
              Stranka ima {loyaltyBalance} točk (vredno {(loyaltyBalance * loyaltyRedeemValue).toFixed(2)} {currencySymbol})
            </p>
          </div>
          <label className="text-xs font-medium text-gray-500 block mb-2">Koliko točk želite unovčiti?</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={maxRedeemablePoints}
              step={1}
              value={clampedPoints}
              onChange={(e) => setPointsToRedeem(parseInt(e.target.value, 10) || 0)}
              className="flex-1 accent-[#6D5EF7]"
            />
            <input
              type="number"
              min={0}
              max={maxRedeemablePoints}
              value={clampedPoints}
              onChange={(e) => setPointsToRedeem(parseInt(e.target.value, 10) || 0)}
              className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <button
              type="button"
              onClick={() => setPointsToRedeem(maxRedeemablePoints)}
              className="text-xs font-medium text-[#6D5EF7] hover:underline whitespace-nowrap"
            >
              Uporabi vse
            </button>
          </div>
          {redeemCapped && (
            <p className="text-xs text-gray-400 mt-2">
              Največ {maxRedeemablePoints} točk (mora ostati vsaj 0.01 {currencySymbol})
            </p>
          )}
          {loyaltyDiscount > 0 && (
            <p className="text-xs text-green-700 mt-2">
              Popust: -{loyaltyDiscount.toFixed(2)} {currencySymbol} ({clampedPoints} točk)
            </p>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Cena brez DDV</span>
            <span className="text-gray-900 font-medium">{itemsTotal.toFixed(2)} {currencySymbol}</span>
          </div>
          {discountValue > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-700">Popust ({discountType === '%' ? `${discountAmount}%` : `${discountAmount} ${currencySymbol}`})</span>
              <span className="text-green-700 font-medium">-{discountValue.toFixed(2)} {currencySymbol}</span>
            </div>
          )}
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-700">🎁 Loyalty popust ({clampedPoints} točk)</span>
              <span className="text-green-700 font-medium">-{loyaltyDiscount.toFixed(2)} {currencySymbol}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">DDV ({vatRate}%)</span>
            <span className="text-gray-900 font-medium">{vatAmount.toFixed(2)} {currencySymbol}</span>
          </div>
          <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-1">
            <span className="text-sm font-semibold text-gray-900">Skupaj z DDV</span>
            <span className="text-xl font-semibold gradient-text">{total.toFixed(2)} {currencySymbol}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {emailWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {emailWarning}
        </div>
      )}

      <Button onClick={handleSubmit} loading={loading} size="lg" className="w-full">
        Potrdi in izstavi račun
      </Button>

      {/* Delivery modal */}
      <Modal open={deliveryModal} onClose={() => setDeliveryModal(false)} title="Dostava računa">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Kako želite dostaviti račun?</p>

          {/* Email option — always visible */}
          <button
            onClick={() => {
              if (!emailInput) {
                // focus email input, don't close
                return
              }
              handleDelivery('email', issuedInvoice!.id, issuedInvoice?.pdfUrl)
            }}
            className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
          >
            <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Pošlji po e-pošti</p>
              <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="E-pošta stranke"
                  className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900/10"
                />
              </div>
            </div>
            {emailInput && (
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>

          {emailInput && (
            <button
              onClick={() => handleDelivery('email', issuedInvoice!.id, issuedInvoice?.pdfUrl)}
              className="w-full py-2 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors"
            >
              Pošlji na {emailInput}
            </button>
          )}

          <button
            onClick={() => handleDelivery('print', issuedInvoice!.id, issuedInvoice?.pdfUrl)}
            className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors text-left w-full"
          >
            <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">Natisni</p>
              <p className="text-xs text-gray-500">Odpre PDF za tiskanje</p>
            </div>
          </button>

          <button
            onClick={() => {
              setDeliveryModal(false)
              router.push(`/${slug}/invoices/${issuedInvoice!.id}`)
            }}
            className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors text-left w-full"
          >
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">Samo potrdi</p>
              <p className="text-xs text-gray-500">Brez takojšnje dostave</p>
            </div>
          </button>
        </div>
      </Modal>

      {/* Print format modal */}
      <Modal open={printFormatModal} onClose={() => setPrintFormatModal(false)} title="Oblika tiskanja" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Izberite obliko tiskanja:</p>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => handlePrintFormat('a4')}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-[#6D5EF7] hover:bg-purple-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Natisni A4</p>
                <p className="text-xs text-gray-500">Odpre PDF v novem zavihku</p>
              </div>
            </button>
            <button
              onClick={() => handlePrintFormat('thermal')}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-[#6D5EF7] hover:bg-purple-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Natisni račun (termalni)</p>
                <p className="text-xs text-gray-500">80mm termalni papir</p>
              </div>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
