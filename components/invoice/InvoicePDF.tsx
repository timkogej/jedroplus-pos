'use client'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import type { PosInvoice, PosInvoiceItem } from '@/types'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a', backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  companyName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },
  companyMeta: { fontSize: 9, color: '#666', marginTop: 2 },
  invoiceTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#6D5EF7', textAlign: 'right' },
  invoiceNumber: { fontSize: 11, color: '#333', textAlign: 'right', marginTop: 4 },
  divider: { borderBottom: '1 solid #eee', marginVertical: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: '#666', fontSize: 9 },
  value: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8f9fc', padding: '6 8', marginTop: 16, marginBottom: 2 },
  tableHeaderText: { fontSize: 8, color: '#666', fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', padding: '5 8', borderBottom: '1 solid #f0f0f0' },
  tableCell: { fontSize: 9 },
  totalsBox: { marginTop: 16, backgroundColor: '#f8f9fc', padding: 12, borderRadius: 6 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  totalLabel: { fontSize: 9, color: '#666' },
  totalValue: { fontSize: 9 },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, marginTop: 4, borderTop: '1 solid #ddd' },
  grandLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  grandValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#6D5EF7' },
  footer: { marginTop: 32, borderTop: '1 solid #eee', paddingTop: 12 },
  footerText: { fontSize: 8, color: '#999', textAlign: 'center' },
  eorBox: { backgroundColor: '#f0f7ff', padding: 8, borderRadius: 4, marginTop: 12 },
  eorLabel: { fontSize: 8, color: '#2F80ED', fontFamily: 'Helvetica-Bold' },
  eorValue: { fontSize: 7, color: '#333', marginTop: 2 },
})

interface InvoicePDFProps {
  invoice: PosInvoice & { pos_invoice_items?: PosInvoiceItem[] }
  companyName: string
  companyAddress?: string
  taxNumber?: string
}

function formatPayment(method: string): string {
  return { cash: 'Gotovina', card: 'Kartica', transfer: 'Bančno nakazilo', online: 'Spletno plačilo' }[method] ?? method
}

export default function InvoicePDF({ invoice, companyName, companyAddress, taxNumber }: InvoicePDFProps) {
  const items = invoice.pos_invoice_items ?? []

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{companyName}</Text>
            {companyAddress && <Text style={styles.companyMeta}>{companyAddress}</Text>}
            {taxNumber && <Text style={styles.companyMeta}>DDV: {taxNumber}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>RAČUN</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            <Text style={{ ...styles.companyMeta, textAlign: 'right', marginTop: 4 }}>
              {new Date(invoice.invoice_date).toLocaleDateString('sl-SI')}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Client & details */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...styles.label, marginBottom: 4, fontFamily: 'Helvetica-Bold' }}>STRANKA</Text>
            {invoice.client_name && <Text style={styles.tableCell}>{invoice.client_name}</Text>}
            {invoice.client_email && <Text style={styles.label}>{invoice.client_email}</Text>}
            {invoice.client_phone && <Text style={styles.label}>{invoice.client_phone}</Text>}
            {invoice.client_tax_number && <Text style={styles.label}>DDV: {invoice.client_tax_number}</Text>}
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <View style={styles.row}>
              <Text style={styles.label}>Plačilni način: </Text>
              <Text style={styles.value}>{formatPayment(invoice.payment_method)}</Text>
            </View>
          </View>
        </View>

        {/* Items table */}
        <View style={styles.tableHeader}>
          <Text style={{ ...styles.tableHeaderText, flex: 3 }}>Opis</Text>
          <Text style={{ ...styles.tableHeaderText, flex: 1, textAlign: 'center' }}>Kol.</Text>
          <Text style={{ ...styles.tableHeaderText, flex: 1, textAlign: 'right' }}>Cena</Text>
          <Text style={{ ...styles.tableHeaderText, flex: 1, textAlign: 'right' }}>DDV%</Text>
          <Text style={{ ...styles.tableHeaderText, flex: 1, textAlign: 'right' }}>Skupaj</Text>
        </View>
        {items.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{ ...styles.tableCell, flex: 3 }}>{item.description}</Text>
            <Text style={{ ...styles.tableCell, flex: 1, textAlign: 'center' }}>{item.quantity}</Text>
            <Text style={{ ...styles.tableCell, flex: 1, textAlign: 'right' }}>{item.unit_price.toFixed(2)}</Text>
            <Text style={{ ...styles.tableCell, flex: 1, textAlign: 'right' }}>{item.vat_rate}%</Text>
            <Text style={{ ...styles.tableCell, flex: 1, textAlign: 'right' }}>{item.total.toFixed(2)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Znesek brez DDV</Text>
            <Text style={styles.totalValue}>{(invoice.total - invoice.vat_amount).toFixed(2)} €</Text>
          </View>
          {invoice.discount_amount > 0 && (
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Popust</Text>
              <Text style={{ ...styles.totalValue, color: '#22c55e' }}>-{invoice.discount_amount.toFixed(2)} €</Text>
            </View>
          )}
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>DDV ({invoice.vat_rate}%)</Text>
            <Text style={styles.totalValue}>{invoice.vat_amount.toFixed(2)} €</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text style={styles.grandLabel}>SKUPAJ</Text>
            <Text style={styles.grandValue}>{invoice.total.toFixed(2)} €</Text>
          </View>
        </View>

        {/* FURS data */}
        {(invoice.eor || invoice.zoi) && (
          <View style={styles.eorBox}>
            <Text style={styles.eorLabel}>Račun potrjen pri FURS</Text>
            {invoice.eor && <Text style={styles.eorValue}>EOR: {invoice.eor}</Text>}
            {invoice.zoi && <Text style={styles.eorValue}>ZOI: {invoice.zoi}</Text>}
          </View>
        )}

        {invoice.notes && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>Opomba: {invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Račun je izstavljen skladno z Zakonom o davčnem potrjevanju računov (ZDavPR).
          </Text>
          <Text style={{ ...styles.footerText, marginTop: 2 }}>
            {companyName} · Jedro+ Davčna Blagajna
          </Text>
        </View>
      </Page>
    </Document>
  )
}
