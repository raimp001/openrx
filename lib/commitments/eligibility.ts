import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { CommitmentPilotError } from "@/lib/commitments/errors"

export interface CommitmentEligibilityRecommendation {
  recommendationId: string
  screeningLabel: string
  guidelineSource: string
  guidelineVersion: string
  engineVersion: string
  sourceUrl: string
}

interface EligibilityPayload {
  v: 1
  subjectHash: string
  recommendationDigest: string
  issuedAt: number
  expiresAt: number
  nonce: string
}

function signingSecret(): string {
  const configured = process.env.COMMITMENT_ELIGIBILITY_SIGNING_SECRET?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV !== "production") return "openrx-local-eligibility-sandbox"
  throw new CommitmentPilotError(
    "external_service_unavailable",
    "Screening eligibility proof is not configured.",
    503,
  )
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function recommendationDigest(input: CommitmentEligibilityRecommendation): string {
  return digest(
    [
      input.recommendationId,
      input.screeningLabel,
      input.guidelineSource,
      input.guidelineVersion,
      input.engineVersion,
      input.sourceUrl,
    ].join("\u001f"),
  )
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

export function createCommitmentEligibilityToken(input: {
  subjectId: string
  recommendation: CommitmentEligibilityRecommendation
  now?: Date
  ttlMinutes?: number
}): { token: string; expiresAt: string } {
  const now = input.now ?? new Date()
  const expiresAt = new Date(now.getTime() + (input.ttlMinutes ?? 15) * 60 * 1_000)
  const payload: EligibilityPayload = {
    v: 1,
    subjectHash: digest(input.subjectId),
    recommendationDigest: recommendationDigest(input.recommendation),
    issuedAt: Math.floor(now.getTime() / 1_000),
    expiresAt: Math.floor(expiresAt.getTime() / 1_000),
    nonce: randomBytes(16).toString("hex"),
  }
  const encoded = encode(payload)
  const signature = createHmac("sha256", signingSecret()).update(encoded).digest("base64url")
  return { token: `${encoded}.${signature}`, expiresAt: expiresAt.toISOString() }
}

export function verifyCommitmentEligibilityToken(input: {
  token: string
  subjectId: string
  recommendation: CommitmentEligibilityRecommendation
  now?: Date
}): void {
  const [encoded, suppliedSignature, extra] = input.token.split(".")
  if (!encoded || !suppliedSignature || extra) {
    throw new CommitmentPilotError("verification_failed", "Screening eligibility proof is invalid.", 403)
  }
  const expectedSignature = createHmac("sha256", signingSecret()).update(encoded).digest("base64url")
  const expected = Buffer.from(expectedSignature)
  const supplied = Buffer.from(suppliedSignature)
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new CommitmentPilotError("verification_failed", "Screening eligibility proof is invalid.", 403)
  }
  let payload: EligibilityPayload
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as EligibilityPayload
  } catch {
    throw new CommitmentPilotError("verification_failed", "Screening eligibility proof is invalid.", 403)
  }
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1_000)
  if (
    payload.v !== 1 ||
    payload.expiresAt <= nowSeconds ||
    payload.issuedAt > nowSeconds + 60 ||
    payload.subjectHash !== digest(input.subjectId) ||
    payload.recommendationDigest !== recommendationDigest(input.recommendation)
  ) {
    throw new CommitmentPilotError("verification_failed", "Screening eligibility proof is expired or mismatched.", 403)
  }
}
