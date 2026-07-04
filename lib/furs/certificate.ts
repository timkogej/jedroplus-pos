import forge from 'node-forge'
import { decrypt } from '@/lib/crypto'

const EXPIRY_WARNING_DAYS = 30

export interface CertificateInfo {
  privateKeyPem: string
  certificatePem: string
  /** Raw .p12 as base64 — needed for the TLS client certificate (pfx). */
  p12Base64: string
  p12Password: string
  taxNumber: string
  validFrom: Date
  validTo: Date
  isExpired: boolean
  isExpiringSoon: boolean // within 30 days
}

/**
 * Decrypts (AES-256-GCM, lib/crypto) and parses a stored .p12 certificate.
 * Never expose the returned data to the client — server-side use only.
 */
export async function loadCertificate(
  encryptedP12Base64: string,
  encryptedPassword: string
): Promise<CertificateInfo> {
  const p12Base64 = decrypt(encryptedP12Base64)
  const password = decrypt(encryptedPassword)
  return parseP12(p12Base64, password)
}

/** Parses a plaintext base64 .p12 + password into CertificateInfo. */
export function parseP12(p12Base64: string, password: string): CertificateInfo {
  const p12Der = forge.util.decode64(p12Base64)
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password)

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
  if (!keyBag?.key) throw new Error('V certifikatu ni zasebnega ključa')
  const privateKey = keyBag.key as forge.pki.rsa.PrivateKey

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const certBag = certBags[forge.pki.oids.certBag]?.[0]
  if (!certBag?.cert) throw new Error('V .p12 datoteki ni certifikata')
  const cert = certBag.cert

  const now = Date.now()
  const validTo = cert.validity.notAfter

  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certificatePem: forge.pki.certificateToPem(cert),
    p12Base64,
    p12Password: password,
    taxNumber: extractTaxNumber(cert),
    validFrom: cert.validity.notBefore,
    validTo,
    isExpired: validTo.getTime() < now,
    isExpiringSoon:
      validTo.getTime() >= now &&
      validTo.getTime() - now < EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000,
  }
}

/**
 * FURS certificates carry the tax number in the subject serialNumber
 * (or as digits in the CN as a fallback).
 */
function extractTaxNumber(cert: forge.pki.Certificate): string {
  const attrs = cert.subject.attributes
  const serialAttr = attrs.find(
    (a) => a.name === 'serialName' || a.shortName === 'SERIALNUMBER' || a.type === '2.5.4.5'
  )
  const cnAttr = attrs.find((a) => a.shortName === 'CN')
  const rawValue = String(serialAttr?.value ?? cnAttr?.value ?? '')
  return rawValue.replace(/[^0-9]/g, '')
}

export function validateCertificate(cert: CertificateInfo): void {
  if (cert.isExpired) throw new Error('Certifikat je potekel')
  if (cert.isExpiringSoon) {
    console.warn(
      `[furs] Certifikat poteče v manj kot 30 dneh (${cert.validTo.toISOString().slice(0, 10)})`
    )
  }
}
