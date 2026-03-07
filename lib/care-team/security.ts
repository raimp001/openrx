import crypto from "node:crypto"
import type { AgentNotifyPayload, CareTeamRequestContext, CareTeamWorkflow } from "@/lib/care-team/types"

const DEFAULT_REDACTION = "[redacted]"

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function redactLikelyPhi(value: string): string {
  return normalizeWhitespace(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, DEFAULT_REDACTION)
    .replace(/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, DEFAULT_REDACTION)
    .replace(/\b\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, DEFAULT_REDACTION)
}

function clampText(value: string, max = 240): string {
  const normalized = redactLikelyPhi(value)
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}…`
}

export function hashReference(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function stableHashJson(value: unknown): string {
  return hashReference(JSON.stringify(value))
}

function normalizeWorkflow(value?: string): CareTeamWorkflow {
  const lowered = (value || "").toLowerCase()
  const allowed: CareTeamWorkflow[] = [
    "prior_auth",
    "billing",
    "rx",
    "scheduling",
    "triage",
    "compliance",
    "onboarding",
    "coordination",
    "general",
  ]
  return allowed.includes(lowered as CareTeamWorkflow) ? (lowered as CareTeamWorkflow) : "general"
}

function normalizeConfidence(value?: number): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined
  if (value < 0) return 0
  if (value > 1) return 1
  return Number(value.toFixed(3))
}

function assertHashed(value: string): string {
  const trimmed = value.trim()
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return trimmed.toLowerCase()
  return hashReference(trimmed.toLowerCase())
}

function resolvePatientHash(context: NonNullable<AgentNotifyPayload["context"]>): string {
  if (context.patient_id_hash && context.patient_id_hash.trim()) {
    return assertHashed(context.patient_id_hash)
  }
  if (context.patient_id && context.patient_id.trim()) {
    return assertHashed(context.patient_id)
  }
  return assertHashed(`unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
}

function parseEncryptionKey(): Buffer | null {
  const raw = process.env.OPENRX_CARE_TEAM_ENCRYPTION_KEY || ""
  if (!raw) return null

  const candidate = raw.trim()
  if (/^[a-f0-9]{64}$/i.test(candidate)) {
    return Buffer.from(candidate, "hex")
  }

  try {
    const decoded = Buffer.from(candidate, "base64")
    if (decoded.length === 32) return decoded
    return null
  } catch {
    return null
  }
}

export function encryptJson(value: unknown): { ciphertext: string; iv: string; tag: string; algo: "aes-256-gcm" } | null {
  const key = parseEncryptionKey()
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("OPENRX_CARE_TEAM_ENCRYPTION_KEY is required in production.")
    }
    return null
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const plaintext = Buffer.from(JSON.stringify(value), "utf8")
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    algo: "aes-256-gcm",
  }
}

export function sanitizeIncomingContext(payload: AgentNotifyPayload): CareTeamRequestContext {
  const context = payload.context || {}

  return {
    patientIdHash: resolvePatientHash(context),
    ...(context.claim_id_hash ? { claimIdHash: assertHashed(context.claim_id_hash) } : {}),
    ...(context.record_id_hash ? { recordIdHash: assertHashed(context.record_id_hash) } : {}),
    reason: clampText(context.reason || "Agent requested review."),
    suggestedAction: clampText(context.suggested_action || "Review and decide next step."),
    ...(context.document_snapshot_hash
      ? { documentSnapshotHash: assertHashed(context.document_snapshot_hash) }
      : {}),
    workflow: normalizeWorkflow(context.workflow),
    ...(normalizeConfidence(context.confidence_score) !== undefined
      ? { confidenceScore: normalizeConfidence(context.confidence_score) }
      : {}),
    ...(context.browser_url || context.highlight_selector || context.browser_note
      ? {
          browser: {
            ...(context.browser_url ? { url: clampText(context.browser_url, 500) } : {}),
            ...(context.highlight_selector ? { highlightSelector: clampText(context.highlight_selector, 160) } : {}),
            ...(context.browser_note ? { note: clampText(context.browser_note, 200) } : {}),
          },
        }
      : {}),
  }
}
