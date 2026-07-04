import https from 'https'
import { createServiceClient } from '@/lib/supabase'
import { loadCertificate, validateCertificate, type CertificateInfo } from './certificate'
import { calculateZoi, buildZoiInput } from './zoi'
import { buildInvoiceRequestXml } from './xml'
import { signXmlWithPems } from './sign'
import { FursError, type FursEnvironment, type FursInvoiceRequest, type FursResponse } from './types'

const REQUEST_TIMEOUT_MS = 30000

function fursUrl(environment: FursEnvironment): string {
  const url =
    environment === 'production' ? process.env.FURS_PRODUCTION_URL : process.env.FURS_TEST_URL
  if (!url) {
    throw new FursError('CONFIG', `FURS URL za okolje "${environment}" ni nastavljen`)
  }
  return url
}

/** Loads the company's active certificate, or null when none is uploaded. */
export async function getActiveCertificate(companyId: string): Promise<CertificateInfo | null> {
  const supabase = createServiceClient()
  const { data: certRow } = await supabase
    .from('pos_certificates')
    .select('certificate_data, certificate_password')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle()

  if (!certRow) return null
  return loadCertificate(certRow.certificate_data, certRow.certificate_password)
}

export async function getFursEnvironment(companyId: string): Promise<FursEnvironment> {
  const supabase = createServiceClient()
  const { data: settings } = await supabase
    .from('pos_settings')
    .select('furs_environment')
    .eq('company_id', companyId)
    .maybeSingle()
  return (settings?.furs_environment ?? 'test') as FursEnvironment
}

/**
 * Full fiscalization pipeline: certificate → ZOI → XML → signature → FURS →
 * EOR. Throws FursError on any failure; when the ZOI was already calculated
 * it rides along on the error so the caller can issue the invoice offline.
 */
export async function confirmInvoiceWithFurs(
  request: FursInvoiceRequest,
  companyId: string
): Promise<FursResponse> {
  const cert = await getActiveCertificate(companyId)
  if (!cert) throw new FursError('NO_CERTIFICATE', 'Certifikat ni naložen')

  try {
    validateCertificate(cert)
  } catch (err) {
    throw new FursError('CERT_INVALID', err instanceof Error ? err.message : 'Neveljaven certifikat')
  }

  const taxNumber = request.taxNumber || cert.taxNumber
  const fullRequest: FursInvoiceRequest = { ...request, taxNumber }

  const zoi = calculateZoi(buildZoiInput(fullRequest), cert.privateKeyPem)

  try {
    const { xml, messageId } = buildInvoiceRequestXml(fullRequest, zoi)
    const signedXml = signXmlWithPems(xml, cert.privateKeyPem, cert.certificatePem)

    const environment = await getFursEnvironment(companyId)
    const endpoint = fursUrl(environment)

    console.log(`[furs] → ${environment} invoice=${fullRequest.invoiceNumber} msg=${messageId}`)
    const responseXml = await postXmlToFurs(endpoint, signedXml, cert)
    console.log(`[furs] ← invoice=${fullRequest.invoiceNumber} response=${responseXml.slice(0, 2000)}`)

    const eor = parseFursResponse(responseXml)
    return { eor, zoi, confirmedAt: new Date().toISOString() }
  } catch (err) {
    if (err instanceof FursError) {
      err.zoi = err.zoi ?? zoi
      console.error(`[furs] napaka invoice=${fullRequest.invoiceNumber}:`, err.code, err.message)
      throw err
    }
    const message = err instanceof Error ? err.message : 'Neznana napaka FURS'
    console.error(`[furs] napaka invoice=${fullRequest.invoiceNumber}:`, message)
    throw new FursError('UNAVAILABLE', message, zoi)
  }
}

function postXmlToFurs(url: string, xmlBody: string, cert: CertificateInfo): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)

    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port ? parseInt(urlObj.port) : 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '""',
        'Content-Length': Buffer.byteLength(xmlBody, 'utf8'),
      },
      // FURS authenticates the client via mutual TLS with the same certificate.
      pfx: Buffer.from(cert.p12Base64, 'base64'),
      passphrase: cert.p12Password,
      rejectUnauthorized: false, // FURS test env uses its own CA
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data)
        } else {
          reject(new FursError('HTTP_' + res.statusCode, `FURS status ${res.statusCode}: ${data.slice(0, 500)}`))
        }
      })
    })

    req.on('error', (err) => reject(new FursError('NETWORK', err.message)))
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy()
      reject(new FursError('TIMEOUT', 'FURS ni odgovoril v 30 sekundah'))
    })

    req.write(xmlBody, 'utf8')
    req.end()
  })
}

/** Extracts the EOR (fu:UniqueInvoiceID) from a FURS response, or throws FursError. */
export function parseFursResponse(xml: string): string {
  const errorCode = xml.match(/<[^>]*ErrorCode[^>]*>([^<]+)</)?.[1]?.trim()
  const errorMessage = xml.match(/<[^>]*ErrorMessage[^>]*>([^<]+)</)?.[1]?.trim()
  if (errorCode || errorMessage) {
    throw new FursError(errorCode ?? 'FURS_ERROR', errorMessage ?? 'FURS je zavrnil račun')
  }

  const eor = xml.match(/<[^>]*UniqueInvoiceID[^>]*>([^<]+)</)?.[1]?.trim()
  if (!eor) throw new FursError('NO_EOR', 'EOR ni najden v odgovoru FURS')
  return eor
}

/** Reachability probe for the status indicator — not an API call, just TCP/TLS. */
export async function checkFursConnection(environment: string): Promise<boolean> {
  try {
    const urlObj = new URL(fursUrl(environment as FursEnvironment))
    return await new Promise<boolean>((resolve) => {
      const req = https.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port ? parseInt(urlObj.port) : 443,
          path: urlObj.pathname,
          method: 'HEAD',
          rejectUnauthorized: false,
        },
        () => resolve(true)
      )
      req.on('error', () => resolve(false))
      req.setTimeout(5000, () => {
        req.destroy()
        resolve(false)
      })
      req.end()
    })
  } catch {
    return false
  }
}
