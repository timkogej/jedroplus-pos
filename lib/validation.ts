/**
 * Lightweight input validators for API routes. Throw `ValidationError` (mapped
 * to HTTP 400 by the caller) when input is malformed.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'online'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value)
}

export function assertUuid(value: unknown, field: string): asserts value is string {
  if (!isUuid(value)) throw new ValidationError(`Neveljaven ${field}`)
}

export function assertPositiveAmount(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ValidationError(`Neveljaven ${field}`)
  }
}

export function assertNonNegativeAmount(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ValidationError(`Neveljaven ${field}`)
  }
}

export function assertPaymentMethod(value: unknown): asserts value is PaymentMethod {
  if (typeof value !== 'string' || !PAYMENT_METHODS.includes(value as PaymentMethod)) {
    throw new ValidationError('Neveljaven način plačila')
  }
}

interface InvoiceItemInput {
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
}

/** Validates the invoice line items array. Returns the typed items. */
export function assertInvoiceItems(value: unknown): InvoiceItemInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('Manjkajo postavke računa')
  }
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new ValidationError('Neveljavna postavka računa')
    const it = item as Record<string, unknown>
    if (typeof it.description !== 'string' || it.description.trim() === '') {
      throw new ValidationError('Postavka računa nima opisa')
    }
    if (typeof it.quantity !== 'number' || !Number.isFinite(it.quantity) || it.quantity <= 0) {
      throw new ValidationError('Količina mora biti pozitivna')
    }
    if (typeof it.unit_price !== 'number' || !Number.isFinite(it.unit_price) || it.unit_price < 0) {
      throw new ValidationError('Cena ne sme biti negativna')
    }
    if (typeof it.vat_rate !== 'number' || !Number.isFinite(it.vat_rate) || it.vat_rate < 0) {
      throw new ValidationError('Neveljavna stopnja DDV')
    }
  }
  return value as InvoiceItemInput[]
}
