/**
 * FURS eFiskalizacija types (ZDavPR).
 *
 * Date formats:
 * - `issueDateTime` is always "dd.MM.yyyy HH:mm:ss" (the ZOI input format).
 *   The XML builder converts it to ISO 8601 for the SOAP message itself.
 */

export interface FursInvoiceRequest {
  taxNumber: string          // davčna številka podjetja (8 digits)
  issueDateTime: string      // format: "dd.MM.yyyy HH:mm:ss"
  invoiceNumber: string      // full formatted number, e.g. "R-2026-PS1-EN1-00042"
  businessPremiseId: string  // oznaka poslovnega prostora (PS1)
  electronicDeviceId: string // oznaka elektronske naprave (EN1)
  invoiceAmount: string      // total amount, 2 decimals, e.g. "25.00"
  paymentAmount: string      // same as invoiceAmount for standard invoices
  taxesPerSeller: FursTax[]
  operatorTaxNumber?: string // zaposleni davčna št. (optional)
  foreignOperator?: boolean
  subsequentSubmit?: boolean // true if offline/delayed submission
  referenceInvoice?: {       // for storno invoices
    referenceInvoiceNumber: string
    referenceBusinessPremiseId: string
    referenceElectronicDeviceId: string
    referenceInvoiceIssueDateTime: string // "dd.MM.yyyy HH:mm:ss"
  }
}

export interface FursTax {
  taxRate: number      // 22, 9.5 or 0
  taxableAmount: number
  taxAmount: number
}

export interface FursResponse {
  eor: string
  zoi: string
  confirmedAt: string
}

/**
 * Error raised anywhere in the FURS pipeline. When the ZOI was already
 * calculated before the failure it is carried along, so callers can issue the
 * invoice offline (real ZOI, pending EOR) as ZDavPR requires.
 */
export class FursError extends Error {
  code: string
  /** Real ZOI calculated before the failure, if available (offline mode). */
  zoi: string | null

  constructor(code: string, message: string, zoi: string | null = null) {
    super(message)
    this.name = 'FursError'
    this.code = code
    this.zoi = zoi
  }
}

export type FursEnvironment = 'test' | 'production'
