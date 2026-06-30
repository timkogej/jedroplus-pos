import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import type { PosInvoice, PosInvoiceItem, PosCompanyData } from '@/types'

export interface PdfGenerateOptions {
  invoice: PosInvoice
  items: PosInvoiceItem[]
  companyName: string
  companyData?: PosCompanyData | null
  companyAddress?: string
  taxNumber?: string
  brandPrimary?: string
  isTestMode?: boolean
  isStorno?: boolean
  stornoOf?: string
  premiseCode?: string
  deviceCode?: string
  currency?: string
  clientCompanyName?: string
  clientCompanyTax?: string
  loyaltyRedeemed?: { points: number; amount: number }
  loyaltyEarned?: { points: number; balance: number }
}

// Replace Slovenian special characters for PDF rendering
function rs(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/č/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z')
    .replace(/Č/g, 'C').replace(/Š/g, 'S').replace(/Ž/g, 'Z')
    .replace(/ć/g, 'c').replace(/Ć/g, 'C')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
}

function formatPayment(method: string): string {
  return rs(({ cash: 'Gotovina', card: 'Kartica', transfer: 'Bancno nakazilo', online: 'Spletno placilo' } as Record<string, string>)[method] ?? method)
}

function fmt(n: number, currency = 'EUR'): string {
  const symbol = currency === 'EUR' ? '€' : currency
  return `${n.toFixed(2)} ${symbol}`
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hour = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${day}.${month}.${year} ob ${hour}:${min}`
  } catch {
    return dateStr
  }
}

export async function generateInvoicePdf(opts: PdfGenerateOptions): Promise<Buffer> {
  const {
    invoice,
    items,
    companyName,
    companyData,
    companyAddress,
    taxNumber,
    brandPrimary = '#6D5EF7',
    isTestMode = false,
    isStorno = false,
    stornoOf,
    premiseCode,
    deviceCode,
    currency = 'EUR',
    clientCompanyName,
    clientCompanyTax,
    loyaltyRedeemed,
    loyaltyEarned,
  } = opts

  const qrContent = invoice.zoi
    ? `https://blagajne.fu.gov.si/0/${invoice.zoi}`
    : invoice.eor ?? invoice.invoice_number
  let qrDataUrl: string | null = null
  try {
    qrDataUrl = await QRCode.toDataURL(qrContent, { type: 'image/png', width: 160, margin: 1 })
  } catch {
    // QR generation is best-effort
  }

  // Compute totals
  const itemsExclVat = items.reduce((s, i) => {
    const vat = i.vat_amount ?? (i.total * i.vat_rate / (100 + i.vat_rate))
    return s + (i.total - vat)
  }, 0)
  const discountAmt = invoice.discount_amount ?? 0
  const osnova = invoice.total - invoice.vat_amount
  const hasDiscount = discountAmt > 0
  const discountLabel = invoice.discount_type === '%'
    ? `Popust (${discountAmt}%)`
    : 'Popust'

  // Group VAT by rate
  const vatByRate: Record<number, number> = {}
  items.forEach((item) => {
    const rate = item.vat_rate
    vatByRate[rate] = (vatByRate[rate] ?? 0) + (item.vat_amount ?? (item.total * rate / (100 + rate)))
  })

  const styles = StyleSheet.create({
    page: { fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a', backgroundColor: '#ffffff' },
    content: { paddingLeft: 44, paddingRight: 44, paddingTop: 28, paddingBottom: 44 },
    watermark: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', transform: 'rotate(-40deg)', opacity: 0.10 },
    watermarkLine1: { fontSize: 44, fontFamily: 'Helvetica-Bold', color: '#ca8a04', textAlign: 'center' },
    watermarkLine2: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#ca8a04', textAlign: 'center', marginTop: 6 },
    stornoWatermark: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', transform: 'rotate(-40deg)', opacity: 0.15 },
    stornoWatermarkText: { fontSize: 100, fontFamily: 'Helvetica-Bold', color: '#DC2626', textAlign: 'center' },
    stornoBadge: { backgroundColor: '#DC2626', borderRadius: 4, paddingVertical: 3, paddingHorizontal: 8, alignSelf: 'flex-start', marginBottom: 6 },
    stornoBadgeText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.8 },
    stornoRef: { fontSize: 9, color: '#DC2626', marginTop: 3 },
    stornoFooter: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#DC2626', textAlign: 'center', marginTop: 4 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    // Left: invoice identity
    invoiceTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0a0a0a' },
    invoiceNumber: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0a0a0a', marginTop: 4 },
    invoiceDate: { fontSize: 8.5, color: '#6b7280', marginTop: 3 },
    // Right: company info
    companyNameRight: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0a0a0a' },
    metaLine: { fontSize: 8.5, color: '#6b7280', marginTop: 1.5 },
    metaBlock: { marginTop: 6 },
    divider: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginVertical: 16 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    clientBlock: { flex: 1 },
    sectionLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
    clientName: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: '#0a0a0a' },
    clientMeta: { fontSize: 8.5, color: '#6b7280', marginTop: 2 },
    paymentBlock: { alignItems: 'flex-end' },
    paymentLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
    paymentValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0a0a0a' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#fafafa', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '7 8' },
    thText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 },
    tableRow: { flexDirection: 'row', padding: '7 8', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
    tdText: { fontSize: 9, color: '#1a1a1a' },
    totalsBox: { marginTop: 14, marginLeft: 'auto', width: '50%' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    totalLabel: { fontSize: 9, color: '#6b7280' },
    totalValue: { fontSize: 9.5, color: '#1a1a1a' },
    grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8, marginTop: 4 },
    grandLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0a0a0a' },
    grandValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0a0a0a' },
    fursBox: { marginTop: 20, backgroundColor: '#fafafa', borderRadius: 6, padding: '12 14' },
    fursTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    fursRow: { flexDirection: 'row', marginBottom: 3 },
    fursLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#6b7280', width: 120 },
    fursValue: { fontSize: 7.5, color: '#1a1a1a', flex: 1 },
    fursInner: { flexDirection: 'row', gap: 12 },
    fursData: { flex: 1 },
    footer: { marginTop: 28, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
    footerText: { fontSize: 7.5, color: '#9ca3af', textAlign: 'center' },
  })

  const seqParts = invoice.invoice_number.split('-')
  const seqNumber = seqParts[seqParts.length - 1] ?? invoice.invoice_number

  const cd = companyData

  const doc = (
    <Document title={`Racun ${invoice.invoice_number}`} author={rs(companyName)}>
      <Page size="A4" style={styles.page}>

        {/* Full-width accent bar */}
        <View style={{ height: 4, backgroundColor: brandPrimary }} />

        {/* Watermarks */}
        {isStorno && (
          <View style={styles.stornoWatermark}>
            <Text style={styles.stornoWatermarkText}>STORNO</Text>
          </View>
        )}
        {isTestMode && !isStorno && (
          <View style={styles.watermark}>
            <Text style={styles.watermarkLine1}>TESTNI NACIN</Text>
            <Text style={styles.watermarkLine2}>NI POTRJENO PRI FURS</Text>
          </View>
        )}

        {/* Content wrapper */}
        <View style={styles.content}>

          {/* Header — invoice identity left, company info right */}
          <View style={styles.header}>

            {/* LEFT: Invoice identity */}
            <View>
              {isStorno && (
                <View style={styles.stornoBadge}>
                  <Text style={styles.stornoBadgeText}>STORNO RACUN</Text>
                </View>
              )}
              <Text style={styles.invoiceTitle}>{isStorno ? 'STORNO RACUN' : 'RACUN'}</Text>
              <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
              <Text style={styles.invoiceDate}>{formatDateTime(invoice.invoice_date)}</Text>
              {isStorno && stornoOf && (
                <Text style={styles.stornoRef}>Storno racuna: {stornoOf}</Text>
              )}
            </View>

            {/* RIGHT: Company info */}
            <View style={{ alignItems: 'flex-start' }}>
              <Text style={styles.companyNameRight}>{rs(cd?.company_name || companyName)}</Text>

              {/* Block 1: Address */}
              {(cd?.address || cd?.city || companyAddress) && (
                <View style={styles.metaBlock}>
                  {cd?.address
                    ? <Text style={styles.metaLine}>{rs(cd.address)}</Text>
                    : companyAddress
                    ? <Text style={styles.metaLine}>{rs(companyAddress)}</Text>
                    : null}
                  {(cd?.postal_code || cd?.city) && (
                    <Text style={styles.metaLine}>
                      {[cd.postal_code, rs(cd.city)].filter(Boolean).join(' ')}{cd.country ? `, ${rs(cd.country)}` : ''}
                    </Text>
                  )}
                </View>
              )}

              {/* Block 2: Tax */}
              {(cd?.tax_number || cd?.vat_id || taxNumber) && (
                <View style={styles.metaBlock}>
                  {(cd?.tax_number || taxNumber) && (
                    <Text style={styles.metaLine}>Davcna st.: {cd?.tax_number || taxNumber}</Text>
                  )}
                  {cd?.vat_id && (
                    <Text style={styles.metaLine}>ID za DDV: {cd.vat_id}</Text>
                  )}
                </View>
              )}

              {/* Block 3: Contact */}
              {(cd?.email || cd?.phone || cd?.website) && (
                <View style={styles.metaBlock}>
                  {cd.email && <Text style={styles.metaLine}>{cd.email}</Text>}
                  {cd.phone && <Text style={styles.metaLine}>{cd.phone}</Text>}
                  {cd.website && <Text style={styles.metaLine}>{cd.website}</Text>}
                </View>
              )}

              {/* Block 4: Bank */}
              {cd?.iban && (
                <View style={styles.metaBlock}>
                  <Text style={styles.metaLine}>IBAN: {cd.iban}</Text>
                  {cd.bank && <Text style={styles.metaLine}>{rs(cd.bank)}</Text>}
                </View>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Client + Payment */}
          <View style={styles.sectionRow}>
            <View style={styles.clientBlock}>
              <Text style={styles.sectionLabel}>Stranka</Text>
              {invoice.client_name
                ? <Text style={styles.clientName}>{rs(invoice.client_name)}</Text>
                : <Text style={{ ...styles.clientMeta, fontFamily: 'Helvetica' }}>—</Text>}
              {clientCompanyName && (
                <Text style={styles.clientMeta}>{rs(clientCompanyName)}</Text>
              )}
              {invoice.client_email && (
                <Text style={styles.clientMeta}>{invoice.client_email}</Text>
              )}
              {invoice.client_phone && (
                <Text style={styles.clientMeta}>{invoice.client_phone}</Text>
              )}
              {(invoice.client_tax_number || clientCompanyTax) && (
                <Text style={styles.clientMeta}>ID za DDV: {invoice.client_tax_number || clientCompanyTax}</Text>
              )}
            </View>
            <View style={styles.paymentBlock}>
              <Text style={styles.paymentLabel}>Nacin placila</Text>
              <Text style={styles.paymentValue}>{formatPayment(invoice.payment_method)}</Text>
            </View>
          </View>

          {/* Items table */}
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.thText, flex: 3 }}>Opis storitve / blaga</Text>
            <Text style={{ ...styles.thText, flex: 1, textAlign: 'center' }}>Kol.</Text>
            <Text style={{ ...styles.thText, flex: 1.2, textAlign: 'right' }}>Cena brez DDV</Text>
            <Text style={{ ...styles.thText, flex: 0.8, textAlign: 'right' }}>DDV</Text>
            <Text style={{ ...styles.thText, flex: 1.2, textAlign: 'right' }}>Cena z DDV</Text>
          </View>
          {items.map((item, i) => (
            <View
              key={i}
              style={{
                ...styles.tableRow,
                ...(i === items.length - 1 ? { borderBottomWidth: 0 } : {}),
              }}
            >
              <Text style={{ ...styles.tdText, flex: 3 }}>{rs(item.description)}</Text>
              <Text style={{ ...styles.tdText, flex: 1, textAlign: 'center' }}>{item.quantity}</Text>
              <Text style={{ ...styles.tdText, flex: 1.2, textAlign: 'right' }}>{fmt(item.unit_price, currency)}</Text>
              <Text style={{ ...styles.tdText, flex: 0.8, textAlign: 'right' }}>{item.vat_rate}%</Text>
              <Text style={{ ...styles.tdText, flex: 1.2, textAlign: 'right' }}>{fmt(item.total, currency)}</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Cena brez DDV:</Text>
              <Text style={styles.totalValue}>{fmt(itemsExclVat, currency)}</Text>
            </View>
            {hasDiscount && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{discountLabel}:</Text>
                <Text style={{ ...styles.totalValue, color: '#16a34a' }}>-{fmt(discountAmt, currency)}</Text>
              </View>
            )}
            {hasDiscount && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Osnova za DDV:</Text>
                <Text style={styles.totalValue}>{fmt(osnova, currency)}</Text>
              </View>
            )}
            {Object.keys(vatByRate).map(Number).sort((a, b) => a - b).map((rate) => (
              <View key={rate} style={styles.totalRow}>
                <Text style={styles.totalLabel}>DDV {rate}%:</Text>
                <Text style={styles.totalValue}>{fmt(vatByRate[rate], currency)}</Text>
              </View>
            ))}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandLabel}>SKUPAJ</Text>
              <Text style={styles.grandValue}>{fmt(invoice.total, currency)}</Text>
            </View>
          </View>

          {/* FURS data */}
          {(invoice.eor || invoice.zoi || premiseCode || deviceCode) && (
            <View style={styles.fursBox}>
              <Text style={styles.fursTitle}>Potrditev FURS (Financna uprava RS)</Text>
              <View style={styles.fursInner}>
                <View style={styles.fursData}>
                  {premiseCode && (
                    <View style={styles.fursRow}>
                      <Text style={styles.fursLabel}>Posl. prostor:</Text>
                      <Text style={styles.fursValue}>{premiseCode}</Text>
                    </View>
                  )}
                  {deviceCode && (
                    <View style={styles.fursRow}>
                      <Text style={styles.fursLabel}>El. naprava:</Text>
                      <Text style={styles.fursValue}>{deviceCode}</Text>
                    </View>
                  )}
                  <View style={styles.fursRow}>
                    <Text style={styles.fursLabel}>St. racuna:</Text>
                    <Text style={styles.fursValue}>{seqNumber}</Text>
                  </View>
                  <View style={styles.fursRow}>
                    <Text style={styles.fursLabel}>Datum in cas:</Text>
                    <Text style={styles.fursValue}>{formatDateTime(invoice.invoice_date)}</Text>
                  </View>
                  {invoice.zoi && (
                    <View style={styles.fursRow}>
                      <Text style={styles.fursLabel}>ZOI:</Text>
                      <Text style={styles.fursValue}>{invoice.zoi}</Text>
                    </View>
                  )}
                  {invoice.eor && (
                    <View style={styles.fursRow}>
                      <Text style={styles.fursLabel}>EOR:</Text>
                      <Text style={styles.fursValue}>{invoice.eor}</Text>
                    </View>
                  )}
                </View>
                {qrDataUrl && (
                  <View style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 }}>
                    <Image src={qrDataUrl} style={{ width: 90, height: 90 }} />
                    <Text style={{ fontSize: 6, color: '#9ca3af', textAlign: 'center', marginTop: 2 }}>Preverite EOR</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Notes */}
          {invoice.notes && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 8.5, color: '#4b5563' }}>Opomba: {rs(invoice.notes)}</Text>
            </View>
          )}

          {/* Loyalty points */}
          {(loyaltyRedeemed || loyaltyEarned) && (
            <View style={{ marginTop: 10 }}>
              {loyaltyRedeemed && (
                <Text style={{ fontSize: 8.5, color: '#4b5563' }}>
                  Unovceno tock: {loyaltyRedeemed.points} (-{fmt(loyaltyRedeemed.amount, currency)})
                </Text>
              )}
              {loyaltyEarned && (
                <Text style={{ fontSize: 8.5, color: '#4b5563', marginTop: 2 }}>
                  Zasluzene tocke: +{loyaltyEarned.points} (skupno stanje: {loyaltyEarned.balance})
                </Text>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Racun je izstavljen skladno z Zakonom o davcnem potrjevanju racunov (ZDavPR).
            </Text>
            <Text style={{ ...styles.footerText, marginTop: 2 }}>
              {rs(cd?.company_name || companyName)} · Jedro+ Davcna Blagajna
            </Text>
            {isStorno && (
              <Text style={styles.stornoFooter}>Racun je bil storniran</Text>
            )}
          </View>

        </View>
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
