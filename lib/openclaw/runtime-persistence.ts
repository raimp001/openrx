import { prisma } from "@/lib/db"

interface RecordCronRunInput {
  jobId: string
  sessionId: string
  requestedByUserId?: string
  requestedByRole: string
  authSource: string
  dryRun: boolean
  ok?: boolean | null
  failureReason?: string | null
  httpStatus?: number | null
  idempotencyKey?: string | null
  walletAddress?: string | null
  message: string
  triggeredAt: string
  responsePayload?: unknown
}

interface UpsertWorkerHeartbeatInput {
  workerId: string
  workerType?: string
  status: string
  metadata?: Record<string, unknown>
}

function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export async function recordCronRun(input: RecordCronRunInput): Promise<void> {
  if (!hasDatabase()) return
  try {
    await prisma.openClawCronRun.create({
      data: {
        jobId: input.jobId,
        sessionId: input.sessionId,
        requestedByUserId: input.requestedByUserId || null,
        requestedByRole: input.requestedByRole,
        authSource: input.authSource,
        dryRun: input.dryRun,
        ok: input.ok ?? null,
        failureReason: input.failureReason || null,
        httpStatus: input.httpStatus ?? null,
        idempotencyKey: input.idempotencyKey || null,
        walletAddress: input.walletAddress || null,
        message: input.message,
        triggeredAt: new Date(input.triggeredAt),
        responsePayload: input.responsePayload === undefined ? undefined : (input.responsePayload as never),
      },
    })
  } catch (error) {
    console.warn("Failed to persist cron run", error)
  }
}

export async function upsertWorkerHeartbeat(input: UpsertWorkerHeartbeatInput): Promise<void> {
  if (!hasDatabase()) return
  try {
    await prisma.openClawWorkerHeartbeat.upsert({
      where: { workerId: input.workerId },
      update: {
        workerType: input.workerType || "researcher-vm",
        status: input.status,
        metadata: input.metadata as never,
        lastSeenAt: new Date(),
      },
      create: {
        workerId: input.workerId,
        workerType: input.workerType || "researcher-vm",
        status: input.status,
        metadata: input.metadata as never,
        lastSeenAt: new Date(),
      },
    })
  } catch (error) {
    console.warn("Failed to persist worker heartbeat", error)
  }
}

export async function listWorkerHeartbeats(limit = 20) {
  if (!hasDatabase()) return []
  try {
    return await prisma.openClawWorkerHeartbeat.findMany({
      orderBy: { lastSeenAt: "desc" },
      take: Math.max(1, limit),
    })
  } catch (error) {
    console.warn("Failed to load worker heartbeats", error)
    return []
  }
}

export async function listRecentCronRuns(limit = 50) {
  if (!hasDatabase()) return []
  try {
    return await prisma.openClawCronRun.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.max(1, limit),
    })
  } catch (error) {
    console.warn("Failed to load recent cron runs", error)
    return []
  }
}
