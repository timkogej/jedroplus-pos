import forge from 'node-forge'
import { parseP12 } from './certificate'

/**
 * WS-Security XML signing for the FURS SOAP envelope.
 *
 * The digest is SHA-256 over the soapenv:Body element exactly as serialized by
 * xml.ts (xmlbuilder2, no pretty-print, UTF-8). Because we control the
 * serialization, the bytes are already in canonical form — a full exclusive
 * C14N pass would be a no-op, so we sign the serialized bytes directly.
 * SignedInfo is then signed with RSA-SHA256.
 */

const DS_NS = 'http://www.w3.org/2000/09/xmldsig#'
const C14N_ALG = 'http://www.w3.org/2001/10/xml-exc-c14n#'
const RSA_SHA256_ALG = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
const SHA256_ALG = 'http://www.w3.org/2001/04/xmlenc#sha256'
const X509_TOKEN_PROFILE =
  'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3'
const BASE64_ENCODING =
  'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary'

/** Spec entry point: load key + cert straight from a .p12 buffer and sign. */
export function signXml(xmlString: string, p12Buffer: Buffer, p12Password: string): string {
  const cert = parseP12(p12Buffer.toString('base64'), p12Password)
  return signXmlWithPems(xmlString, cert.privateKeyPem, cert.certificatePem)
}

export function signXmlWithPems(
  xmlString: string,
  privateKeyPem: string,
  certificatePem: string
): string {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem) as forge.pki.rsa.PrivateKey

  const certBase64 = certificatePem
    .replace(/-----(BEGIN|END) CERTIFICATE-----/g, '')
    .replace(/\s/g, '')

  // Digest of the Body element (wsu:Id="Body") as serialized.
  const bodyMatch = xmlString.match(/<soapenv:Body[\s\S]*?<\/soapenv:Body>/)
  if (!bodyMatch) throw new Error('soapenv:Body not found in XML')
  const digest = forge.md.sha256.create()
  digest.update(forge.util.encodeUtf8(bodyMatch[0]))
  const digestValue = forge.util.encode64(digest.digest().getBytes())

  const signedInfo =
    `<ds:SignedInfo xmlns:ds="${DS_NS}">` +
      `<ds:CanonicalizationMethod Algorithm="${C14N_ALG}"/>` +
      `<ds:SignatureMethod Algorithm="${RSA_SHA256_ALG}"/>` +
      `<ds:Reference URI="#Body">` +
        `<ds:Transforms><ds:Transform Algorithm="${C14N_ALG}"/></ds:Transforms>` +
        `<ds:DigestMethod Algorithm="${SHA256_ALG}"/>` +
        `<ds:DigestValue>${digestValue}</ds:DigestValue>` +
      `</ds:Reference>` +
    `</ds:SignedInfo>`

  const signatureMd = forge.md.sha256.create()
  signatureMd.update(forge.util.encodeUtf8(signedInfo))
  const signatureValue = forge.util.encode64(privateKey.sign(signatureMd))

  const securityContent =
    `<wsse:BinarySecurityToken ValueType="${X509_TOKEN_PROFILE}" ` +
      `EncodingType="${BASE64_ENCODING}" wsu:Id="X509Token">${certBase64}</wsse:BinarySecurityToken>` +
    `<ds:Signature xmlns:ds="${DS_NS}">` +
      signedInfo +
      `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>` +
      `<ds:KeyInfo>` +
        `<wsse:SecurityTokenReference>` +
          `<wsse:Reference URI="#X509Token" ValueType="${X509_TOKEN_PROFILE}"/>` +
        `</wsse:SecurityTokenReference>` +
      `</ds:KeyInfo>` +
    `</ds:Signature>`

  // The empty Security header may serialize as self-closing or as an open/close pair.
  if (/<wsse:Security[^>]*\/>/.test(xmlString)) {
    return xmlString.replace(
      /<wsse:Security([^>]*)\/>/,
      `<wsse:Security$1>${securityContent}</wsse:Security>`
    )
  }
  const openTag = xmlString.match(/<wsse:Security[^>]*>/)
  if (!openTag) throw new Error('wsse:Security header not found in XML')
  return xmlString.replace(openTag[0], `${openTag[0]}${securityContent}`)
}
