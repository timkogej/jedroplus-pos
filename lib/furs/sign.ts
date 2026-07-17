import forge from 'node-forge'
import { SignedXml } from 'xml-crypto'
import { parseP12 } from './certificate'

/**
 * FURS XML signing (tech doc v3.1): the fu:*Request element carries Id="data"
 * and an enveloped ds:Signature is appended inside it — Reference URI="#data",
 * enveloped-signature transform, inclusive C14N, RSA-SHA256. This mirrors the
 * signature FURS puts on its own responses. (Not WS-Security — a wsse header
 * fails the fu schema with S001.)
 */

const C14N_ALG = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
const ENVELOPED_ALG = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
const RSA_SHA256_ALG = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
const SHA256_ALG = 'http://www.w3.org/2001/04/xmlenc#sha256'

/** Spec entry point: load key + cert straight from a .p12 buffer and sign. */
export function signXml(xmlString: string, p12Buffer: Buffer, p12Password: string): string {
  const cert = parseP12(p12Buffer.toString('base64'), p12Password)
  return signXmlWithPems(xmlString, cert.privateKeyPem, cert.certificatePem)
}

/** "CN=X, OU=Y, O=Z, C=SI" — most-specific first, like FURS's own responses. */
function dnString(attrs: forge.pki.CertificateField[]): string {
  return [...attrs]
    .reverse()
    .map((a) => `${a.shortName ?? a.name ?? a.type}=${a.value}`)
    .join(', ')
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function signXmlWithPems(
  xmlString: string,
  privateKeyPem: string,
  certificatePem: string
): string {
  const cert = forge.pki.certificateFromPem(certificatePem)
  const certBase64 = certificatePem
    .replace(/-----(BEGIN|END) CERTIFICATE-----/g, '')
    .replace(/\s/g, '')
  const serialDecimal = BigInt('0x' + cert.serialNumber).toString(10)

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
    signatureAlgorithm: RSA_SHA256_ALG,
    canonicalizationAlgorithm: C14N_ALG,
  })

  sig.addReference({
    xpath: "//*[@Id='data']",
    transforms: [ENVELOPED_ALG, C14N_ALG],
    digestAlgorithm: SHA256_ALG,
  })

  sig.getKeyInfoContent = () =>
    '<X509Data>' +
      `<X509SubjectName>${escapeXml(dnString(cert.subject.attributes))}</X509SubjectName>` +
      '<X509IssuerSerial>' +
        `<X509IssuerName>${escapeXml(dnString(cert.issuer.attributes))}</X509IssuerName>` +
        `<X509SerialNumber>${serialDecimal}</X509SerialNumber>` +
      '</X509IssuerSerial>' +
      `<X509Certificate>${certBase64}</X509Certificate>` +
    '</X509Data>'

  sig.computeSignature(xmlString, {
    location: { reference: "//*[@Id='data']", action: 'append' },
  })

  return sig.getSignedXml()
}
