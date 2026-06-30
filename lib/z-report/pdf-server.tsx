import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { PosCompanyData } from '@/types'

export interface ZReportPdfData {
  reportLabel: string // Z-YYYY-NNNN
  reportDate: string // YYYY-MM-DD
  closedAt: string // ISO
  total_revenue: number
  total_invoices: number
  total_cash: number
  total_card: number
  total_transfer: number
  total_online: number
  total_storno: number
  total_storno_count: number
  vat_base_22: number
  vat_amount_22: number
  vat_base_95: number
  vat_amount_95: number
  vat_base_0: number
}

export interface ZReportPdfOptions {
  report: ZReportPdfData
  companyName: string
  companyData?: PosCompanyData | null
  premiseCode?: string
  deviceCode?: string
  brandPrimary?: string
  isTestMode?: boolean
  currency?: string
}

// Replace Slovenian special characters for PDF rendering (Helvetica has no š/č/ž).
function rs(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/č/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z')
    .replace(/Č/g, 'C').replace(/Š/g, 'S').replace(/Ž/g, 'Z')
    .replace(/ć/g, 'c').replace(/Ć/g, 'C')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
}

function fmt(n: number, currency = 'EUR'): string {
  const symbol = currency === 'EUR' ? '€' : currency
  return `${n.toFixed(2)} ${symbol}`
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  if (y && m && d) return `${d}.${m}.${y}`
  return dateStr
}

function formatDateTime(iso: string): string {
  try {
    const dt = new Date(iso)
    const day = String(dt.getDate()).padStart(2, '0')
    const month = String(dt.getMonth() + 1).padStart(2, '0')
    const year = dt.getFullYear()
    const hh = String(dt.getHours()).padStart(2, '0')
    const mm = String(dt.getMinutes()).padStart(2, '0')
    const ss = String(dt.getSeconds()).padStart(2, '0')
    return `${day}.${month}.${year} ${hh}:${mm}:${ss}`
  } catch {
    return iso
  }
}

export async function generateZReportPdf(opts: ZReportPdfOptions): Promise<Buffer> {
  const {
    report: r,
    companyName,
    companyData: cd,
    premiseCode,
    deviceCode,
    brandPrimary = '#6D5EF7',
    isTestMode = false,
    currency = 'EUR',
  } = opts

  const netto = r.total_revenue - r.total_storno
  const vatBaseTotal = r.vat_base_22 + r.vat_base_95 + r.vat_base_0
  const vatAmountTotal = r.vat_amount_22 + r.vat_amount_95
  const vatGrandTotal = vatBaseTotal + vatAmountTotal

  const styles = StyleSheet.create({
    page: { fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a', backgroundColor: '#ffffff' },
    content: { paddingLeft: 44, paddingRight: 44, paddingTop: 28, paddingBottom: 44 },
    watermark: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', transform: 'rotate(-40deg)', opacity: 0.1 },
    watermarkLine1: { fontSize: 44, fontFamily: 'Helvetica-Bold', color: '#ca8a04', textAlign: 'center' },
    titleBlock: { alignItems: 'center', marginBottom: 18 },
    title: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#0a0a0a', letterSpacing: 1 },
    subtitle: { fontSize: 10, color: '#6b7280', marginTop: 3 },
    company: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0a0a0a', marginTop: 10 },
    companyMeta: { fontSize: 8.5, color: '#6b7280', marginTop: 1.5 },
    divider: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginVertical: 14 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    infoLabel: { fontSize: 9, color: '#6b7280' },
    infoValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },
    sectionLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#fafafa', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '7 8' },
    thText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 },
    row: { flexDirection: 'row', padding: '6 8', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
    td: { fontSize: 9, color: '#1a1a1a' },
    tdMuted: { fontSize: 9, color: '#6b7280' },
    totalRow: { flexDirection: 'row', padding: '8 8', borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fafafa' },
    totalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0a0a0a' },
    totalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0a0a0a', textAlign: 'right' },
    signatureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 },
    signatureLine: { borderTopWidth: 1, borderTopColor: '#9ca3af', width: 200, paddingTop: 4, fontSize: 8, color: '#6b7280' },
    footer: { marginTop: 28, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
    footerText: { fontSize: 7.5, color: '#9ca3af', textAlign: 'center' },
  })

  const addressLine = [cd?.postal_code, rs(cd?.city)].filter(Boolean).join(' ')

  const doc = (
    <Document title={`Z-porocilo ${r.reportLabel}`} author={rs(companyName)}>
      <Page size="A4" style={styles.page}>
        <View style={{ height: 4, backgroundColor: brandPrimary }} />

        {isTestMode && (
          <View style={styles.watermark}>
            <Text style={styles.watermarkLine1}>TESTNI NACIN</Text>
          </View>
        )}

        <View style={styles.content}>
          {/* Title */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Z-POROCILO</Text>
            <Text style={styles.subtitle}>Dnevni zakljucek blagajne</Text>
            <Text style={styles.company}>{rs(cd?.company_name || companyName)}</Text>
            {cd?.address && <Text style={styles.companyMeta}>{rs(cd.address)}</Text>}
            {addressLine ? <Text style={styles.companyMeta}>{addressLine}</Text> : null}
            {(cd?.tax_number || cd?.vat_id) && (
              <Text style={styles.companyMeta}>
                {cd?.vat_id ? `ID za DDV: ${cd.vat_id}` : `Davcna st.: ${cd?.tax_number}`}
              </Text>
            )}
          </View>

          <View style={styles.divider} />

          {/* Business info */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Datum</Text>
            <Text style={styles.infoValue}>{formatDate(r.reportDate)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Stevilka porocila</Text>
            <Text style={styles.infoValue}>{r.reportLabel}</Text>
          </View>
          {premiseCode && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Poslovni prostor</Text>
              <Text style={styles.infoValue}>{premiseCode}</Text>
            </View>
          )}
          {deviceCode && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Elektronska naprava</Text>
              <Text style={styles.infoValue}>{deviceCode}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cas zakljucka</Text>
            <Text style={styles.infoValue}>{formatDateTime(r.closedAt)}</Text>
          </View>

          {/* Revenue summary */}
          <Text style={styles.sectionLabel}>Pregled prihodkov</Text>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.thText, flex: 3 }}>Opis</Text>
            <Text style={{ ...styles.thText, flex: 1, textAlign: 'right' }}>Znesek</Text>
          </View>
          {[
            ['Skupni prihodki', r.total_revenue],
            ['Gotovina', r.total_cash],
            ['Kartica', r.total_card],
            ['Bancno nakazilo', r.total_transfer],
            ['Spletna placila', r.total_online],
          ].map(([label, value], i) => (
            <View key={i} style={styles.row}>
              <Text style={{ ...styles.tdMuted, flex: 3 }}>{label as string}</Text>
              <Text style={{ ...styles.td, flex: 1, textAlign: 'right' }}>{fmt(value as number, currency)}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={{ ...styles.tdMuted, flex: 3 }}>Stornirani racuni</Text>
            <Text style={{ ...styles.td, flex: 1, textAlign: 'right', color: '#dc2626' }}>
              -{fmt(r.total_storno, currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={{ ...styles.totalLabel, flex: 3 }}>Neto prihodki</Text>
            <Text style={{ ...styles.totalValue, flex: 1 }}>{fmt(netto, currency)}</Text>
          </View>

          {/* Invoice summary */}
          <Text style={styles.sectionLabel}>Pregled racunov</Text>
          <View style={styles.row}>
            <Text style={{ ...styles.tdMuted, flex: 3 }}>Stevilo racunov</Text>
            <Text style={{ ...styles.td, flex: 1, textAlign: 'right' }}>{r.total_invoices}</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ ...styles.tdMuted, flex: 3 }}>Stevilo storniranih</Text>
            <Text style={{ ...styles.td, flex: 1, textAlign: 'right' }}>{r.total_storno_count}</Text>
          </View>

          {/* VAT breakdown */}
          <Text style={styles.sectionLabel}>Razclenitev DDV</Text>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.thText, flex: 1.5 }}>Stopnja DDV</Text>
            <Text style={{ ...styles.thText, flex: 1, textAlign: 'right' }}>Osnova</Text>
            <Text style={{ ...styles.thText, flex: 1, textAlign: 'right' }}>DDV</Text>
            <Text style={{ ...styles.thText, flex: 1, textAlign: 'right' }}>Skupaj</Text>
          </View>
          {[
            ['22%', r.vat_base_22, r.vat_amount_22],
            ['9.5%', r.vat_base_95, r.vat_amount_95],
            ['0%', r.vat_base_0, 0],
          ].map(([label, base, vat], i) => (
            <View key={i} style={styles.row}>
              <Text style={{ ...styles.tdMuted, flex: 1.5 }}>{label as string}</Text>
              <Text style={{ ...styles.td, flex: 1, textAlign: 'right' }}>{fmt(base as number, currency)}</Text>
              <Text style={{ ...styles.td, flex: 1, textAlign: 'right' }}>{fmt(vat as number, currency)}</Text>
              <Text style={{ ...styles.td, flex: 1, textAlign: 'right' }}>{fmt((base as number) + (vat as number), currency)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={{ ...styles.totalLabel, flex: 1.5 }}>SKUPAJ</Text>
            <Text style={{ ...styles.totalValue, flex: 1 }}>{fmt(vatBaseTotal, currency)}</Text>
            <Text style={{ ...styles.totalValue, flex: 1 }}>{fmt(vatAmountTotal, currency)}</Text>
            <Text style={{ ...styles.totalValue, flex: 1 }}>{fmt(vatGrandTotal, currency)}</Text>
          </View>

          {/* Signature */}
          <View style={styles.signatureRow}>
            <Text style={styles.signatureLine}>Odgovorna oseba</Text>
            <Text style={styles.signatureLine}>Podpis</Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Porocilo ustvarjeno: {formatDateTime(r.closedAt)}</Text>
            <Text style={{ ...styles.footerText, marginTop: 2 }}>
              {rs(cd?.company_name || companyName)} · Jedro+ Blagajna
            </Text>
            {isTestMode && (
              <Text style={{ ...styles.footerText, marginTop: 2, color: '#ca8a04', fontFamily: 'Helvetica-Bold' }}>
                TESTNI NACIN
              </Text>
            )}
          </View>
        </View>
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
