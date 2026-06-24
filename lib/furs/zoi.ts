import forge from 'node-forge'

interface ZoiInput {
  taxNumber: string
  issueDateTime: string // format: dd.MM.yyyy HH:mm:ss
  invoiceNumber: string
  businessPremiseId: string
  electronicDeviceId: string
  invoiceAmount: string // formatted to 2 decimal places
  certificateData: string // base64 .p12
  certificatePassword: string
}

export function calculateZoi(input: ZoiInput): string {
  const {
    taxNumber,
    issueDateTime,
    invoiceNumber,
    businessPremiseId,
    electronicDeviceId,
    invoiceAmount,
    certificateData,
    certificatePassword,
  } = input

  // Concatenate the data string
  const dataString =
    taxNumber +
    issueDateTime +
    invoiceNumber +
    businessPremiseId +
    electronicDeviceId +
    invoiceAmount

  // Load .p12 certificate
  const p12Der = forge.util.decode64(certificateData)
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, certificatePassword)

  // Extract private key
  const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const keyBags = bags[forge.pki.oids.pkcs8ShroudedKeyBag]
  if (!keyBags || keyBags.length === 0) {
    throw new Error('No private key found in certificate')
  }
  const privateKey = keyBags[0].key as forge.pki.rsa.PrivateKey

  // Sign with RSA-SHA256
  const md = forge.md.sha256.create()
  md.update(dataString, 'utf8')
  const signature = privateKey.sign(md)

  // MD5 of the signature bytes to get ZOI
  const md5 = forge.md.md5.create()
  md5.update(signature, 'raw')
  return md5.digest().toHex()
}

export function formatDateForZoi(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  const HH = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${dd}.${MM}.${yyyy} ${HH}:${mm}:${ss}`
}
