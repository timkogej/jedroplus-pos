import https from 'https'
import { buildAndSignFursXml } from './sign'
import { calculateZoi, formatDateForZoi } from './zoi'
import type { FursRequest, FursResponse } from '@/types'

export async function confirmInvoiceWithFurs(request: FursRequest): Promise<FursResponse> {
  const {
    taxNumber,
    businessPremiseId,
    electronicDeviceId,
    invoiceNumber,
    invoiceDate,
    invoiceAmount,
    paymentAmount,
    taxPercent,
    taxAmount,
    zoi,
    certificate,
    environment,
  } = request

  const endpoint =
    environment === 'production'
      ? process.env.FURS_PRODUCTION_URL!
      : process.env.FURS_TEST_URL!

  const signedXml = buildAndSignFursXml({
    taxNumber,
    businessPremiseId,
    electronicDeviceId,
    invoiceNumber,
    invoiceDate,
    invoiceAmount,
    paymentAmount,
    taxPercent,
    taxAmount,
    zoi,
    certificateData: certificate.data,
    certificatePassword: certificate.password,
  })

  try {
    const responseXml = await postXmlToFurs(endpoint, signedXml, certificate)
    const eor = extractEorFromResponse(responseXml)
    return { eor, error: null, rawResponse: responseXml }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown FURS error'
    return { eor: null, error: message, rawResponse: null }
  }
}

function postXmlToFurs(
  url: string,
  xmlBody: string,
  certificate: { data: string; password: string }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const pfxBuffer = Buffer.from(certificate.data, 'base64')

    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port ? parseInt(urlObj.port) : 9003,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '""',
        'Content-Length': Buffer.byteLength(xmlBody, 'utf8'),
      },
      pfx: pfxBuffer,
      passphrase: certificate.password,
      rejectUnauthorized: false, // FURS uses self-signed certs in test
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data)
        } else {
          reject(new Error(`FURS returned status ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('FURS request timeout'))
    })

    req.write(xmlBody, 'utf8')
    req.end()
  })
}

function extractEorFromResponse(xml: string): string {
  const match = xml.match(/<[^>]*:?UniqueInvoiceID[^>]*>([^<]+)</)
    ?? xml.match(/<fu:UniqueInvoiceID>([^<]+)</)
    ?? xml.match(/UniqueInvoiceID[^>]*>([^<]+)</)
  if (!match) throw new Error('EOR not found in FURS response')
  return match[1].trim()
}

export function generateZoiForInvoice(params: {
  taxNumber: string
  issueDate: Date
  invoiceNumber: string
  businessPremiseId: string
  electronicDeviceId: string
  invoiceAmount: number
  certificateData: string
  certificatePassword: string
}): string {
  return calculateZoi({
    taxNumber: params.taxNumber,
    issueDateTime: formatDateForZoi(params.issueDate),
    invoiceNumber: params.invoiceNumber,
    businessPremiseId: params.businessPremiseId,
    electronicDeviceId: params.electronicDeviceId,
    invoiceAmount: params.invoiceAmount.toFixed(2),
    certificateData: params.certificateData,
    certificatePassword: params.certificatePassword,
  })
}
