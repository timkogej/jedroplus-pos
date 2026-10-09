import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
// Key derivation is unchanged (pad/truncate to 32 bytes) so certificates already
// stored in the database keep decrypting. What changed: there is NO built-in
// fallback key in production any more — the repo is on GitHub, so a hardcoded key
// would make every stored certificate decryptable by anyone. Without the env var
// the app refuses to encrypt/decrypt instead of silently using a public key.
const DEV_FALLBACK_KEY = 'fallback_key_32chars_minimum!!!'

function getKey(): Buffer {
  const configured = process.env.CERTIFICATE_ENCRYPTION_KEY
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CERTIFICATE_ENCRYPTION_KEY ni nastavljen')
    }
    return Buffer.from(DEV_FALLBACK_KEY.padEnd(32, '0').slice(0, 32), 'utf8')
  }
  if (configured.length < 32) {
    console.warn('[crypto] CERTIFICATE_ENCRYPTION_KEY je krajši od 32 znakov — uporabite naključen niz (openssl rand -hex 16)')
  }
  return Buffer.from(configured.padEnd(32, '0').slice(0, 32), 'utf8')
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, 16)
  const tag = buf.subarray(16, 32)
  const encrypted = buf.subarray(32)
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
