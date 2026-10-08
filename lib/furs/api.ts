import https from 'https'
import { createServiceClient } from '@/lib/supabase'
import { loadCertificate, validateCertificate, type CertificateInfo } from './certificate'
import { calculateZoi, buildZoiInput } from './zoi'
import { buildInvoiceRequestXml, buildBusinessPremiseRequestXml, buildEchoRequestXml, type FursPremiseAddress, type FursCadastralData } from './xml'
import { signXmlWithPems } from './sign'
import { FursError, type FursEnvironment, type FursInvoiceRequest, type FursResponse } from './types'

/** FURS error codes documented in the ZDavPR technical spec. */
const FURS_ERROR_MESSAGES: Record<string, string> = {
  S001: 'Sporočilo ne ustreza XML shemi (S001)',
  S002: 'Sporočilo ne ustreza JSON shemi (S002)',
  S003: 'Napaka pri digitalnem podpisu - preverite certifikat (S003)',
  S004: 'Neustrezen identifikator certifikata (S004)',
  S005: 'Davčna številka ne ustreza certifikatu (S005)',
  S006: 'Poslovni prostor ni registriran pri FURS - najprej registrirajte prostor (S006)',
}

/** Tax number of the software supplier (this app), sent with BusinessPremiseRequest. */
function softwareSupplierTaxNumber(): string {
  const taxNumber = process.env.FURS_SOFTWARE_SUPPLIER_TAX_NUMBER
  if (!taxNumber) {
    throw new FursError('CONFIG', 'FURS_SOFTWARE_SUPPLIER_TAX_NUMBER ni nastavljen')
  }
  return taxNumber
}

const REQUEST_TIMEOUT_MS = 30000

/** Verbose protocol logging (signed XML, headers, raw bodies) — off by default. */
const debugLog = (...args: unknown[]) => {
  if (process.env.FURS_DEBUG === 'true') console.log(...args)
}

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

  // Log every certificate row for this company so we can tell a key-mismatch
  // apart from "wrong row is active" (e.g. stale test cert left active).
  const { data: allCertRows } = await supabase
    .from('pos_certificates')
    .select('id, company_id, created_at, is_active, tax_number')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  console.log(
    `[furs][cert] ${allCertRows?.length ?? 0} certificate row(s) for company_id=${companyId}:`,
    allCertRows?.map((r) => `id=${r.id} tax_number=${r.tax_number} is_active=${r.is_active} created_at=${r.created_at}`)
  )

  const activeRows = allCertRows?.filter((r) => r.is_active) ?? []
  if (activeRows.length > 1) {
    console.warn(
      `[furs][cert] WARNING: ${activeRows.length} active certificate rows for company_id=${companyId} — only one should be active. ids=${activeRows.map((r) => r.id).join(', ')}`
    )
  }

  const { data: certRow } = await supabase
    .from('pos_certificates')
    .select('id, company_id, created_at, certificate_data, certificate_password')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle()

  if (!certRow) return null

  console.log(
    `[furs][cert] loading certificate id=${certRow.id} company_id=${certRow.company_id} created_at=${certRow.created_at}`
  )

  try {
    return await loadCertificate(certRow.certificate_data, certRow.certificate_password)
  } catch (err) {
    const isAuthTagError =
      err instanceof Error &&
      /unsupported state|unable to authenticate data/i.test(err.message)
    console.error(
      `[furs][cert] FAILED to decrypt certificate id=${certRow.id} company_id=${certRow.company_id} created_at=${certRow.created_at}.` +
        (isAuthTagError
          ? ' This is an AES-256-GCM auth-tag failure — almost always means CERTIFICATE_ENCRYPTION_KEY does not match the key used when this row was encrypted (env changed/rotated), or the stored ciphertext is corrupted.'
          : ''),
      err
    )
    throw err
  }
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
  companyId: string,
  opts: { existingZoi?: string | null } = {}
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

  // A resubmission (retry cron) must carry the ZOI that was already printed on
  // the receipt, never a freshly computed one.
  const zoi = opts.existingZoi || calculateZoi(buildZoiInput(fullRequest), cert.privateKeyPem)

  try {
    const { xml, messageId } = buildInvoiceRequestXml(fullRequest, zoi)
    const signedXml = signXmlWithPems(xml, cert.privateKeyPem, cert.certificatePem)

    const environment = await getFursEnvironment(companyId)
    const endpoint = fursUrl(environment)

    console.log(`[furs] → ${environment} invoice=${fullRequest.invoiceNumber} msg=${messageId}`)
    debugLog(`[furs] InvoiceRequest XML: ${signedXml}`)
    const responseXml = await postXmlToFurs(endpoint, signedXml, cert, '/invoices', environment)
    debugLog(`[furs] ← invoice=${fullRequest.invoiceNumber} response=${responseXml.slice(0, 2000)}`)

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

/**
 * Registers a business premise with FURS (BusinessPremiseRequest) — required
 * once before any invoice can be issued from that premise, or InvoiceRequest
 * fails with S006. New/untested surface: verify the request structure
 * against the real WSDL/XSD before relying on it for a real premise.
 */
export async function registerBusinessPremise(
  companyId: string,
  premiseId: string,
  address?: FursPremiseAddress,
  cadastralData?: FursCadastralData
): Promise<void> {
  const cert = await getActiveCertificate(companyId)
  if (!cert) throw new FursError('NO_CERTIFICATE', 'Certifikat ni naložen')
  validateCertificate(cert)

  const xml = buildBusinessPremiseRequestXml({
    taxNumber: cert.taxNumber,
    businessPremiseId: premiseId,
    address,
    cadastralData,
    softwareSupplierTaxNumber: softwareSupplierTaxNumber(),
    validityDate: new Date().toISOString().slice(0, 10),
  })
  const signedXml = signXmlWithPems(xml.xml, cert.privateKeyPem, cert.certificatePem)

  const environment = await getFursEnvironment(companyId)
  const endpoint = fursUrl(environment)

  console.log(`[furs] → register premise=${premiseId} env=${environment}`)
  debugLog(`[furs] BusinessPremiseRequest XML: ${signedXml}`)
  const responseXml = await postXmlToFurs(endpoint, signedXml, cert, '/invoices/register', environment)
  debugLog(`[furs] ← register premise=${premiseId} response=${responseXml.slice(0, 2000)}`)

  const errorCode = responseXml.match(/<[^>]*ErrorCode[^>]*>([^<]+)</)?.[1]?.trim()
  if (errorCode) {
    const message = FURS_ERROR_MESSAGES[errorCode]
      ?? responseXml.match(/<[^>]*ErrorMessage[^>]*>([^<]+)</)?.[1]?.trim()
      ?? 'FURS je zavrnil registracijo poslovnega prostora'
    throw new FursError(errorCode, message)
  }
}

/** Connectivity check via the FURS echo endpoint — a real SOAP round-trip, not just TCP. */
export async function checkFursEcho(environment: FursEnvironment, cert: CertificateInfo): Promise<boolean> {
  try {
    const endpoint = fursUrl(environment)
    console.log(`[furs] echo test → env=${environment} url=${endpoint}`)
    const responseXml = await postXmlToFurs(endpoint, buildEchoRequestXml(), cert, '/echo', environment)
    const ok = /<[^>]*EchoResponse[^>]*>\s*test\s*</.test(responseXml)
    if (!ok) console.error(`[furs] echo: nepričakovan odgovor (ni EchoResponse=test): ${responseXml.slice(0, 1000)}`)
    return ok
  } catch (err) {
    console.error('[furs] echo test neuspešen:', err instanceof FursError ? `${err.code}: ${err.message}` : err)
    return false
  }
}

/** SOAPAction values from the FURS FiscalVerification WSDL — the server routes by this header. */
type FursSoapAction = '/echo' | '/invoices' | '/invoices/register'

function postXmlToFurs(
  url: string,
  xmlBody: string,
  cert: CertificateInfo,
  soapAction: FursSoapAction,
  environment: FursEnvironment
): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const port = urlObj.port ? parseInt(urlObj.port) : 443

    // FURS authenticates the client via mutual TLS: the cert/key from the .p12
    // must be presented during the TLS handshake itself (signing the XML body
    // is a separate, additional requirement). Node's fetch() cannot do this —
    // an https.Agent with cert/key is required.
    const agent = new https.Agent({
      cert: cert.certificatePem,
      key: cert.privateKeyPem,
      // Intermediates from the .p12 (sigov-ca / si-trust-root) so the server
      // chain can be verified where possible.
      ca: (() => {
        const extra = process.env.FURS_CA_PEM ? [process.env.FURS_CA_PEM] : []
        const all = [...cert.caPems, ...extra]
        return all.length > 0 ? all : undefined
      })(),
      minVersion: 'TLSv1.2',
      // The FURS TEST environment uses its own CA, so it stays lenient there.
      // PRODUCTION verifies the server certificate. If the SI-TRUST chain isn't
      // resolvable on the host, add it via FURS_CA_PEM rather than disabling
      // verification; FURS_TLS_INSECURE=true is a temporary escape hatch only.
      rejectUnauthorized: environment === 'production' && process.env.FURS_TLS_INSECURE !== 'true',
    })

    console.log(
      `[furs] POST ${urlObj.href} (host=${urlObj.hostname} port=${port} path=${urlObj.pathname}) ` +
      `mTLS cert=${cert.certificatePem ? 'attached' : 'MISSING'} key=${cert.privateKeyPem ? 'attached' : 'MISSING'} ca=${cert.caPems.length}`
    )

    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port,
      path: urlObj.pathname,
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `"${soapAction}"`,
        'Content-Length': Buffer.byteLength(xmlBody, 'utf8'),
      },
    }

    const req = https.request(options, (res) => {
      const socket = res.socket as import('tls').TLSSocket
      console.log(
        `[furs] TLS ok: protocol=${socket.getProtocol?.()} cipher=${socket.getCipher?.()?.name} ` +
        `serverCertAuthorized=${socket.authorized} (${socket.authorizationError ?? 'no error'})`
      )
      debugLog(`[furs] HTTP ${res.statusCode} headers=${JSON.stringify(res.headers)}`)

      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        debugLog(`[furs] body (${data.length}b): ${data.slice(0, 2000)}`)
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data)
        } else {
          reject(new FursError('HTTP_' + res.statusCode, `FURS status ${res.statusCode}: ${data.slice(0, 500)}`))
        }
      })
    })

    req.on('error', (err) => {
      const e = err as NodeJS.ErrnoException & { cause?: unknown }
      console.error(`[furs] NAPAKA pri povezavi na ${urlObj.href}`, {
        message: e.message,
        code: e.code,
        errno: e.errno,
        syscall: e.syscall,
        cause: e.cause,
        stack: e.stack,
      })
      reject(new FursError('NETWORK', `${e.code ?? 'NETWORK'}: ${e.message} (${urlObj.href})`))
    })
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      console.error(`[furs] TIMEOUT po ${REQUEST_TIMEOUT_MS}ms na ${urlObj.href}`)
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
    const message = (errorCode && FURS_ERROR_MESSAGES[errorCode]) ?? errorMessage ?? 'FURS je zavrnil račun'
    throw new FursError(errorCode ?? 'FURS_ERROR', message)
  }

  const eor = xml.match(/<[^>]*UniqueInvoiceID[^>]*>([^<]+)</)?.[1]?.trim()
  if (!eor) throw new FursError('NO_EOR', 'EOR ni najden v odgovoru FURS')
  return eor
}

