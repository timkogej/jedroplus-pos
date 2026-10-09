import type { PosInvoice, PosInvoiceItem } from '@/types'
import { authFetch } from '@/lib/authFetch'
import { buildFursQrCode } from '@/lib/furs/qr'

interface ThermalPrintOptions {
  invoice: PosInvoice & { pos_invoice_items?: PosInvoiceItem[] }
  companyName: string
  companyAddress?: string
  companyContact?: string
  taxNumber?: string
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Gotovina',
  card: 'Kartica',
  transfer: 'Bančno nakazilo',
  online: 'Spletno plačilo',
}

/**
 * Everything interpolated into the receipt HTML is escaped. Customer names come
 * from the public booking system, so an unescaped name like <img onerror=…> would
 * run script inside the print window (same origin as the logged-in POS).
 */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function eur(n: number): string {
  return n.toFixed(2) + ' EUR'
}

function shortenCode(code: string | null | undefined, len = 20): string {
  if (!code) return '—'
  return code.length > len ? code.slice(0, len) + '…' : code
}

export async function printThermal(opts: ThermalPrintOptions): Promise<void> {
  const e = escapeHtml
  const { invoice, companyName, companyAddress, companyContact, taxNumber } = opts
  const items = invoice.pos_invoice_items ?? []
  const isDemo = (invoice.furs_response as { demo?: boolean } | null)?.demo === true

  const invDate = new Date(invoice.invoice_date)
  const datum = invDate.toLocaleDateString('sl-SI')
  const cas = invDate.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
  const printedAt = new Date().toLocaleString('sl-SI')

  // Official FURS verification code (60 digits). The server knows the tax number
  // (it is in the certificate); fall back to the one passed in, if any.
  let qrContent: string = invoice.zoi ?? invoice.invoice_number
  try {
    const res = await authFetch(`/api/invoices/${invoice.id}/qr`)
    const json = (await res.json()) as { code?: string | null }
    if (json.code) qrContent = json.code
  } catch {
    const local = buildFursQrCode(invoice.zoi, taxNumber, new Date(invoice.invoice_date))
    if (local) qrContent = local
  }

  // Generated locally: no third party sees the ZOI, and it works offline.
  let qrUrl = ''
  try {
    const QRCode = (await import('qrcode')).default
    qrUrl = await QRCode.toDataURL(qrContent, { type: 'image/png', width: 240, margin: 2, errorCorrectionLevel: 'L' })
  } catch {
    // receipt still prints without the QR code
  }

  // Item rows hold pre-discount prices; scale to what was actually charged.
  const itemsGross = items.reduce((sum, i) => sum + i.total, 0)
  const scale = itemsGross !== 0 ? invoice.total / itemsGross : 1
  const vatByRate: Record<number, { base: number; vat: number }> = {}
  items.forEach((item) => {
    const rate = item.vat_rate
    const itemTotal = item.total * scale
    const itemVat = itemTotal * rate / (100 + rate)
    const itemBase = itemTotal - itemVat
    if (!vatByRate[rate]) vatByRate[rate] = { base: 0, vat: 0 }
    vatByRate[rate].base += itemBase
    vatByRate[rate].vat += itemVat
  })

  const html = `<!DOCTYPE html>
<html lang="sl">
<head>
<meta charset="UTF-8">
<title>Račun ${e(invoice.invoice_number)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    width: 72mm;
    margin: 0 auto;
    padding: 4mm 2mm;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; }
  .row-right { text-align: right; }
  .small { font-size: 9px; }
  .large { font-size: 13px; font-weight: bold; }
  .warning {
    border: 1px solid #000;
    padding: 3px 6px;
    text-align: center;
    font-weight: bold;
    font-size: 10px;
    margin: 6px 0;
  }
  img.qr { display: block; margin: 6px auto; width: 150px; height: 150px; image-rendering: pixelated; }
  .test { color: #c00; }
  @media print {
    body { width: 72mm; }
    @page { size: 80mm auto; margin: 0; }
  }
</style>
</head>
<body>
  <div class="center bold" style="font-size:13px;">${e(companyName)}</div>
  ${companyAddress ? `<div class="center small">${e(companyAddress)}</div>` : ''}
  ${companyContact ? `<div class="center small">${e(companyContact)}</div>` : ''}
  ${taxNumber ? `<div class="center small">ID za DDV: ${e(taxNumber)}</div>` : ''}

  ${isDemo ? `<div class="warning test">⚠ TESTNI NAČIN ⚠</div>` : ''}

  <div class="line"></div>

  <div class="center bold">RAČUN</div>
  <div class="row"><span>Številka:</span><span class="bold">${e(invoice.invoice_number)}</span></div>
  <div class="row"><span>Datum:</span><span>${e(datum)}</span></div>
  <div class="row"><span>Čas:</span><span>${e(cas)}</span></div>
  <div class="row"><span>Plačilo:</span><span>${e(PAYMENT_LABELS[invoice.payment_method] ?? invoice.payment_method)}</span></div>
  ${invoice.client_name ? `<div class="row"><span>Stranka:</span><span>${e(invoice.client_name)}</span></div>` : ''}

  <div class="line"></div>

  ${items.map((item) => `
  <div class="bold">${e(item.description)}</div>
  <div class="row">
    <span class="small">${e(item.quantity)} × ${item.unit_price.toFixed(2)} · DDV ${e(item.vat_rate)}%</span>
    <span>${item.total.toFixed(2)} EUR</span>
  </div>`).join('')}

  <div class="line"></div>

  <div class="row"><span>Brez DDV:</span><span>${eur(invoice.total - invoice.vat_amount)}</span></div>
  ${invoice.discount_amount > 0 ? `<div class="row"><span>Popust:</span><span>-${eur(invoice.discount_amount)}</span></div>` : ''}
  ${Object.keys(vatByRate).map(Number).sort((a, b) => a - b).map((rate) =>
    `<div class="row"><span>DDV ${rate}%:</span><span>${eur(vatByRate[rate].vat)}</span></div>`
  ).join('')}
  <div class="line"></div>
  <div class="row large"><span>SKUPAJ:</span><span>${eur(invoice.total)}</span></div>

  <div class="line"></div>

  ${invoice.zoi ? `<div class="small" style="word-break:break-all;">ZOI: ${e(invoice.zoi)}</div>` : ''}
  ${invoice.eor ? `<div class="small" style="word-break:break-all;">EOR: ${e(invoice.eor)}</div>` : ''}

  ${qrUrl ? `<img class="qr" src="${qrUrl}" alt="QR" />` : ''}

  <div class="line"></div>

  <div class="center small">${invoice.eor ? 'Račun potrjen pri FURS' : 'Potrditev pri FURS je v teku'}</div>
  ${isDemo ? `<div class="center bold small test">** TESTNI NAČIN **</div>` : ''}
  <div class="center bold" style="margin-top:4px;">Hvala za obisk!</div>
  <div class="center small" style="margin-top:4px;">Natisnjeno: ${printedAt}</div>

  <div style="margin-top:8px;"></div>
</body>
</html>`

  const popup = window.open('', '_blank', 'width=320,height=600,scrollbars=yes')
  if (!popup) {
    alert('Prosimo, dovolite pojavna okna za tiskanje.')
    return
  }
  popup.document.write(html)
  popup.document.close()
  popup.focus()
  setTimeout(() => {
    popup.print()
  }, 500)
}

export function printA4(slug: string, invoiceId: string): void {
  window.print()
}
