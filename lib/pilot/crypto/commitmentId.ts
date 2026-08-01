/**
 * Generate a cryptographically random 256-bit commitment ID.
 * This is the ONLY identifier stored onchain. It has no relationship
 * to any patient identifier, screening name, or health data.
 */
import crypto from 'node:crypto'

/** Returns a 0x-prefixed hex string suitable for bytes32 in Solidity. */
export function generateCommitmentId(): string {
  const bytes = crypto.randomBytes(32)
  return '0x' + bytes.toString('hex')
}

/** Converts a hex commitment ID to a Uint8Array for contract calls. */
export function commitmentIdToBytes(id: string): Uint8Array {
  const hex = id.startsWith('0x') ? id.slice(2) : id
  return Buffer.from(hex, 'hex')
}

/** Generates a high-entropy opaque session ID for Coinbase Onramp metadata. */
export function generateFundingSessionId(): string {
  return crypto.randomUUID()
}

/** Generates a high-entropy wallet binding ID (not a wallet address). */
export function generateWalletBindingId(): string {
  return 'wb_' + crypto.randomBytes(24).toString('hex')
}

/** Generates a random credential ID for private attestations. */
export function generateCredentialId(): string {
  return 'cred_' + crypto.randomBytes(24).toString('hex')
}

/** Generates a time-limited share token for credential sharing. */
export function generateShareToken(): string {
  return 'share_' + crypto.randomBytes(32).toString('hex')
}
