import { createServiceClient } from '@/lib/supabase'

export interface InvoiceFormatConfig {
  format: string
  prefix: string
  separator: string
  numberLength: number
  yearFormat: 'full' | 'short'
}

const DEFAULT_CONFIG: InvoiceFormatConfig = {
  format: 'PREFIX-LETO4-PROSTOR-NAPRAVA-STEVILKA',
  prefix: 'R',
  separator: '-',
  numberLength: 5,
  yearFormat: 'full',
}

function assembleNumber(
  config: InvoiceFormatConfig,
  counter: number,
  premiseId: string,
  deviceId: string,
  year: number,
): string {
  const y4 = String(year)
  const y2 = y4.slice(-2)
  const yr = config.yearFormat === 'short' ? y2 : y4
  const n = String(counter).padStart(config.numberLength, '0')
  const p = config.prefix || 'R'
  const sep = config.separator

  switch (config.format) {
    case 'PREFIX-LETO4-STEVILKA':
    case 'PREFIX-LETO2-STEVILKA':
      return `${p}${sep}${yr}${sep}${n}`
    case 'LETO4-PREFIX-STEVILKA':
      return `${yr}${sep}${p}${sep}${n}`
    case 'PREFIX-LETO4-PROSTOR-NAPRAVA-STEVILKA':
      return `${p}${sep}${yr}${sep}${premiseId || 'P'}${sep}${deviceId || 'D'}${sep}${n}`
    case 'PREFIX-STEVILKA-LETO4':
      return `${p}${sep}${n}${sep}${yr}`
    case 'STEVILKA-SLASH-LETO4':
      return `${n}/${yr}`
    case 'PREFIX-STEVILKA':
      return `${p}${n}`
    default:
      // Fallback matches the old hardcoded format so existing invoices aren't affected
      return `${p}${sep}${yr}${sep}${premiseId || 'P'}${sep}${deviceId || 'D'}${sep}${n}`
  }
}

export async function generateInvoiceNumber(
  companyId: string,
  config: InvoiceFormatConfig = DEFAULT_CONFIG,
  premiseId: string,
  deviceId: string,
): Promise<{ invoiceNumber: string; counter: number }> {
  const supabase = createServiceClient()
  const currentYear = new Date().getFullYear()

  const { data, error } = await supabase.rpc('increment_invoice_counter', {
    p_company_id: companyId,
    p_year: currentYear,
  })

  if (error) throw new Error(`Failed to generate invoice number: ${error.message}`)

  const counter = data as number
  const invoiceNumber = assembleNumber(config, counter, premiseId, deviceId, currentYear)

  return { invoiceNumber, counter }
}
