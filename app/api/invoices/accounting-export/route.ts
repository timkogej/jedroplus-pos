import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyAccess } from '@/lib/auth/apiAuth'
import * as XLSX from 'xlsx'
import type { PosInvoice, PosInvoiceItem } from '@/types'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Gotovina',
  card: 'Kartica',
  transfer: 'Bančno nakazilo',
  online: 'Spletno plačilo',
}

const STATUS_LABELS: Record<string, string> = {
  issued: 'Izdan',
  draft: 'Osnutek',
  cancelled: 'Storniran',
  storno_original: 'Storniran',
  storno: 'Storno',
}

type ExportInvoice = PosInvoice & { pos_invoice_items?: PosInvoiceItem[] }

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function itemsByRate(items: PosInvoiceItem[], rate: number): PosInvoiceItem[] {
  return items.filter((i) => i.vat_rate === rate)
}

function sumItemBase(items: PosInvoiceItem[]): number {
  return items.reduce((acc, i) => acc + i.total / (1 + i.vat_rate / 100), 0)
}

function sumItemVat(items: PosInvoiceItem[]): number {
  return items.reduce((acc, i) => {
    const base = i.total / (1 + i.vat_rate / 100)
    return acc + (i.vat_amount != null ? i.vat_amount : i.total - base)
  }, 0)
}

function sumItemTotal(items: PosInvoiceItem[]): number {
  return items.reduce((acc, i) => acc + i.total, 0)
}

function n(v: number): number {
  return parseFloat(v.toFixed(2))
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { companyId, dateFrom, dateTo } = body as {
    companyId?: string
    dateFrom?: string
    dateTo?: string
  }

  const auth = await requireCompanyAccess(req, companyId)
  if ('response' in auth) return auth.response

  const supabase = createServiceClient()

  const { data: subscription } = await supabase
    .from('pos_subscriptions')
    .select('plan')
    .eq('company_id', companyId)
    .maybeSingle()

  if (subscription?.plan !== 'pro') {
    return NextResponse.json(
      { error: 'Ta funkcija je na voljo samo za naročnike plana Pro.', upgrade: true },
      { status: 403 },
    )
  }

  let query = supabase
    .from('pos_invoices')
    .select('*, pos_invoice_items(*)')
    .eq('company_id', companyId)
    .order('invoice_date', { ascending: true })

  if (dateFrom) query = query.gte('invoice_date', `${dateFrom}T00:00:00`)
  if (dateTo) query = query.lte('invoice_date', `${dateTo}T23:59:59`)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Napaka pri pridobivanju računov' }, { status: 500 })
  }

  const invoices = (data ?? []) as ExportInvoice[]

  // ── Sheet 1: Računi ────────────────────────────────────────────────────────
  const s1: (string | number)[][] = [[
    'Številka računa', 'Datum', 'Čas', 'Stranka', 'Davčna številka stranke',
    'Osnova brez DDV', 'DDV 22%', 'DDV 9.5%', 'Osnova 0%',
    'Skupaj DDV', 'Skupaj z DDV', 'Način plačila', 'Status', 'EOR', 'ZOI',
  ]]

  for (const inv of invoices) {
    const items = inv.pos_invoice_items ?? []

    let base22 = 0, vat22 = 0
    let base9 = 0, vat9 = 0
    let base0 = 0

    if (items.length > 0) {
      const i22 = itemsByRate(items, 22)
      const i9 = itemsByRate(items, 9.5)
      const i0 = itemsByRate(items, 0)
      base22 = sumItemBase(i22)
      vat22 = sumItemVat(i22)
      base9 = sumItemBase(i9)
      vat9 = sumItemVat(i9)
      base0 = sumItemTotal(i0)
    } else {
      const base = inv.total - inv.vat_amount
      if (inv.vat_rate === 22) { base22 = base; vat22 = inv.vat_amount }
      else if (inv.vat_rate === 9.5) { base9 = base; vat9 = inv.vat_amount }
      else { base0 = inv.total }
    }

    const totalBase = base22 + base9 + base0
    const totalVat = vat22 + vat9

    s1.push([
      inv.invoice_number,
      fmtDate(inv.invoice_date),
      fmtTime(inv.invoice_date),
      inv.client_name ?? '',
      inv.client_tax_number ?? '',
      n(totalBase),
      n(vat22),
      n(vat9),
      n(base0),
      n(totalVat),
      n(inv.total),
      PAYMENT_LABELS[inv.payment_method] ?? inv.payment_method,
      STATUS_LABELS[inv.status] ?? inv.status,
      inv.eor ?? '',
      inv.zoi ?? '',
    ])
  }

  // ── Sheet 2: DDV razčlenitev ───────────────────────────────────────────────
  type VatAcc = { count: number; base: number; vat: number; total: number }
  const vatMap: Record<string, VatAcc> = {
    '22': { count: 0, base: 0, vat: 0, total: 0 },
    '9.5': { count: 0, base: 0, vat: 0, total: 0 },
    '0': { count: 0, base: 0, vat: 0, total: 0 },
  }

  for (const inv of invoices) {
    const items = inv.pos_invoice_items ?? []
    if (items.length > 0) {
      for (const [rate, key] of [[22, '22'], [9.5, '9.5'], [0, '0']] as [number, string][]) {
        const grp = itemsByRate(items, rate)
        if (!grp.length) continue
        vatMap[key].count += 1
        vatMap[key].base += sumItemBase(grp)
        vatMap[key].vat += sumItemVat(grp)
        vatMap[key].total += sumItemTotal(grp)
      }
    } else {
      const base = inv.total - inv.vat_amount
      const key = String(inv.vat_rate)
      if (vatMap[key]) {
        vatMap[key].count += 1
        vatMap[key].base += base
        vatMap[key].vat += inv.vat_amount
        vatMap[key].total += inv.total
      }
    }
  }

  const s2: (string | number)[][] = [['Stopnja DDV', 'Št. računov', 'Osnova', 'DDV znesek', 'Skupaj']]
  let sumBase = 0, sumVat = 0, sumTotal2 = 0, sumCount = 0

  for (const [key, label] of [['22', '22%'], ['9.5', '9.5%'], ['0', '0%']] as [string, string][]) {
    const g = vatMap[key]
    s2.push([label, g.count, n(g.base), n(g.vat), n(g.total)])
    sumBase += g.base
    sumVat += g.vat
    sumTotal2 += g.total
    sumCount += g.count
  }
  s2.push(['SKUPAJ', sumCount, n(sumBase), n(sumVat), n(sumTotal2)])

  // ── Sheet 3: Mesečni povzetek ──────────────────────────────────────────────
  type MonthAcc = { label: string; revenue: number; vat: number; count: number; cancelled: number }
  const monthMap = new Map<string, MonthAcc>()

  for (const inv of invoices) {
    const d = new Date(inv.invoice_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        label: d.toLocaleDateString('sl-SI', { year: 'numeric', month: 'long' }),
        revenue: 0,
        vat: 0,
        count: 0,
        cancelled: 0,
      })
    }
    const mg = monthMap.get(key)!
    if (inv.status === 'storno_original' || inv.status === 'cancelled') {
      mg.cancelled += 1
    } else {
      mg.revenue += inv.total
      mg.vat += inv.vat_amount
      mg.count += 1
    }
  }

  const s3: (string | number)[][] = [['Mesec', 'Prihodki', 'DDV', 'Število računov', 'Stornirani']]
  for (const mg of Array.from(monthMap.values())) {
    s3.push([mg.label, n(mg.revenue), n(mg.vat), mg.count, mg.cancelled])
  }

  // ── Sheet 4: Po načinu plačila ─────────────────────────────────────────────
  type PayAcc = { count: number; amount: number }
  const payMap: Record<string, PayAcc> = {
    cash: { count: 0, amount: 0 },
    card: { count: 0, amount: 0 },
    transfer: { count: 0, amount: 0 },
    online: { count: 0, amount: 0 },
  }

  for (const inv of invoices) {
    if (inv.status === 'storno_original' || inv.status === 'cancelled') continue
    const pg = payMap[inv.payment_method]
    if (pg) { pg.count += 1; pg.amount += inv.total }
  }

  const s4: (string | number)[][] = [['Način plačila', 'Število', 'Znesek']]
  for (const [key, label] of [
    ['cash', 'Gotovina'],
    ['card', 'Kartica'],
    ['transfer', 'Bančno nakazilo'],
    ['online', 'Spletno plačilo'],
  ] as [string, string][]) {
    const pg = payMap[key]
    s4.push([label, pg.count, n(pg.amount)])
  }

  // ── Build workbook ─────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()

  const ws1 = XLSX.utils.aoa_to_sheet(s1)
  ws1['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 7 }, { wch: 25 }, { wch: 20 },
    { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 13 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 40 }, { wch: 40 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, 'Računi')

  const ws2 = XLSX.utils.aoa_to_sheet(s2)
  ws2['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'DDV razčlenitev')

  const ws3 = XLSX.utils.aoa_to_sheet(s3)
  ws3['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Mesečni povzetek')

  const ws4 = XLSX.utils.aoa_to_sheet(s4)
  ws4['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws4, 'Po načinu plačila')

  // xlsx types don't perfectly match BlobPart; cast through unknown to satisfy TS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as any
  const blob = new Blob([raw as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const filename = `Racunovodski-izvoz-${dateFrom ?? 'zacetek'}-${dateTo ?? 'danes'}.xlsx`

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
