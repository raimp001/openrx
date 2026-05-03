import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { ScreeningNextStepRequestRecord } from "@prisma/client"
import { getDatabaseHealth } from "@/lib/database-health"
import { prisma } from "@/lib/db"
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

function isMissingTableError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      ((error as { code?: string }).code === "P2021" || (error as { code?: string }).code === "P2022")
  )
}

async function canUseDatabaseStore(): Promise<boolean> {
  const health = await getDatabaseHealth()
  if (!health.reachable) return false
  try {
    await prisma.screeningNextStepRequestRecord.count()
    return true
  } catch (error) {
    if (isMissingTableError(error)) return false
    return false
  }
}

function toRequest(record: ScreeningNextStepRequestRecord): ScreeningNextStepRequest {
  return {
    id: record.id,
    internalUserId: record.internalUserId,
    walletHash: record.walletHash || undefined,
    patientId: record.patientId || undefined,
    recommendationId: record.recommendationId,
    screeningName: record.screeningName,
    requestedAction: isScreeningNextStep(record.requestedAction) ? record.requestedAction : "request_care_navigation",
    status: isScreeningNextStepStatus(record.status) ? record.status : "requested",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    patientNote: record.patientNote || undefined,
    locationZip: record.locationZip || undefined,
    clinicianSummary: record.clinicianSummary || undefined,
    source: record.source === "admin" || record.source === "demo" ? record.source : "wallet",
  }
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

function isScreeningNextStepStatus(value: string): value is ScreeningNextStepStatus {
  return [
    "requested",
    "needs_review",
    "in_progress",
    "waiting_on_patient",
    "waiting_on_provider",
    "prior_auth_needed",
    "prior_auth_submitted",
    "scheduled",
    "completed",
    "canceled",
  ].includes(value)
}

export async function createScreeningNextStepRequest(input: {
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
}): Promise<ScreeningNextStepRequest> {
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
    if (await canUseDatabaseStore()) {
      const record = await prisma.screeningNextStepRequestRecord.create({
        data: {
          id: request.id,
          internalUserId: request.internalUserId,
          walletHash: request.walletHash,
          patientId: request.patientId,
          recommendationId: request.recommendationId,
          screeningName: request.screeningName,
          requestedAction: request.requestedAction,
          status: request.status,
          patientNote: request.patientNote,
          locationZip: request.locationZip,
          clinicianSummary: request.clinicianSummary,
          source: request.source,
          createdAt: new Date(request.createdAt),
          updatedAt: new Date(request.updatedAt),
        },
      })
      return toRequest(record)
    } else {
      const store = readStore()
      store.requests.unshift(request)
      writeStore(store)
    }
  }

  return request
}

export async function listScreeningNextStepRequests(internalUserId?: string): Promise<ScreeningNextStepRequest[]> {
  if (await canUseDatabaseStore()) {
    const records = await prisma.screeningNextStepRequestRecord.findMany({
      where: internalUserId ? { internalUserId } : undefined,
      orderBy: { createdAt: "desc" },
    })
    return records.map(toRequest)
  }
  const requests = readStore().requests
  return internalUserId ? requests.filter((request) => request.internalUserId === internalUserId) : requests
}
