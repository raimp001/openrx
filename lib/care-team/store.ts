import crypto from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/db"
import { CARE_TEAM_CORE_AGENTS } from "@/lib/care-team/constants"
import * as fileStore from "@/lib/care-team/file-store"
import {
  type AgentNotifyPayload,
  type CareTeamAgent,
  type CareTeamAuditEntry,
  type CareTeamCustomAgentInput,
  type CareTeamDecision,
  type CareTeamEvent,
  type CareTeamHumanInputRequest,
  type CareTeamRequestContext,
  type CareTeamResolveInput,
  type CareTeamStateSnapshot,
} from "@/lib/care-team/types"
import { encryptJson, sanitizeIncomingContext, stableHashJson } from "@/lib/care-team/security"

export interface CareTeamActor {
  userId: string
  role: "admin" | "staff" | "service" | "patient"
}

type DbClient = PrismaClient | Prisma.TransactionClient

function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function toAgentRecord(input: {
  id: string
  name: string
  role: string
  status: string
  unreadCount: number
  isCore: boolean
  updatedAt: Date
}): CareTeamAgent {
  return {
    id: input.id,
    name: input.name,
    role: input.role,
    status: normalizeAgentStatus(input.status),
    unreadCount: input.unreadCount,
    isCore: input.isCore,
    updatedAt: input.updatedAt.toISOString(),
  }
}

function toRequestRecord(input: {
  id: string
  agentId: string
  agentName: string
  status: string
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
  resolution: string | null
  resolutionNote: string | null
  context: Prisma.JsonValue
}): CareTeamHumanInputRequest {
  return {
    id: input.id,
    agentId: input.agentId,
    agentName: input.agentName,
    status: input.status === "resolved" ? "resolved" : "needs_input",
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
    ...(input.resolvedAt ? { resolvedAt: input.resolvedAt.toISOString() } : {}),
    ...(input.resolution ? { resolution: input.resolution as CareTeamDecision } : {}),
    ...(input.resolutionNote ? { resolutionNote: input.resolutionNote } : {}),
    context: input.context as unknown as CareTeamRequestContext,
  }
}

function toAuditRecord(input: {
  id: string
  requestId: string | null
  action: string
  actorRole: string
  actorUserIdHash: string
  metadataHash: string
  timestamp: Date
}): CareTeamAuditEntry {
  return {
    id: input.id,
    ...(input.requestId ? { requestId: input.requestId } : {}),
    action: input.action,
    actorRole: input.actorRole as CareTeamActor["role"],
    actorUserIdHash: input.actorUserIdHash,
    metadataHash: input.metadataHash,
    timestamp: input.timestamp.toISOString(),
  }
}

function normalizeAgentStatus(value: string): CareTeamAgent["status"] {
  if (value === "paused") return "paused"
  if (value === "needs_input") return "needs_input"
  return "running"
}

async function seedCoreAgents(client: DbClient): Promise<void> {
  await Promise.all(
    CARE_TEAM_CORE_AGENTS.map((agent) =>
      client.careTeamAgentRuntime.upsert({
        where: { id: agent.id },
        update: {
          name: agent.name,
          role: agent.role,
          isCore: true,
        },
        create: {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          isCore: true,
          status: "running",
          manualStatus: "running",
          unreadCount: 0,
        },
      })
    )
  )
}

async function upsertAgentDb(
  client: DbClient,
  input: { id: string; name: string; role: string; isCore: boolean }
): Promise<CareTeamAgent> {
  const record = await client.careTeamAgentRuntime.upsert({
    where: { id: input.id },
    update: {
      name: input.name,
      role: input.role,
      isCore: input.isCore,
    },
    create: {
      id: input.id,
      name: input.name,
      role: input.role,
      isCore: input.isCore,
      status: "running",
      manualStatus: "running",
      unreadCount: 0,
    },
  })

  return toAgentRecord(record)
}

async function recomputeAgentStatusesDb(client: DbClient): Promise<Map<string, CareTeamAgent>> {
  const agents = await client.careTeamAgentRuntime.findMany()
  const openRequests = await client.careTeamRequest.groupBy({
    by: ["agentId"],
    where: { status: "needs_input" },
    _count: { _all: true },
  })
  const counts = new Map(openRequests.map((entry) => [entry.agentId, entry._count._all]))

  await Promise.all(
    agents.map((agent) => {
      const unreadCount = counts.get(agent.id) || 0
      const status = unreadCount > 0 ? "needs_input" : agent.manualStatus
      return client.careTeamAgentRuntime.update({
        where: { id: agent.id },
        data: {
          unreadCount,
          status,
        },
      })
    })
  )

  const refreshed = await client.careTeamAgentRuntime.findMany()
  return new Map(refreshed.map((agent) => [agent.id, toAgentRecord(agent)]))
}

async function getSnapshotFromDb(limitAudit = 40): Promise<CareTeamStateSnapshot> {
  await seedCoreAgents(prisma)
  const agentMap = await recomputeAgentStatusesDb(prisma)

  const [requests, audits, agents] = await Promise.all([
    prisma.careTeamRequest.findMany({
      where: { status: "needs_input" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.careTeamAudit.findMany({
      orderBy: { timestamp: "desc" },
      take: Math.max(1, limitAudit),
    }),
    prisma.careTeamAgentRuntime.findMany(),
  ])

  const sortedAgents = agents
    .map((agent) => agentMap.get(agent.id) || toAgentRecord(agent))
    .sort((left, right) => {
      if (left.isCore !== right.isCore) return left.isCore ? -1 : 1
      return left.name.localeCompare(right.name)
    })

  const openRequests = requests.map(toRequestRecord)
  const recentAudit = audits.map(toAuditRecord)
  const lastUpdated = [
    ...agents.map((agent) => agent.updatedAt.getTime()),
    ...requests.map((request) => request.updatedAt.getTime()),
    ...audits.map((audit) => audit.timestamp.getTime()),
  ]
  const maxUpdated = lastUpdated.length > 0 ? Math.max(...lastUpdated) : Date.now()

  return {
    agents: sortedAgents,
    openRequests,
    recentAudit,
    needsInputCount: openRequests.length,
    lastUpdated: new Date(maxUpdated).toISOString(),
  }
}

function fallbackSnapshot(limitAudit = 40): CareTeamStateSnapshot {
  return fileStore.getCareTeamSnapshot(limitAudit)
}

function logFallback(operation: string, error: unknown): void {
  console.warn(`Care team DB persistence unavailable during ${operation}; falling back to file store.`, error)
}

export async function consumeCareTeamRateLimit(input: {
  key: string
  limit: number
  windowMs: number
}): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  if (!hasDatabase()) {
    return fileStore.consumeCareTeamRateLimit(input)
  }

  try {
    const now = Date.now()
    const bucket = await prisma.careTeamRateLimit.findUnique({ where: { key: input.key } })

    if (!bucket || now - bucket.startedAt.getTime() > input.windowMs) {
      await prisma.careTeamRateLimit.upsert({
        where: { key: input.key },
        update: {
          startedAt: new Date(now),
          count: 1,
        },
        create: {
          key: input.key,
          startedAt: new Date(now),
          count: 1,
        },
      })
      return { allowed: true }
    }

    if (bucket.count >= input.limit) {
      return {
        allowed: false,
        retryAfterMs: Math.max(1000, input.windowMs - (now - bucket.startedAt.getTime())),
      }
    }

    await prisma.careTeamRateLimit.update({
      where: { key: input.key },
      data: { count: bucket.count + 1 },
    })
    return { allowed: true }
  } catch (error) {
    logFallback("consumeCareTeamRateLimit", error)
    return fileStore.consumeCareTeamRateLimit(input)
  }
}

export async function getCareTeamSnapshot(limitAudit = 40): Promise<CareTeamStateSnapshot> {
  if (!hasDatabase()) {
    return fallbackSnapshot(limitAudit)
  }
  try {
    return await getSnapshotFromDb(limitAudit)
  } catch (error) {
    logFallback("getCareTeamSnapshot", error)
    return fallbackSnapshot(limitAudit)
  }
}

export async function findCareTeamRequest(requestId: string): Promise<CareTeamHumanInputRequest | null> {
  const trimmed = requestId.trim()
  if (!trimmed) return null
  if (!hasDatabase()) {
    return fileStore.findCareTeamRequest(trimmed)
  }

  try {
    const request = await prisma.careTeamRequest.findUnique({ where: { id: trimmed } })
    return request ? toRequestRecord(request) : null
  } catch (error) {
    logFallback("findCareTeamRequest", error)
    return fileStore.findCareTeamRequest(trimmed)
  }
}

export async function submitHumanInputRequest(input: {
  payload: AgentNotifyPayload
  actor: CareTeamActor
}): Promise<{ request: CareTeamHumanInputRequest; agent: CareTeamAgent; audit: CareTeamAuditEntry }> {
  if (!hasDatabase()) {
    return fileStore.submitHumanInputRequest(input)
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await seedCoreAgents(tx)
      const agent = await upsertAgentDb(tx, {
        id: input.payload.agent_id,
        name: input.payload.agent_name,
        role: input.payload.agent_name,
        isCore: CARE_TEAM_CORE_AGENTS.some((entry) => entry.id === input.payload.agent_id),
      })

      const context = sanitizeIncomingContext(input.payload)
      const encryptedContext = encryptJson(context)
      const createdAt = input.payload.timestamp ? new Date(input.payload.timestamp) : new Date()
      const requestId = createId("hitl")

      const requestRecord = await tx.careTeamRequest.create({
        data: {
          id: requestId,
          agentId: agent.id,
          agentName: agent.name,
          status: "needs_input",
          createdAt,
          updatedAt: new Date(),
          context: jsonValue(context),
          encryptedContext: encryptedContext ? jsonValue(encryptedContext) : Prisma.JsonNull,
        },
      })

      const auditRecord = await tx.careTeamAudit.create({
        data: {
          id: createId("audit"),
          requestId,
          action: "care_team.request_human_input",
          actorRole: input.actor.role,
          actorUserIdHash: stableHashJson(input.actor.userId),
          metadataHash: stableHashJson({
            agentId: requestRecord.agentId,
            workflow: context.workflow,
            patientRef: context.patientIdHash,
            confidenceScore: context.confidenceScore,
          }),
          metadata: jsonValue({
            agentId: requestRecord.agentId,
            workflow: context.workflow,
            patientRef: context.patientIdHash,
            confidenceScore: context.confidenceScore,
          }),
        },
      })

      const agentMap = await recomputeAgentStatusesDb(tx)
      const updatedAgent = agentMap.get(agent.id) || agent

      return {
        request: toRequestRecord(requestRecord),
        agent: updatedAgent,
        audit: toAuditRecord(auditRecord),
      }
    })
  } catch (error) {
    logFallback("submitHumanInputRequest", error)
    return fileStore.submitHumanInputRequest(input)
  }
}

export async function updateAgentStatus(input: {
  agentId: string
  agentName: string
  status: "running" | "paused"
  actor: CareTeamActor
}): Promise<{ agent: CareTeamAgent; audit: CareTeamAuditEntry }> {
  if (!hasDatabase()) {
    return fileStore.updateAgentStatus(input)
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await seedCoreAgents(tx)
      await upsertAgentDb(tx, {
        id: input.agentId,
        name: input.agentName,
        role: input.agentName,
        isCore: CARE_TEAM_CORE_AGENTS.some((entry) => entry.id === input.agentId),
      })

      await tx.careTeamAgentRuntime.update({
        where: { id: input.agentId },
        data: { manualStatus: input.status },
      })

      const agentMap = await recomputeAgentStatusesDb(tx)
      const updatedAgent = agentMap.get(input.agentId)
      if (!updatedAgent) {
        throw new Error("Agent not found.")
      }

      const auditRecord = await tx.careTeamAudit.create({
        data: {
          id: createId("audit"),
          action: "care_team.agent_status",
          actorRole: input.actor.role,
          actorUserIdHash: stableHashJson(input.actor.userId),
          metadataHash: stableHashJson({ agentId: input.agentId, status: updatedAgent.status }),
          metadata: jsonValue({ agentId: input.agentId, status: updatedAgent.status }),
        },
      })

      return { agent: updatedAgent, audit: toAuditRecord(auditRecord) }
    })
  } catch (error) {
    logFallback("updateAgentStatus", error)
    return fileStore.updateAgentStatus(input)
  }
}

export async function resolveHumanInputRequest(input: {
  actor: CareTeamActor
  payload: CareTeamResolveInput
}): Promise<{ request: CareTeamHumanInputRequest; agent: CareTeamAgent; audit: CareTeamAuditEntry }> {
  if (!hasDatabase()) {
    return fileStore.resolveHumanInputRequest(input)
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await seedCoreAgents(tx)
      const existing = await tx.careTeamRequest.findUnique({ where: { id: input.payload.requestId } })
      if (!existing) {
        throw new Error("Request not found.")
      }
      if (existing.status !== "needs_input") {
        throw new Error("Request is already resolved.")
      }

      const nextContext = { ...(existing.context as unknown as CareTeamRequestContext) }
      if (input.payload.decision === "edit") {
        if (input.payload.editedSuggestedAction?.trim()) {
          nextContext.suggestedAction = input.payload.editedSuggestedAction.trim()
        }
        if (input.payload.browserUrl?.trim()) {
          const browser = nextContext.browser || {}
          nextContext.browser = { ...browser, url: input.payload.browserUrl.trim() }
        }
      }
      const nextEncryptedContext = input.payload.decision === "edit" ? encryptJson(nextContext) : null

      const requestRecord = await tx.careTeamRequest.update({
        where: { id: input.payload.requestId },
        data: {
          status: "resolved",
          resolution: input.payload.decision,
          resolutionNote: (input.payload.note || "").trim() || null,
          resolvedAt: new Date(),
          context: jsonValue(nextContext),
          encryptedContext:
            input.payload.decision === "edit"
              ? nextEncryptedContext
                ? jsonValue(nextEncryptedContext)
                : Prisma.JsonNull
              : existing.encryptedContext ?? Prisma.JsonNull,
        },
      })

      const agentMap = await recomputeAgentStatusesDb(tx)
      const updatedAgent = agentMap.get(requestRecord.agentId)
      if (!updatedAgent) {
        throw new Error("Agent not found.")
      }

      const auditRecord = await tx.careTeamAudit.create({
        data: {
          id: createId("audit"),
          requestId: requestRecord.id,
          action: `care_team.request_${input.payload.decision}`,
          actorRole: input.actor.role,
          actorUserIdHash: stableHashJson(input.actor.userId),
          metadataHash: stableHashJson({
            requestId: requestRecord.id,
            agentId: requestRecord.agentId,
            decision: input.payload.decision,
            noteHash: stableHashJson(input.payload.note || ""),
          }),
          metadata: jsonValue({
            requestId: requestRecord.id,
            agentId: requestRecord.agentId,
            decision: input.payload.decision,
            noteHash: stableHashJson(input.payload.note || ""),
          }),
        },
      })

      return {
        request: toRequestRecord(requestRecord),
        agent: updatedAgent,
        audit: toAuditRecord(auditRecord),
      }
    })
  } catch (error) {
    logFallback("resolveHumanInputRequest", error)
    return fileStore.resolveHumanInputRequest(input)
  }
}

export async function createCustomAgent(input: {
  payload: CareTeamCustomAgentInput
  actor: CareTeamActor
}): Promise<{ agent: CareTeamAgent; audit: CareTeamAuditEntry }> {
  if (!hasDatabase()) {
    return fileStore.createCustomAgent(input)
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await seedCoreAgents(tx)
      const id = (input.payload.id || `custom-${crypto.randomUUID().slice(0, 8)}`).toLowerCase()

      const agent = await upsertAgentDb(tx, {
        id,
        name: input.payload.name.trim(),
        role: input.payload.role.trim(),
        isCore: false,
      })

      const auditRecord = await tx.careTeamAudit.create({
        data: {
          id: createId("audit"),
          action: "care_team.custom_agent_upsert",
          actorRole: input.actor.role,
          actorUserIdHash: stableHashJson(input.actor.userId),
          metadataHash: stableHashJson({ agentId: agent.id, name: agent.name }),
          metadata: jsonValue({ agentId: agent.id, name: agent.name }),
        },
      })

      const agentMap = await recomputeAgentStatusesDb(tx)
      return {
        agent: agentMap.get(agent.id) || agent,
        audit: toAuditRecord(auditRecord),
      }
    })
  } catch (error) {
    logFallback("createCustomAgent", error)
    return fileStore.createCustomAgent(input)
  }
}

export async function buildCareTeamEvent(input: {
  type: CareTeamEvent["type"]
  request?: CareTeamHumanInputRequest
  agent?: CareTeamAgent
}): Promise<CareTeamEvent> {
  const snapshot = await getCareTeamSnapshot(10)
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
