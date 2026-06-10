"use client"

export const WORKFLOW_EVENT_NAMES = [
  "chat_started",
  "answer_generated",
  "source_opened",
  "screening_started",
  "screening_completed",
  "screening_referral_previewed",
  "screening_referral_created",
  "care_plan_created",
  "provider_search_started",
  "provider_saved",
  "message_drafted",
  "wallet_connected",
  "tip_started",
  "tip_completed",
  "tip_failed",
  "red_flag_triggered",
  "demo_viewed",
  "demo_scenario_selected",
  "demo_evidence_retrieved",
  "demo_appeal_generated",
  "demo_fhir_stub_opened",
  "demo_fhir_stub_completed",
  "demo_source_opened",
] as const

export type WorkflowEventName = (typeof WORKFLOW_EVENT_NAMES)[number]

export interface WorkflowEvent {
  name: WorkflowEventName
  sessionId: string
  at: string
  metadata?: Record<string, string | number | boolean>
}

const EVENT_STORAGE_KEY = "openrx:workflow-events:v1"
const SAFE_METADATA_KEYS = new Set([
  "origin",
  "surface",
  "category",
  "status",
  "count",
  "amount",
  "has_sources",
  "scenario",
  "stage",
  "adapter",
  "referralTargets",
  "contactOnly",
])
let runtimeSessionId = ""

export function safeEventMetadata(metadata?: Record<string, unknown>): Record<string, string | number | boolean> | undefined {
  if (!metadata) return undefined
  const safe: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = typeof value === "string" ? value.slice(0, 40) : value
    }
  }
  return Object.keys(safe).length ? safe : undefined
}

export function createWorkflowEvent(
  name: WorkflowEventName,
  sessionId: string,
  metadata?: Record<string, unknown>
): WorkflowEvent {
  return {
    name,
    sessionId,
    at: new Date().toISOString(),
    metadata: safeEventMetadata(metadata),
  }
}

function getSessionId() {
  if (!runtimeSessionId) {
    runtimeSessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
  }
  return runtimeSessionId
}

export function trackWorkflowEvent(name: WorkflowEventName, metadata?: Record<string, unknown>) {
  if (typeof window === "undefined") return
  const event = createWorkflowEvent(name, getSessionId(), metadata)
  try {
    const previous = JSON.parse(window.localStorage.getItem(EVENT_STORAGE_KEY) || "[]") as WorkflowEvent[]
    window.localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify([...previous.slice(-99), event]))
  } catch {
    // Analytics must never block care workflows.
  }
  window.dispatchEvent(new CustomEvent("openrx:workflow-event", { detail: event }))
}

export function readWorkflowEvents(storage?: Pick<Storage, "getItem"> | null): WorkflowEvent[] {
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(EVENT_STORAGE_KEY) || "[]") as WorkflowEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
