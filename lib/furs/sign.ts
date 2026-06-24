import { create } from 'xmlbuilder2'
import forge from 'node-forge'
import { v4 as uuidv4 } from 'uuid'

interface SignXmlInput {
  taxNumber: string
  businessPremiseId: string
  electronicDeviceId: string
  invoiceNumber: string
  invoiceDate: string // ISO 8601
  invoiceAmount: number
  paymentAmount: number
  taxPercent: number
  taxAmount: number
  zoi: string
  certificateData: string // base64 .p12
  certificatePassword: string
}

export function buildAndSignFursXml(input: SignXmlInput): string {
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
    certificateData,
    certificatePassword,
  } = input

  // Load certificate for signing
  const p12Der = forge.util.decode64(certificateData)
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, certificatePassword)

  // Extract private key
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
  if (!keyBag?.key) throw new Error('Private key not found in certificate')
  const privateKey = keyBag.key as forge.pki.rsa.PrivateKey

  // Extract certificate
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const certBag = certBags[forge.pki.oids.certBag]?.[0]
  if (!certBag?.cert) throw new Error('Certificate not found in .p12')
  const cert = certBag.cert
  const certPem = forge.pki.certificateToPem(cert)
  const certBase64 = certPem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s/g, '')

  const messageId = uuidv4()
  const now = new Date().toISOString()
  const amountFormatted = invoiceAmount.toFixed(2)
  const paymentFormatted = paymentAmount.toFixed(2)
  const taxAmountFormatted = taxAmount.toFixed(2)

  // Build FURS XML envelope
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('soapenv:Envelope', {
      'xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
      'xmlns:fu': 'http://www.fu.gov.si/davki/',
      'xmlns:wsse': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
      'xmlns:wsu': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd',
      'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
    })
    .ele('soapenv:Header')
      .ele('wsse:Security', { 'soapenv:mustUnderstand': '1' })
        .ele('wsse:BinarySecurityToken', {
          'ValueType': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3',
          'EncodingType': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary',
          'wsu:Id': 'X509Token',
        }).txt(certBase64).up()
      .up()
    .up()
    .ele('soapenv:Body')
      .ele('fu:InvoiceRequest')
        .ele('fu:Header')
          .ele('fu:MessageID').txt(messageId).up()
          .ele('fu:DateTime').txt(now).up()
        .up()
        .ele('fu:Invoice')
          .ele('fu:TaxNumber').txt(taxNumber).up()
          .ele('fu:IssueDateTime').txt(invoiceDate).up()
          .ele('fu:NumberingStructure').txt('C').up()
          .ele('fu:InvoiceIdentifier')
            .ele('fu:BusinessPremiseID').txt(businessPremiseId).up()
            .ele('fu:ElectronicDeviceID').txt(electronicDeviceId).up()
            .ele('fu:InvoiceNumber').txt(invoiceNumber).up()
          .up()
          .ele('fu:InvoiceAmount').txt(amountFormatted).up()
          .ele('fu:PaymentAmount').txt(paymentFormatted).up()
          .ele('fu:TaxesPerSeller')
            .ele('fu:Taxes')
              .ele('fu:VAT')
                .ele('fu:TaxRate').txt(taxPercent.toFixed(2)).up()
                .ele('fu:TaxableAmount').txt((invoiceAmount - taxAmount).toFixed(2)).up()
                .ele('fu:TaxAmount').txt(taxAmountFormatted).up()
              .up()
            .up()
          .up()
          .ele('fu:ProtectedID').txt(zoi).up()
          .ele('fu:OperatorTaxNumber').txt(taxNumber).up()
        .up()
      .up()
    .up()
  .up()

  const xmlString = doc.end({ prettyPrint: false })

  // Sign the Body element with RSA-SHA256
  const bodyContent = xmlString.match(/<soapenv:Body>([\s\S]*?)<\/soapenv:Body>/)?.[1] || ''
  const md = forge.md.sha256.create()
  md.update(forge.util.encodeUtf8(bodyContent))
  const signature = forge.util.encode64(privateKey.sign(md))

  // Inject signature into Security header
  const signedXml = xmlString.replace(
    '</wsse:BinarySecurityToken>',
    `</wsse:BinarySecurityToken>
        <ds:Signature>
          <ds:SignedInfo>
            <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
            <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
            <ds:Reference URI="#Body">
              <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
              <ds:DigestValue>${signature}</ds:DigestValue>
            </ds:Reference>
          </ds:SignedInfo>
          <ds:SignatureValue>${signature}</ds:SignatureValue>
          <ds:KeyInfo>
            <wsse:SecurityTokenReference>
              <wsse:Reference URI="#X509Token"/>
            </wsse:SecurityTokenReference>
          </ds:KeyInfo>
        </ds:Signature>`
  )

  return signedXml
}
