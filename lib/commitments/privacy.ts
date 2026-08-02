import { createHash, randomBytes } from "node:crypto"

const PROHIBITED_KEYS = new Set([
  "name",
  "patientname",
  "dateofbirth",
  "dob",
  "email",
  "phone",
  "address",
  "insurance",
  "insuranceid",
  "medicalrecordnumber",
  "mrn",
  "screeningname",
  "testname",
  "cpt",
  "loinc",
  "diagnosis",
  "procedure",
  "result",
  "appointmentdate",
  "completiondate",
  "contraindication",
  "providernotes",
  "walletaddress",
  "transactionhash",
  "txhash",
])

const PROHIBITED_TEXT_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\b(?:MRN|medical record|member id|policy number)\b/i,
  /\b(?:CPT|LOINC|ICD-?10)\b/i,
]

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase()
}

export function findProhibitedData(value: unknown, path = "$"): string[] {
  const findings: string[] = []

  if (Array.isArray(value)) {
    value.forEach((entry, index) => findings.push(...findProhibitedData(entry, `${path}[${index}]`)))
    return findings
  }

  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (PROHIBITED_KEYS.has(normalizedKey(key))) findings.push(`${path}.${key}`)
      findings.push(...findProhibitedData(entry, `${path}.${key}`))
    }
    return findings
  }

  if (typeof value === "string") {
    for (const pattern of PROHIBITED_TEXT_PATTERNS) {
      if (pattern.test(value)) {
        findings.push(path)
        break
      }
    }
  }

  return Array.from(new Set(findings))
}

export function assertPublicPayloadSafe(value: unknown): void {
  const findings = findProhibitedData(value)
  if (findings.length) {
    throw new Error(`Prohibited data detected in public payload at ${findings.join(", ")}.`)
  }
}

export function createOpaqueId(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString("base64url")}`
}

export function createOpaqueCommitmentId(): string {
  return `0x${randomBytes(32).toString("hex")}`
}

export function hashOpaqueToken(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function createShareToken(): string {
  return randomBytes(32).toString("base64url")
}

export const hashToken = hashOpaqueToken

export function redactCommitmentForPublicMetadata(commitmentId: string) {
  const payload = { commitmentId }
  assertPublicPayloadSafe(payload)
  return payload
}
