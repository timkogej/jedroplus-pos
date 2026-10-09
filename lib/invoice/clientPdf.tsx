import type { PosInvoice, PosInvoiceItem } from '@/types'

/**
 * Last-resort, in-browser PDF rendering (used only when the server cannot
 * produce one). The PDF library is ~500 kB, so it is loaded on demand instead of
 * being part of the invoice pages' JavaScript — those pages are opened all the
 * time and almost never need it.
 */
export async function renderInvoicePdfBlob(
  invoice: PosInvoice & { pos_invoice_items?: PosInvoiceItem[] },
  companyName: string
): Promise<Blob> {
  const [{ pdf }, { default: InvoicePDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/invoice/InvoicePDF'),
  ])
  return pdf(<InvoicePDF invoice={invoice} companyName={companyName} />).toBlob()
}
