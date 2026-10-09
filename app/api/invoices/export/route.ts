import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import type { PosInvoice, PosInvoiceItem } from '@/types'
import { invoiceDateRange } from '@/lib/dateRange'
import { ljParts } from '@/lib/time'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Gotovina',
  card: 'Kartica',
  transfer: 'Nakazilo',
  online: 'Spletno plačilo',
}

const STATUS_LABELS: Record<string, string> = {
  issued: 'Izstavljen',
  draft: 'Osnutek',
  cancelled: 'Storniran',
  storno_original: 'Storniran',
  storno: 'Storno',
  pending_furs: 'Čaka potrditev FURS',
  furs_failed: 'FURS potrditev ni uspela',
  storno_pending: 'Storno v teku',
}

/** Quote a CSV cell per RFC 4180 (double quotes, escape embedded quotes). */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  // CSV/Excel formula injection: a customer name like "=HYPERLINK(...)" would be
  // executed when the accountant opens the file. Neutralise text that starts like
  // a formula (numbers such as -12.50 are left alone).
  if (/^[=+\-@\t\r]/.test(s) && !/^[-+]?\d+([.,]\d+)?$/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

type ExportInvoice = PosInvoice & {
  pos_invoice_items?: PosInvoiceItem[]
  pos_premises?: { premise_id: string } | null
  pos_devices?: { device_id: string } | null
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const companyId = url.searchParams.get('companyId')
  const dateFrom = url.searchParams.get('dateFrom') // YYYY-MM-DD
  const dateTo = url.searchParams.get('dateTo')
  const status = url.searchParams.get('status') ?? 'all'
  const paymentMethod = url.searchParams.get('paymentMethod') ?? 'all'

  const auth = await requireCompanyAccess(req, companyId)
  if ('response' in auth) return auth.response

  const supabase = createServiceClient()
  let query = supabase
    .from('pos_invoices')
    .select('*, pos_invoice_items(*), pos_premises(premise_id), pos_devices(device_id)')
    .eq('company_id', companyId)
    .order('invoice_date', { ascending: true })

  const range = invoiceDateRange(dateFrom, dateTo)
  if (range.from) query = query.gte('invoice_date', range.from)
  if (range.to) query = query.lt('invoice_date', range.to)
  if (status !== 'all') query = query.eq('status', status)
  if (paymentMethod !== 'all') query = query.eq('payment_method', paymentMethod)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Napaka pri pridobivanju računov' }, { status: 500 })
  }

  const invoices = (data ?? []) as ExportInvoice[]

  const headers = [
    'Številka računa', 'Datum', 'Čas', 'Stranka', 'Email stranke', 'Telefon stranke',
    'Storitev', 'Cena brez DDV', 'DDV %', 'DDV znesek', 'Skupaj z DDV',
    'Način plačila', 'Status', 'EOR', 'ZOI', 'Poslovni prostor', 'Elektronska naprava',
  ]

  const lines: string[] = [headers.map(cell).join(',')]

  for (const inv of invoices) {
    const p = ljParts(new Date(inv.invoice_date))
    const t2 = (n: number) => String(n).padStart(2, '0')
    const datum = `${t2(p.day)}.${t2(p.month)}.${p.year}`
    const cas = `${t2(p.hour)}:${t2(p.minute)}`
    const items = inv.pos_invoice_items ?? []
    // Combine services into one cell; compute base/vat across the invoice.
    const storitev = items.map((i) => i.description).join('; ')
    const vatRates = Array.from(new Set(items.map((i) => i.vat_rate)))
    const ddvRate = vatRates.length === 1 ? vatRates[0] : inv.vat_rate
    const baseValue = inv.total - inv.vat_amount

    lines.push([
      inv.invoice_number,
      datum,
      cas,
      inv.client_name ?? '',
      inv.client_email ?? '',
      inv.client_phone ?? '',
      storitev,
      baseValue.toFixed(2),
      ddvRate,
      inv.vat_amount.toFixed(2),
      inv.total.toFixed(2),
      PAYMENT_LABELS[inv.payment_method] ?? inv.payment_method,
      STATUS_LABELS[inv.status] ?? inv.status,
      inv.eor ?? '',
      inv.zoi ?? '',
      inv.pos_premises?.premise_id ?? '',
      inv.pos_devices?.device_id ?? '',
    ].map(cell).join(','))
  }

  // UTF-8 BOM so Excel reads šumniki correctly.
  const csv = '﻿' + lines.join('\r\n')
  const filename = `Racuni-${dateFrom || 'zacetek'}-${dateTo || 'danes'}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
