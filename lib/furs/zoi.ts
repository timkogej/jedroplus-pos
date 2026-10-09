import forge from 'node-forge'
import type { FursInvoiceRequest } from './types'
import { ljZoiDateTime } from '@/lib/time'
import { extractInvoiceCounter } from './xml'

/**
 * ZOI (zaščitna oznaka izdajatelja računa) per ZDavPR:
 * 1. concatenate the invoice data (no separators)
 * 2. sign it with RSA-SHA256 using the company certificate's private key
 * 3. MD5 the raw signature bytes
 * 4. ZOI = lowercase hex (32 chars)
 */
export function calculateZoi(input: string, privateKeyPem: string): string {
  const md = forge.md.sha256.create()
  md.update(input, 'utf8')

  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem) as forge.pki.rsa.PrivateKey
  const signature = privateKey.sign(md)

  const md5 = forge.md.md5.create()
  md5.update(signature, 'raw')
  return md5.digest().toHex()
}

/**
 * ZOI input: taxNumber + issueDateTime + invoiceNumber + premise + device + amount.
 * invoiceNumber here is the bare sequential counter (same value as
 * fu:InvoiceNumber in the XML), NOT the formatted number printed on the receipt.
 */
export function buildZoiInput(req: FursInvoiceRequest): string {
  return [
    req.taxNumber,
    req.issueDateTime,
    req.invoiceCounter ?? extractInvoiceCounter(req.invoiceNumber),
    req.businessPremiseId,
    req.electronicDeviceId,
    req.invoiceAmount,
  ].join('')
}

/** Formats a Date as "dd.MM.yyyy HH:mm:ss" in Slovenian local time, the ZOI datetime format. */
export function formatDateForZoi(date: Date): string {
  return ljZoiDateTime(date)
}
