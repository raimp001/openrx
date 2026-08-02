import { createHmac, timingSafeEqual } from "node:crypto"
import { CommitmentPilotError } from "@/lib/commitments/errors"

interface CoinbaseSignatureParts {
  timestamp: number
  v0: string
}

function parseSignature(value: string): CoinbaseSignatureParts {
  const entries = new Map(
    value
      .split(",")
      .map((part) => part.trim().split("=", 2))
      .filter((part): part is [string, string] => part.length === 2),
  )
  const timestamp = Number(entries.get("t"))
  const v0 = entries.get("v0") || ""
  if (!Number.isFinite(timestamp) || !/^[a-f0-9]{64}$/i.test(v0)) {
    throw new CommitmentPilotError("verification_failed", "Coinbase webhook signature is invalid.", 401)
  }
  return { timestamp, v0 }
}

export function verifyCoinbaseWebhook(input: {
  rawBody: string
  signatureHeader: string
  secret?: string
  nowSeconds?: number
}): void {
  const secret = input.secret?.trim()
  if (!secret) {
    throw new CommitmentPilotError(
      "external_service_unavailable",
      "Coinbase webhook verification is not configured.",
      503,
    )
  }
  const parts = parseSignature(input.signatureHeader)
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1_000)
  if (Math.abs(now - parts.timestamp) > 300) {
    throw new CommitmentPilotError("replay", "Coinbase webhook timestamp is outside the allowed window.", 401)
  }
  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${parts.timestamp}.${input.rawBody}`).digest("hex"),
  )
  const supplied = Buffer.from(parts.v0)
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new CommitmentPilotError("verification_failed", "Coinbase webhook signature is invalid.", 401)
  }
}
