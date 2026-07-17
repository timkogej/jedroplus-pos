// Temporary debug script: runs the real FURS echo test with the active cert.
// Usage: npx tsx scripts/furs-echo-debug.ts [testUrlOverride]
import fs from 'fs'
import path from 'path'

// Load .env.local before importing modules that read process.env
const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
}
if (process.argv[2]) process.env.FURS_TEST_URL = process.argv[2]

async function main() {
  const { createServiceClient } = await import('../lib/supabase')
  const { loadCertificate } = await import('../lib/furs/certificate')
  const { checkFursEcho } = await import('../lib/furs/api')

  const supabase = createServiceClient()
  const { data: certRow, error } = await supabase
    .from('pos_certificates')
    .select('company_id, certificate_data, certificate_password')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (error || !certRow) {
    console.error('No active certificate row found:', error)
    process.exit(1)
  }

  const cert = await loadCertificate(certRow.certificate_data, certRow.certificate_password)

  // Temporary: dump full subject/issuer details to locate the tax number field
  const forge = (await import('node-forge')).default
  const parsed = forge.pki.certificateFromPem(cert.certificatePem)
  console.log('--- certificate.serialNumber (hex):', parsed.serialNumber)
  console.log('--- subject attributes:')
  for (const a of parsed.subject.attributes) {
    console.log(JSON.stringify({ type: a.type, name: a.name, shortName: a.shortName, value: a.value }))
  }
  console.log('--- issuer attributes:')
  for (const a of parsed.issuer.attributes) {
    console.log(JSON.stringify({ type: a.type, name: a.name, shortName: a.shortName, value: a.value }))
  }
  console.log(
    `cert loaded: taxNumber=${cert.taxNumber} valid=${cert.validFrom.toISOString().slice(0, 10)}..${cert.validTo.toISOString().slice(0, 10)} caPems=${cert.caPems.length}`
  )

  const ok = await checkFursEcho('test', cert)
  console.log('ECHO RESULT:', ok)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error('fatal:', e)
  process.exit(1)
})
