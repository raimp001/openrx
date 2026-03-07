import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { CARE_TEAM_CORE_AGENTS, CARE_TEAM_STORE_VERSION } from "@/lib/care-team/constants"
import {
  type AgentNotifyPayload,
  type CareTeamAgent,
  type CareTeamAuditEntry,
  type CareTeamCustomAgentInput,
  type CareTeamDecision,
  type CareTeamEvent,
  type CareTeamHumanInputRequest,
  type CareTeamResolveInput,
  type CareTeamStateSnapshot,
} from "@/lib/care-team/types"
import { encryptJson, sanitizeIncomingContext, stableHashJson } from "@/lib/care-team/security"

interface RateLimitBucket {
  startedAt: number
  count: number
}

interface StoredRequest extends CareTeamHumanInputRequest {
  encryptedContext?: {
    ciphertext: string
    iv: string
    tag: string
    algo: "aes-256-gcm"
  } | null
}

interface CareTeamStore {
  version: number
  agents: CareTeamAgent[]
  manualStatuses: Record<string, "running" | "paused">
  requests: StoredRequest[]
  audit: CareTeamAuditEntry[]
  rateLimits: Record<string, RateLimitBucket>
  lastUpdated: string
}

export interface CareTeamActor {
  userId: string
  role: "admin" | "staff" | "service" | "patient"
}

const MAX_AUDIT_ITEMS = 3000
const MAX_REQUEST_ITEMS = 1200

function nowIso(): string {
  return new Date().toISOString()
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

function resolveStorePath(): string {
  const configured = process.env.OPENRX_CARE_TEAM_STORE_PATH
  if (configured) return configured
  if (process.env.NODE_ENV === "production") {
    throw new Error("OPENRX_CARE_TEAM_STORE_PATH is required in production for durable audit storage.")
  }
  return path.join(process.cwd(), ".openrx-care-team.json")
}

function ensureStoreDirectory(filePath: string): void {
  const directory = path.dirname(filePath)
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }
}

function defaultAgents(): CareTeamAgent[] {
  return CARE_TEAM_CORE_AGENTS.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    status: "running",
    unreadCount: 0,
    isCore: true,
    updatedAt: nowIso(),
  }))
}

function defaultStore(): CareTeamStore {
  const manualStatuses = Object.fromEntries(defaultAgents().map((agent) => [agent.id, "running" as const]))
  return {
    version: CARE_TEAM_STORE_VERSION,
    agents: defaultAgents(),
    manualStatuses,
    requests: [],
    audit: [],
    rateLimits: {},
    lastUpdated: nowIso(),
  }
}

function loadStore(): CareTeamStore {
  const storePath = resolveStorePath()

  try {
    if (!fs.existsSync(storePath)) {
      return defaultStore()
    }

    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as Partial<CareTeamStore>
    const seeded = defaultStore()
    const existingAgents = Array.isArray(parsed.agents) ? parsed.agents : []

    const mergedAgentsMap = new Map<string, CareTeamAgent>()
    seeded.agents.forEach((agent) => {
      mergedAgentsMap.set(agent.id, agent)
    })
    existingAgents.forEach((agent) => {
      if (!agent?.id || !agent?.name || !agent?.role) return
      mergedAgentsMap.set(agent.id, {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: agent.status || "running",
        unreadCount: typeof agent.unreadCount === "number" ? agent.unreadCount : 0,
        isCore: Boolean(agent.isCore),
        updatedAt: agent.updatedAt || nowIso(),
      })
    })

    const manualStatuses = {
      ...seeded.manualStatuses,
      ...(parsed.manualStatuses || {}),
    }

    return {
      version: CARE_TEAM_STORE_VERSION,
      agents: Array.from(mergedAgentsMap.values()),
      manualStatuses,
      requests: Array.isArray(parsed.requests) ? (parsed.requests as StoredRequest[]) : [],
      audit: Array.isArray(parsed.audit) ? (parsed.audit as CareTeamAuditEntry[]) : [],
      rateLimits: parsed.rateLimits || {},
      lastUpdated: parsed.lastUpdated || nowIso(),
    }
  } catch {
    return defaultStore()
  }
}

function saveStore(store: CareTeamStore): void {
  const storePath = resolveStorePath()
  ensureStoreDirectory(storePath)
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8")
}

function appendAudit(
  store: CareTeamStore,
  params: {
    requestId?: string
    action: string
    actor: CareTeamActor
    metadata: Record<string, unknown>
  }
): CareTeamAuditEntry {
  const entry: CareTeamAuditEntry = {
    id: createId("audit"),
    requestId: params.requestId,
    action: params.action,
    actorRole: params.actor.role,
    actorUserIdHash: stableHashJson(params.actor.userId),
    metadataHash: stableHashJson(params.metadata),
    timestamp: nowIso(),
  }

  store.audit.unshift(entry)
  if (store.audit.length > MAX_AUDIT_ITEMS) {
    store.audit = store.audit.slice(0, MAX_AUDIT_ITEMS)
  }
  return entry
}

function upsertAgent(store: CareTeamStore, input: { id: string; name: string; role: string; isCore: boolean }): CareTeamAgent {
  const existing = store.agents.find((agent) => agent.id === input.id)
  if (existing) {
    existing.name = input.name
    existing.role = input.role
    existing.isCore = input.isCore
    existing.updatedAt = nowIso()
    return existing
  }

  const created: CareTeamAgent = {
    id: input.id,
    name: input.name,
    role: input.role,
    status: "running",
    unreadCount: 0,
    isCore: input.isCore,
    updatedAt: nowIso(),
  }
  store.agents.push(created)
  store.manualStatuses[input.id] = "running"
  return created
}

function recomputeAgentStatuses(store: CareTeamStore): void {
  const openCounts = new Map<string, number>()
  store.requests
    .filter((request) => request.status === "needs_input")
    .forEach((request) => {
      openCounts.set(request.agentId, (openCounts.get(request.agentId) || 0) + 1)
    })

  store.agents.forEach((agent) => {
    const openCount = openCounts.get(agent.id) || 0
    const base = store.manualStatuses[agent.id] || "running"
    agent.unreadCount = openCount
    agent.status = openCount > 0 ? "needs_input" : base
    agent.updatedAt = nowIso()
  })
}

function touchStore(store: CareTeamStore): void {
  store.lastUpdated = nowIso()
}

export function consumeCareTeamRateLimit(input: {
  key: string
  limit: number
  windowMs: number
}): { allowed: boolean; retryAfterMs?: number } {
  const store = loadStore()
  const now = Date.now()
  const bucket = store.rateLimits[input.key]

  if (!bucket || now - bucket.startedAt > input.windowMs) {
    store.rateLimits[input.key] = { startedAt: now, count: 1 }
    touchStore(store)
    saveStore(store)
    return { allowed: true }
  }

  if (bucket.count >= input.limit) {
    return {
      allowed: false,
      retryAfterMs: Math.max(1000, input.windowMs - (now - bucket.startedAt)),
    }
  }

  store.rateLimits[input.key] = { startedAt: bucket.startedAt, count: bucket.count + 1 }
  touchStore(store)
  saveStore(store)
  return { allowed: true }
}

export function getCareTeamSnapshot(limitAudit = 40): CareTeamStateSnapshot {
  const store = loadStore()
  recomputeAgentStatuses(store)
  saveStore(store)

  return {
    agents: store.agents,
    openRequests: store.requests.filter((request) => request.status === "needs_input"),
    recentAudit: store.audit.slice(0, Math.max(1, limitAudit)),
    needsInputCount: store.requests.filter((request) => request.status === "needs_input").length,
    lastUpdated: store.lastUpdated,
  }
}

export function findCareTeamRequest(requestId: string): CareTeamHumanInputRequest | null {
  if (!requestId.trim()) return null
  const store = loadStore()
  const request = store.requests.find((entry) => entry.id === requestId.trim()) || null
  return request
}

export function submitHumanInputRequest(input: {
  payload: AgentNotifyPayload
  actor: CareTeamActor
}): { request: CareTeamHumanInputRequest; agent: CareTeamAgent; audit: CareTeamAuditEntry } {
  const store = loadStore()
  const agent = upsertAgent(store, {
    id: input.payload.agent_id,
    name: input.payload.agent_name,
    role: input.payload.agent_name,
    isCore: CARE_TEAM_CORE_AGENTS.some((entry) => entry.id === input.payload.agent_id),
  })

  const context = sanitizeIncomingContext(input.payload)
  const request: StoredRequest = {
    id: createId("hitl"),
    agentId: agent.id,
    agentName: agent.name,
    status: "needs_input",
    createdAt: input.payload.timestamp || nowIso(),
    updatedAt: nowIso(),
    context,
    encryptedContext: encryptJson(context),
  }

  store.requests.unshift(request)
  if (store.requests.length > MAX_REQUEST_ITEMS) {
    store.requests = store.requests.slice(0, MAX_REQUEST_ITEMS)
  }

  const audit = appendAudit(store, {
    requestId: request.id,
    action: "care_team.request_human_input",
    actor: input.actor,
    metadata: {
      agentId: request.agentId,
      workflow: request.context.workflow,
      patientRef: request.context.patientIdHash,
      confidenceScore: request.context.confidenceScore,
    },
  })

  recomputeAgentStatuses(store)
  touchStore(store)
  saveStore(store)

  return { request, agent, audit }
}

export function updateAgentStatus(input: {
  agentId: string
  agentName: string
  status: "running" | "paused"
  actor: CareTeamActor
}): { agent: CareTeamAgent; audit: CareTeamAuditEntry } {
  const store = loadStore()
  const agent = upsertAgent(store, {
    id: input.agentId,
    name: input.agentName,
    role: input.agentName,
    isCore: CARE_TEAM_CORE_AGENTS.some((entry) => entry.id === input.agentId),
  })

  store.manualStatuses[input.agentId] = input.status
  recomputeAgentStatuses(store)

  const updatedAgent = store.agents.find((entry) => entry.id === input.agentId) || agent
  const audit = appendAudit(store, {
    action: "care_team.agent_status",
    actor: input.actor,
    metadata: {
      agentId: input.agentId,
      status: updatedAgent.status,
    },
  })

  touchStore(store)
  saveStore(store)

  return { agent: updatedAgent, audit }
}

export function resolveHumanInputRequest(input: {
  actor: CareTeamActor
  payload: CareTeamResolveInput
}): { request: CareTeamHumanInputRequest; agent: CareTeamAgent; audit: CareTeamAuditEntry } {
  const store = loadStore()
  const request = store.requests.find((entry) => entry.id === input.payload.requestId)
  if (!request) {
    throw new Error("Request not found.")
  }
  if (request.status !== "needs_input") {
    throw new Error("Request is already resolved.")
  }

  request.status = "resolved"
  request.resolution = input.payload.decision as CareTeamDecision
  request.resolutionNote = (input.payload.note || "").trim() || undefined
  request.updatedAt = nowIso()
  request.resolvedAt = nowIso()

  if (input.payload.decision === "edit") {
    if (input.payload.editedSuggestedAction?.trim()) {
      request.context.suggestedAction = input.payload.editedSuggestedAction.trim()
    }
    if (input.payload.browserUrl?.trim()) {
      const browser = request.context.browser || {}
      request.context.browser = { ...browser, url: input.payload.browserUrl.trim() }
    }
    request.encryptedContext = encryptJson(request.context)
  }

  recomputeAgentStatuses(store)
  const agent = store.agents.find((entry) => entry.id === request.agentId)
  if (!agent) {
    throw new Error("Agent not found.")
  }

  const audit = appendAudit(store, {
    requestId: request.id,
    action: `care_team.request_${input.payload.decision}`,
    actor: input.actor,
    metadata: {
      requestId: request.id,
      agentId: request.agentId,
      decision: input.payload.decision,
      noteHash: stableHashJson(input.payload.note || ""),
    },
  })

  touchStore(store)
  saveStore(store)

  return { request, agent, audit }
}

export function createCustomAgent(input: {
  payload: CareTeamCustomAgentInput
  actor: CareTeamActor
}): { agent: CareTeamAgent; audit: CareTeamAuditEntry } {
  const store = loadStore()
  const id = (input.payload.id || `custom-${crypto.randomUUID().slice(0, 8)}`).toLowerCase()

  const agent = upsertAgent(store, {
    id,
    name: input.payload.name.trim(),
    role: input.payload.role.trim(),
    isCore: false,
  })

  const audit = appendAudit(store, {
    action: "care_team.custom_agent_upsert",
    actor: input.actor,
    metadata: {
      agentId: agent.id,
      name: agent.name,
    },
  })

  recomputeAgentStatuses(store)
  touchStore(store)
  saveStore(store)

  return { agent, audit }
}

export function buildCareTeamEvent(input: {
  type: CareTeamEvent["type"]
  request?: CareTeamHumanInputRequest
  agent?: CareTeamAgent
}): CareTeamEvent {
  const snapshot = getCareTeamSnapshot(10)
  return {
    eventId: createId("event"),
    type: input.type,
    timestamp: nowIso(),
    payload: {
      ...(input.request ? { request: input.request } : {}),
      ...(input.agent ? { agent: input.agent } : {}),
      needsInputCount: snapshot.needsInputCount,
    },
  }
}
