import forge from 'node-forge'
import { decrypt } from '@/lib/crypto'

const EXPIRY_WARNING_DAYS = 30

export interface CertificateInfo {
  privateKeyPem: string
  certificatePem: string
  /** Intermediate/root CA certs bundled in the .p12 (e.g. SIGOV-CA, SI-TRUST Root), PEM. */
  caPems: string[]
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
  let p12Base64: string
  let password: string
  try {
    p12Base64 = decrypt(encryptedP12Base64)
    password = decrypt(encryptedPassword)
  } catch (err) {
    const isAuthTagError =
      err instanceof Error &&
      /unsupported state|unable to authenticate data/i.test(err.message)
    console.error(
      '[furs][cert] AES-256-GCM decryption failed for stored .p12/password.' +
        (isAuthTagError
          ? ' Auth-tag mismatch — CERTIFICATE_ENCRYPTION_KEY used to decrypt does not match the key used to encrypt this row (check for a changed/rotated env var between .env.local and the deploy environment), or the ciphertext in the DB is corrupted.'
          : ''),
      { keyLength: process.env.CERTIFICATE_ENCRYPTION_KEY?.length ?? 'unset (using fallback key)' },
      err
    )
    throw err
  }
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
  const allCerts = (certBags[forge.pki.oids.certBag] ?? [])
    .map((bag) => bag.cert)
    .filter((c): c is forge.pki.Certificate => Boolean(c))
  if (allCerts.length === 0) throw new Error('V .p12 datoteki ni certifikata')

  // The leaf is the cert whose public key matches the private key; any other
  // certs in the bundle (SIGOV-CA, SI-TRUST Root) form the CA chain for TLS.
  const cert =
    allCerts.find(
      (c) => (c.publicKey as forge.pki.rsa.PublicKey).n.compareTo(privateKey.n) === 0
    ) ?? allCerts[0]
  const caCerts = allCerts.filter((c) => c !== cert)

  const now = Date.now()
  const validTo = cert.validity.notAfter

  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certificatePem: forge.pki.certificateToPem(cert),
    caPems: caCerts.map((c) => forge.pki.certificateToPem(c)),
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
 * FURS purpose-issued certificates (Tax CA / Tax CA Test) carry the 8-digit
 * tax number as its own OU attribute, e.g. OU=DavPotRacTEST, OU=10685219.
 * Subject serialNumber (2.5.4.5) is just a sequence number ("1"), so it is
 * only a fallback when it actually contains an 8-digit number, then the CN.
 */
function extractTaxNumber(cert: forge.pki.Certificate): string {
  const attrs = cert.subject.attributes

  const ouTax = attrs.find(
    (a) => a.shortName === 'OU' && /^\d{8}$/.test(String(a.value))
  )
  if (ouTax) return String(ouTax.value)

  const serialAttr = attrs.find(
    (a) => a.name === 'serialNumber' || a.shortName === 'SERIALNUMBER' || a.type === '2.5.4.5'
  )
  const fromSerial = String(serialAttr?.value ?? '').match(/\d{8}/)?.[0]
  if (fromSerial) return fromSerial

  const cnAttr = attrs.find((a) => a.shortName === 'CN')
  const fromCn = String(cnAttr?.value ?? '').match(/\d{8}/)?.[0]
  if (fromCn) return fromCn

  throw new Error('Davčne številke ni mogoče prebrati iz certifikata')
}

export function validateCertificate(cert: CertificateInfo): void {
  if (cert.isExpired) throw new Error('Certifikat je potekel')
  if (cert.isExpiringSoon) {
    console.warn(
      `[furs] Certifikat poteče v manj kot 30 dneh (${cert.validTo.toISOString().slice(0, 10)})`
    )
  }
}
