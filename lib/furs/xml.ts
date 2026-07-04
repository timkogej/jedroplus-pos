import { create } from 'xmlbuilder2'
import { randomUUID } from 'crypto'
import type { FursInvoiceRequest } from './types'

export const FU_NS = 'http://www.fu.gov.si/eFiskalizacija/schemas'
export const SOAPENV_NS = 'http://schemas.xmlsoap.org/soap/envelope/'
export const WSSE_NS =
  'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd'
export const WSU_NS =
  'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd'

export interface BuiltXml {
  xml: string
  messageId: string
}

/**
 * Builds the (unsigned) SOAP envelope for an InvoiceRequest. The wsse:Security
 * header is left empty — sign.ts fills in the BinarySecurityToken + Signature.
 *
 * FURS quirks:
 * - fu:InvoiceNumber holds only the sequential counter, not the whole
 *   formatted number (the premise/device live in their own elements).
 * - the ZOI travels in fu:ProtectedID.
 * - IssueDateTime is ISO 8601 local time; the dd.MM.yyyy form is only for
 *   the ZOI input.
 */
export function buildInvoiceRequestXml(req: FursInvoiceRequest, zoi: string): BuiltXml {
  const messageId = randomUUID()

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('soapenv:Envelope', {
      'xmlns:soapenv': SOAPENV_NS,
      'xmlns:fu': FU_NS,
      'xmlns:wsse': WSSE_NS,
      'xmlns:wsu': WSU_NS,
    })

  doc.ele('soapenv:Header')
    .ele('wsse:Security', { 'soapenv:mustUnderstand': '1' })

  const invoice = doc
    .ele('soapenv:Body', { 'wsu:Id': 'Body' })
    .ele('fu:InvoiceRequest')
      .ele('fu:Header')
        .ele('fu:MessageID').txt(messageId).up()
        .ele('fu:DateTime').txt(isoLocalDateTime(new Date())).up()
      .up()
      .ele('fu:Invoice')

  invoice
    .ele('fu:TaxNumber').txt(req.taxNumber).up()
    .ele('fu:IssueDateTime').txt(zoiDateTimeToIso(req.issueDateTime)).up()
    .ele('fu:NumberingStructure').txt('B').up()
    .ele('fu:InvoiceIdentifier')
      .ele('fu:BusinessPremiseID').txt(req.businessPremiseId).up()
      .ele('fu:ElectronicDeviceID').txt(req.electronicDeviceId).up()
      .ele('fu:InvoiceNumber').txt(extractInvoiceCounter(req.invoiceNumber)).up()
    .up()
    .ele('fu:InvoiceAmount').txt(req.invoiceAmount).up()
    .ele('fu:PaymentAmount').txt(req.paymentAmount).up()

  const vat = invoice.ele('fu:TaxesPerSeller').ele('fu:Taxes').ele('fu:VAT')
  for (const tax of req.taxesPerSeller) {
    vat
      .ele('fu:TaxRate').txt(tax.taxRate.toFixed(2)).up()
      .ele('fu:TaxableAmount').txt(tax.taxableAmount.toFixed(2)).up()
      .ele('fu:TaxAmount').txt(tax.taxAmount.toFixed(2)).up()
  }

  if (req.operatorTaxNumber) {
    invoice.ele('fu:OperatorTaxNumber').txt(req.operatorTaxNumber)
  }
  if (req.foreignOperator) {
    invoice.ele('fu:ForeignOperator').txt('true')
  }
  if (req.subsequentSubmit) {
    invoice.ele('fu:SubsequentSubmit').txt('true')
  }

  invoice.ele('fu:ProtectedID').txt(zoi)

  if (req.referenceInvoice) {
    invoice
      .ele('fu:ReferenceInvoice')
        .ele('fu:ReferenceInvoiceIdentifier')
          .ele('fu:BusinessPremiseID').txt(req.referenceInvoice.referenceBusinessPremiseId).up()
          .ele('fu:ElectronicDeviceID').txt(req.referenceInvoice.referenceElectronicDeviceId).up()
          .ele('fu:InvoiceNumber')
            .txt(extractInvoiceCounter(req.referenceInvoice.referenceInvoiceNumber))
          .up()
        .up()
        .ele('fu:ReferenceInvoiceIssueDateTime')
          .txt(zoiDateTimeToIso(req.referenceInvoice.referenceInvoiceIssueDateTime))
  }

  return { xml: doc.end({ prettyPrint: false }), messageId }
}

/**
 * "R-2026-PS1-EN1-00042" → "42". FURS expects the bare sequential counter
 * ([1-9][0-9]*); premise/device are separate elements.
 */
export function extractInvoiceCounter(invoiceNumber: string): string {
  const lastSegment = invoiceNumber.split(/[^0-9]+/).filter(Boolean).pop()
  if (!lastSegment) return invoiceNumber
  return String(parseInt(lastSegment, 10))
}

/** "04.07.2026 14:30:00" → "2026-07-04T14:30:00" */
export function zoiDateTimeToIso(zoiDateTime: string): string {
  const m = zoiDateTime.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2})$/)
  if (!m) return zoiDateTime
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}`
}

/** ISO 8601 without timezone suffix, local time. */
export function isoLocalDateTime(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}
