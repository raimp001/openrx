import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { CommitmentPilotError } from "@/lib/commitments/errors"

function encryptionKey(): Buffer {
  const configured = process.env.COMMITMENT_DATA_ENCRYPTION_KEY?.trim()
  if (configured) {
    const key = Buffer.from(configured, "base64")
    if (key.length === 32) return key
    throw new CommitmentPilotError(
      "external_service_unavailable",
      "Commitment encryption key must be 32 bytes encoded as base64.",
      503,
    )
  }
  if (process.env.NODE_ENV !== "production") {
    return createHash("sha256").update("openrx-local-commitment-encryption-only").digest()
  }
  throw new CommitmentPilotError(
    "external_service_unavailable",
    "Commitment data encryption is not configured.",
    503,
  )
}

export function encryptCommitmentValue(value: string, context: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  cipher.setAAD(Buffer.from(context))
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".")
}

export function decryptCommitmentValue(value: string, context: string): string {
  const [version, iv, tag, ciphertext, extra] = value.split(".")
  if (version !== "v1" || !iv || !tag || !ciphertext || extra) {
    throw new CommitmentPilotError("verification_failed", "Encrypted commitment data is invalid.", 500)
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(iv, "base64url"),
    )
    decipher.setAAD(Buffer.from(context))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    throw new CommitmentPilotError("verification_failed", "Encrypted commitment data could not be authenticated.", 500)
  }
}
