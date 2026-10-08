import { create } from 'xmlbuilder2'
import { randomUUID } from 'crypto'
import type { FursInvoiceRequest } from './types'
import { ljIsoLocal } from '@/lib/time'

// Per FURS technical documentation v3.1 §3.2.3 (and FURS's own responses):
// the fu namespace is exactly "http://www.fu.gov.si/".
export const FU_NS = 'http://www.fu.gov.si/'
export const SOAPENV_NS = 'http://schemas.xmlsoap.org/soap/envelope/'

export interface BuiltXml {
  xml: string
  messageId: string
}

/**
 * Builds the (unsigned) SOAP envelope for an InvoiceRequest. The request
 * element carries Id="data" — sign.ts appends an enveloped ds:Signature
 * referencing #data inside it, as the FURS schema requires.
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
    })

  const invoice = doc
    .ele('soapenv:Body')
    .ele('fu:InvoiceRequest', { Id: 'data' })
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
      .ele('fu:InvoiceNumber').txt(String(req.invoiceCounter ?? extractInvoiceCounter(req.invoiceNumber))).up()
    .up()
    .ele('fu:InvoiceAmount').txt(req.invoiceAmount).up()
    .ele('fu:PaymentAmount').txt(req.paymentAmount).up()

  // Schema: TaxesPerSeller holds one fu:VAT element per tax rate (no wrapper).
  const taxes = invoice.ele('fu:TaxesPerSeller')
  for (const tax of req.taxesPerSeller) {
    taxes
      .ele('fu:VAT')
        .ele('fu:TaxRate').txt(tax.taxRate.toFixed(2)).up()
        .ele('fu:TaxableAmount').txt(tax.taxableAmount.toFixed(2)).up()
        .ele('fu:TaxAmount').txt(tax.taxAmount.toFixed(2)).up()
      .up()
  }

  // Schema sequence: OperatorTaxNumber?, ForeignOperator?, ProtectedID,
  // SubsequentSubmit?, ReferenceInvoice?
  if (req.operatorTaxNumber) {
    invoice.ele('fu:OperatorTaxNumber').txt(req.operatorTaxNumber)
  }
  if (req.foreignOperator) {
    invoice.ele('fu:ForeignOperator').txt('true')
  }

  invoice.ele('fu:ProtectedID').txt(zoi)

  if (req.subsequentSubmit) {
    invoice.ele('fu:SubsequentSubmit').txt('true')
  }

  if (req.referenceInvoice) {
    invoice
      .ele('fu:ReferenceInvoice')
        .ele('fu:ReferenceInvoiceIdentifier')
          .ele('fu:BusinessPremiseID').txt(req.referenceInvoice.referenceBusinessPremiseId).up()
          .ele('fu:ElectronicDeviceID').txt(req.referenceInvoice.referenceElectronicDeviceId).up()
          .ele('fu:InvoiceNumber')
            .txt(String(req.referenceInvoice.referenceInvoiceCounter ?? extractInvoiceCounter(req.referenceInvoice.referenceInvoiceNumber)))
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

export interface FursPremiseAddress {
  street: string
  houseNumber: string // required by the FURS schema, must be non-empty
  houseNumberAdditional?: string // e.g. "A"
  community: string // naselje — required; defaults to city when not tracked separately
  city: string
  postalCode: string
}

export interface FursCadastralData {
  cadastralNumber: string // katastrska občina
  buildingNumber: string // številka stavbe
  buildingSectionNumber: string // del stavbe
}

export interface BusinessPremiseRequest {
  taxNumber: string
  businessPremiseId: string
  address?: FursPremiseAddress
  cadastralData?: FursCadastralData
  softwareSupplierTaxNumber: string
  validityDate: string // "YYYY-MM-DD"
}

/**
 * Builds the (unsigned) SOAP envelope for a BusinessPremiseRequest — the
 * one-time registration FURS requires before a premise can issue invoices.
 * New/untested surface (like the rest of lib/furs): verify against the real
 * WSDL/XSD before relying on it in production.
 */
export function buildBusinessPremiseRequestXml(req: BusinessPremiseRequest): BuiltXml {
  const messageId = randomUUID()

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('soapenv:Envelope', {
      'xmlns:soapenv': SOAPENV_NS,
      'xmlns:fu': FU_NS,
    })

  const premise = doc
    .ele('soapenv:Body')
    .ele('fu:BusinessPremiseRequest', { Id: 'data' })
      .ele('fu:Header')
        .ele('fu:MessageID').txt(messageId).up()
        .ele('fu:DateTime').txt(isoLocalDateTime(new Date())).up()
      .up()
      .ele('fu:BusinessPremise')

  premise
    .ele('fu:TaxNumber').txt(req.taxNumber).up()
    .ele('fu:BusinessPremiseID').txt(req.businessPremiseId).up()

  const bpIdentifier = premise.ele('fu:BPIdentifier')
  if (req.address) {
    // XSD requires positive integers for PropertyID fields (0/missing fails S001).
    const cadastralData = req.cadastralData ?? { cadastralNumber: '1', buildingNumber: '1', buildingSectionNumber: '1' }
    const address = bpIdentifier
      .ele('fu:RealEstateBP')
        .ele('fu:PropertyID')
          .ele('fu:CadastralNumber').txt(cadastralData.cadastralNumber).up()
          .ele('fu:BuildingNumber').txt(cadastralData.buildingNumber).up()
          .ele('fu:BuildingSectionNumber').txt(cadastralData.buildingSectionNumber).up()
        .up()
        .ele('fu:Address')
    address.ele('fu:Street').txt(req.address.street).up()
    address.ele('fu:HouseNumber').txt(req.address.houseNumber).up()
    if (req.address.houseNumberAdditional) {
      address.ele('fu:HouseNumberAdditional').txt(req.address.houseNumberAdditional).up()
    }
    address.ele('fu:Community').txt(req.address.community).up()
    address.ele('fu:City').txt(req.address.city).up()
    address.ele('fu:PostalCode').txt(req.address.postalCode).up()
  } else {
    bpIdentifier.ele('fu:MovableBP').txt(req.businessPremiseId)
  }

  premise
    .ele('fu:ValidityDate').txt(req.validityDate).up()
    .ele('fu:SoftwareSupplier')
      .ele('fu:TaxNumber').txt(req.softwareSupplierTaxNumber)

  return { xml: doc.end({ prettyPrint: false }), messageId }
}

/** SOAP envelope for the FURS echo/connectivity test. */
export function buildEchoRequestXml(): string {
  return create({ version: '1.0', encoding: 'UTF-8' })
    .ele('soapenv:Envelope', { 'xmlns:soapenv': SOAPENV_NS, 'xmlns:fu': FU_NS })
    .ele('soapenv:Body')
      .ele('fu:EchoRequest').txt('test')
    .end({ prettyPrint: false })
}

/** "04.07.2026 14:30:00" → "2026-07-04T14:30:00" */
export function zoiDateTimeToIso(zoiDateTime: string): string {
  const m = zoiDateTime.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2})$/)
  if (!m) return zoiDateTime
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}`
}

/** ISO 8601 without timezone suffix, Slovenian local time. */
export function isoLocalDateTime(date: Date): string {
  return ljIsoLocal(date)
}
