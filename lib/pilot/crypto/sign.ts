/**
 * Ed25519 signing for private completion credentials.
 * The issuer signs the credential payload; patients verify using the public key
 * published in the trusted-issuer registry.
 */
import crypto from 'node:crypto'

export interface CredentialPayload {
  credentialId: string       // random, no PHI
  commitmentId: string       // random, no PHI
  status: 'completed'
  issuerOrgId: string
  credentialVersion: string
  issuedAt: string           // ISO 8601
  expiresAt: string          // ISO 8601
  revoked: false
}

/** Sign a credential payload. Returns base64url signature. */
export function signCredential(payload: CredentialPayload): string {
  const privateKeyPem = process.env.PILOT_CREDENTIAL_SIGNING_PRIVATE_KEY
  if (!privateKeyPem) throw new Error('PILOT_CREDENTIAL_SIGNING_PRIVATE_KEY not set')
  const data = Buffer.from(JSON.stringify(payload), 'utf8')
  const signature = crypto.sign(null, data, {
    key: privateKeyPem,
    format: 'pem',
  })
  return signature.toString('base64url')
}

/** Verify a credential signature using the issuer's public key. */
export function verifyCredentialSignature(
  payload: CredentialPayload,
  signature: string,
  publicKeyPem: string,
): boolean {
  try {
    const data = Buffer.from(JSON.stringify(payload), 'utf8')
    const sig = Buffer.from(signature, 'base64url')
    return crypto.verify(null, data, { key: publicKeyPem, format: 'pem' }, sig)
  } catch {
    return false
  }
}

/**
 * Verify an incoming provider/lab completion webhook HMAC signature.
 * Providers sign payloads with HMAC-SHA256 using a shared secret.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const actualBuf   = Buffer.from(signature.replace(/^sha256=/, ''), 'hex')
    if (expectedBuf.length !== actualBuf.length) return false
    return crypto.timingSafeEqual(expectedBuf, actualBuf)
  } catch {
    return false
  }
}
