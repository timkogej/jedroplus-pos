export interface Company {
  id: string
  slug: string
  name: string
  company_id?: string
}

export interface CompanyBranding {
  id: string
  brand_primary: string | null
  brand_second: string | null
  'ID Podjetja': string
}

export interface PosSettings {
  id: string
  company_id: string
  invoice_prefix: string
  invoice_counter: number
  invoice_format: string
  invoice_separator: string
  invoice_number_length: number
  invoice_year_format: 'full' | 'short'
  invoice_year_reset: boolean
  invoice_last_year: number | null
  default_vat_rate: number
  is_vat_registered: boolean
  receipt_delivery: 'email' | 'print' | 'both' | 'ask'
  print_format: 'a4' | 'thermal' | 'ask'
  email_from: string | null
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  stripe_charges_enabled: boolean
  stripe_payouts_enabled: boolean
  online_premise_id: string | null
  online_device_id: string | null
  currency: string
  furs_environment: 'test' | 'production'
  created_at: string
  updated_at: string
}

export interface PosCertificate {
  id: string
  company_id: string
  certificate_data: string | null
  certificate_password: string | null
  tax_number: string | null
  valid_from: string | null
  valid_to: string | null
  is_active: boolean
  created_at: string
}

export interface PosPremise {
  id: string
  company_id: string
  premise_id: string
  premise_type: 'premises' | 'movable'
  address: string | null
  city: string | null
  postal_code: string | null
  is_active: boolean
  created_at: string
}

export interface PosDevice {
  id: string
  company_id: string
  premise_id: string
  device_id: string
  is_active: boolean
  created_at: string
  pos_premises?: PosPremise
}

export interface PosInvoice {
  id: string
  company_id: string
  appointment_id: string | null
  premise_id: string | null
  device_id: string | null
  invoice_number: string
  invoice_date: string
  client_id: string | null
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  client_tax_number: string | null
  subtotal: number
  discount_amount: number
  discount_type: '%' | '€' | null
  vat_rate: number
  vat_amount: number
  total: number
  payment_method: 'cash' | 'card' | 'transfer' | 'online'
  status: 'issued' | 'cancelled' | 'draft' | 'storno_original' | 'storno'
  is_storno: boolean
  storno_of: string | null
  storno_invoice_id: string | null
  zoi: string | null
  eor: string | null
  furs_confirmed_at: string | null
  furs_response: Record<string, unknown> | null
  stripe_payment_intent_id: string | null
  pdf_url: string | null
  sent_via_email: boolean
  printed: boolean
  notes: string | null
  created_at: string
  pos_invoice_items?: PosInvoiceItem[]
}

export interface PosInvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  vat_amount: number | null
  total: number
  created_at: string
}

export interface PosCompanyData {
  id: string
  company_id: string
  company_name: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  tax_number: string | null
  vat_id: string | null
  iban: string | null
  bank: string | null
  email: string | null
  phone: string | null
  website: string | null
  created_at: string
  updated_at: string
}

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid'

export interface PosSubscription {
  company_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: 'plus' | 'pro' | null
  billing_interval: 'monthly' | 'yearly' | null
  status: SubscriptionStatus | null
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  canceled_at: string | null
}

export interface Appointment {
  id: string
  'ID podjetja': string
  'Datum': string
  'Ura': string
  'Storitev': string
  'Oseba': string
  'Stranka': string
  'Cena': number
  'Final cena': number
  'Popust': number | null
  'Popust type': '%' | '€' | null
  'Status': string
  'ID računa': string | null
  'ID storitve'?: string | null
  'ID storitve 2'?: string | null
  'ID storitve 3'?: string | null
  'Valuta'?: string | null
  'ID stranke'?: string | null
  'Email stranke'?: string | null
}

export interface Client {
  id: string
  [key: string]: unknown
}

export interface InvoiceFormData {
  client_name: string
  client_email: string
  client_phone: string
  client_tax_number: string
  client_type: 'physical' | 'legal'
  client_company_name: string
  client_company_tax: string
  invoice_date: string
  payment_method: 'cash' | 'card' | 'transfer' | 'online'
  items: InvoiceItemForm[]
  discount_amount: number
  discount_type: '%' | '€' | null
  notes: string
  premise_id: string
  device_id: string
  currency: string
}

export interface InvoiceItemForm {
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
}

export interface FursRequest {
  taxNumber: string
  businessPremiseId: string
  electronicDeviceId: string
  invoiceNumber: string
  invoiceDate: string
  invoiceAmount: number
  paymentAmount: number
  taxPercent: number
  taxAmount: number
  zoi: string
  certificate: {
    data: string
    password: string
  }
  environment: 'test' | 'production'
}

export interface FursResponse {
  eor: string | null
  error: string | null
  rawResponse: string | null
}

export interface ZReport {
  id: string
  company_id: string
  premise_id: string | null
  device_id: string | null
  report_date: string // YYYY-MM-DD
  report_number: number
  opened_at: string | null
  closed_at: string | null
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
  status: string
  furs_confirmed: boolean
  furs_response: Record<string, unknown> | null
  pdf_url: string | null
  notes: string | null
  created_at: string
}
