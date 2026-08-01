/**
 * AES-256-GCM encryption for sensitive pilot data stored in the database.
 * Used for: wallet binding IDs, wallet addresses.
 * NEVER encrypt PHI here — PHI must not enter the pilot tables at all.
 */
import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // bytes
const IV_LENGTH = 12  // bytes (96-bit recommended for GCM)
const TAG_LENGTH = 16 // bytes

function getEncryptionKey(): Buffer {
  const key = process.env.PILOT_ENCRYPTION_KEY
  if (!key) throw new Error('PILOT_ENCRYPTION_KEY is not set')
  const buf = Buffer.from(key, 'hex')
  if (buf.length !== KEY_LENGTH) {
    throw new Error(`PILOT_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters`)
  }
  return buf
}

/** Encrypts plaintext to a base64 string: iv:tag:ciphertext */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/** Decrypts a base64 string produced by encrypt(). */
export function decrypt(encoded: string): string {
  const key = getEncryptionKey()
  const parts = encoded.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted format')
  const [ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(tag)
  return decipher.update(data) + decipher.final('utf8')
}
