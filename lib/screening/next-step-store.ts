import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { ScreeningNextStep } from "./types"

export type ScreeningNextStepStatus =
  | "requested"
  | "needs_review"
  | "in_progress"
  | "waiting_on_patient"
  | "waiting_on_provider"
  | "prior_auth_needed"
  | "prior_auth_submitted"
  | "scheduled"
  | "completed"
  | "canceled"

export type ScreeningNextStepRequest = {
  id: string
  internalUserId: string
  walletHash?: string
  patientId?: string
  recommendationId: string
  screeningName: string
  requestedAction: ScreeningNextStep
  status: ScreeningNextStepStatus
  createdAt: string
  updatedAt: string
  patientNote?: string
  locationZip?: string
  clinicianSummary?: string
  source: "wallet" | "admin" | "demo"
}

type Store = {
  requests: ScreeningNextStepRequest[]
}

const VALID_NEXT_STEPS = new Set<ScreeningNextStep>([
  "request_care_navigation",
  "request_referral",
  "request_imaging",
  "request_lab",
  "request_colonoscopy",
  "request_mammogram",
  "request_ldct",
  "request_cervical_screening",
  "request_psa_discussion",
  "request_genetic_counseling",
  "request_specialist_review",
  "download_clinician_summary",
  "seek_urgent_care",
])

function storePath(): string {
  return process.env.OPENRX_SCREENING_REQUESTS_PATH || path.join("/tmp", "openrx-screening-next-steps.json")
}

function readStore(): Store {
  const file = storePath()
  if (!fs.existsSync(file)) return { requests: [] }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<Store>
    return { requests: parsed.requests || [] }
  } catch {
    return { requests: [] }
  }
}

function writeStore(store: Store): void {
  const file = storePath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(store, null, 2), "utf8")
}

function cleanText(value: string | undefined, maxLength: number): string | undefined {
  const trimmed = (value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, maxLength)
}

export function walletHash(walletAddress: string): string {
  return crypto.createHash("sha256").update(walletAddress.trim().toLowerCase()).digest("hex")
}

export function internalUserIdFromWallet(walletAddress: string): string {
  return `usr_${walletHash(walletAddress).slice(0, 24)}`
}

export function isScreeningNextStep(value: string): value is ScreeningNextStep {
  return VALID_NEXT_STEPS.has(value as ScreeningNextStep)
}

export function createScreeningNextStepRequest(input: {
  walletAddress?: string
  patientId?: string
  recommendationId: string
  screeningName: string
  requestedAction: ScreeningNextStep
  patientNote?: string
  locationZip?: string
  clinicianSummary?: string
  demoMode?: boolean
  source?: "wallet" | "admin" | "demo"
}): ScreeningNextStepRequest {
  const now = new Date().toISOString()
  const source = input.source || (input.demoMode ? "demo" : "wallet")
  const internalUserId = input.walletAddress
    ? internalUserIdFromWallet(input.walletAddress)
    : source === "demo"
      ? "demo_user"
      : "unknown_user"
  const request: ScreeningNextStepRequest = {
    id: `snr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    internalUserId,
    ...(input.walletAddress && source !== "demo" ? { walletHash: walletHash(input.walletAddress) } : {}),
    patientId: cleanText(input.patientId, 96),
    recommendationId: cleanText(input.recommendationId, 120) || "screening-recommendation",
    screeningName: cleanText(input.screeningName, 160) || "Screening recommendation",
    requestedAction: input.requestedAction,
    status: source === "demo" ? "needs_review" : "requested",
    createdAt: now,
    updatedAt: now,
    patientNote: cleanText(input.patientNote, 500),
    locationZip: cleanText(input.locationZip, 20),
    clinicianSummary: cleanText(input.clinicianSummary, 1200),
    source,
  }

  if (source !== "demo") {
    const store = readStore()
    store.requests.unshift(request)
    writeStore(store)
  }

  return request
}

export function listScreeningNextStepRequests(internalUserId?: string): ScreeningNextStepRequest[] {
  const requests = readStore().requests
  return internalUserId ? requests.filter((request) => request.internalUserId === internalUserId) : requests
}
