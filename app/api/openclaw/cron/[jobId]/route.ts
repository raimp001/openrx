import { NextRequest, NextResponse } from "next/server"
import { runAgent } from "@/lib/ai-engine"
import { resolveClinicSession } from "@/lib/clinic-auth"
import {
  buildCronAgentMessage,
  classifyCronAgentResult,
  getCronJob,
  normalizeTriggeredAt,
  readCronIdempotency,
  writeCronIdempotency,
} from "@/lib/openclaw/cron-dispatch"
import { recordCronRun, upsertWorkerHeartbeat } from "@/lib/openclaw/runtime-persistence"
import { executeCronSideEffects } from "@/lib/openclaw/cron-side-effects"

interface CronRequestBody {
  message?: string
  sessionId?: string
  walletAddress?: string
  dryRun?: boolean
  triggeredAt?: string
  idempotencyKey?: string
  workerId?: string
  workerType?: string
}

export const dynamic = "force-dynamic"
export const maxDuration = 60

function parseBoolean(value: string | null): boolean | undefined {
  if (value == null || value === "") return undefined
  const normalized = value.trim().toLowerCase()
  if (["1", "true", "yes"].includes(normalized)) return true
  if (["0", "false", "no"].includes(normalized)) return false
  return undefined
}

function getDefaultWorkerId(jobId: string): string {
  return process.env.OPENRX_WORKER_ID?.trim() || `vercel-cron-${jobId}`
}

async function maybeRecordWorkerHeartbeat(
  body: CronRequestBody,
  jobId: string,
  authSource: string
) {
  if (!(authSource === "agent_token" || authSource === "admin_api_key")) return
  if (body.dryRun) return

  const configuredWorkerId = body.workerId?.trim() || process.env.OPENRX_WORKER_ID?.trim()
  if (!configuredWorkerId) return

  const workerId = configuredWorkerId || getDefaultWorkerId(jobId)
  const workerType = (body.workerType || "").trim() || "vercel-cron"

  await upsertWorkerHeartbeat({
    workerId,
    workerType,
    status: "running",
    metadata: {
      lastJobId: jobId,
      lastTriggerSource: authSource,
      recordedAt: new Date().toISOString(),
    },
  })
}

async function executeCronRequest(
  request: NextRequest,
  jobIdParam: string,
  body: CronRequestBody
) {
  const session = await resolveClinicSession(request)
  const authorized =
    session.authSource === "admin_api_key" ||
    session.authSource === "agent_token" ||
    (process.env.NODE_ENV !== "production" && session.authSource === "default")

  if (!authorized) {
    return NextResponse.json(
      { error: "Unauthorized background job request." },
      { status: 401 }
    )
  }

  const jobId = decodeURIComponent(jobIdParam || "")
  const job = getCronJob(jobId)

  if (!job) {
    return NextResponse.json(
      { error: `Unknown cron job "${jobId}".` },
      { status: 404 }
    )
  }

  await maybeRecordWorkerHeartbeat(body, job.id, session.authSource)

  const allowRequestScopedOverrides =
    session.authSource === "admin_api_key" ||
    (process.env.NODE_ENV !== "production" && session.authSource === "default")
  const messageOverride = allowRequestScopedOverrides ? body.message : undefined
  const walletAddress = allowRequestScopedOverrides ? body.walletAddress : undefined
  const triggeredAt = normalizeTriggeredAt(body.triggeredAt)
  const message = buildCronAgentMessage(job, {
    override: messageOverride,
    triggeredAt: triggeredAt.effectiveIso,
  })

  if (body.dryRun) {
    const payload = {
      ok: true,
      dryRun: true,
      providerCalled: false,
      sideEffectsExecuted: false,
      job,
      message,
      triggeredAt,
      handoff: {
        requested: null,
        executed: false,
      },
      idempotency: {
        key: body.idempotencyKey || null,
        status: body.idempotencyKey ? "preview_only" : "none",
      },
      requestedBy: {
        userId: session.userId,
        role: session.role,
        authSource: session.authSource,
      },
    }
    await recordCronRun({
      jobId: job.id,
      sessionId: body.sessionId || `cron-${job.id}-preview`,
      requestedByUserId: session.userId,
      requestedByRole: session.role,
      authSource: session.authSource,
      dryRun: true,
      ok: true,
      httpStatus: 200,
      idempotencyKey: body.idempotencyKey || null,
      walletAddress: walletAddress || null,
      message,
      triggeredAt: triggeredAt.effectiveIso,
      responsePayload: payload,
    })
    return NextResponse.json(payload)
  }

  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    const payload = {
      ok: false,
      failureReason: "missing_model_credentials",
      error:
        "AI service is unavailable. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
    }
    await recordCronRun({
      jobId: job.id,
      sessionId: body.sessionId || `cron-${job.id}-missing-creds`,
      requestedByUserId: session.userId,
      requestedByRole: session.role,
      authSource: session.authSource,
      dryRun: false,
      ok: false,
      failureReason: payload.failureReason,
      httpStatus: 503,
      idempotencyKey: body.idempotencyKey || null,
      walletAddress: walletAddress || null,
      message,
      triggeredAt: triggeredAt.effectiveIso,
      responsePayload: payload,
    })
    return NextResponse.json(payload, { status: 503 })
  }

  const cached = readCronIdempotency<{
    ok: boolean
    failureReason: string | null
    job: typeof job
    message: string
    result: { response: string; agentId: string; handoff: string | null }
    requestedBy: { userId: string; role: string; authSource: string }
    sessionId: string
    triggeredAt: ReturnType<typeof normalizeTriggeredAt>
    dryRun: false
    live: boolean
    providerCalled: true
    sideEffectsExecuted: boolean
    sideEffects: {
      notificationsCreated: number
      emailsSent: number
      deployTriggered: boolean
      summaries: string[]
      warnings: string[]
    }
    handoff: { requested: string | null; executed: false }
    idempotency: { key: string | null; status: string }
    maxDurationSeconds: number
  }>(job.id, body.idempotencyKey)

  if (cached) {
    const replayStatus =
      cached.failureReason === "side_effect_failed" ? 502 : cached.ok ? 200 : 503
    await recordCronRun({
      jobId: job.id,
      sessionId: cached.sessionId,
      requestedByUserId: session.userId,
      requestedByRole: session.role,
      authSource: session.authSource,
      dryRun: false,
      ok: cached.ok,
      failureReason: cached.failureReason,
      httpStatus: replayStatus,
      idempotencyKey: body.idempotencyKey || null,
      walletAddress: walletAddress || null,
      message,
      triggeredAt: triggeredAt.effectiveIso,
      responsePayload: {
        ...cached,
        idempotency: {
          key: body.idempotencyKey || null,
          status: "replayed",
        },
      },
    })
    return NextResponse.json(
      {
        ...cached,
        idempotency: {
          key: body.idempotencyKey || null,
          status: "replayed",
        },
      },
      { status: replayStatus }
    )
  }

  const sessionId = body.sessionId || `cron-${job.id}-${Date.now()}`

  const result = await runAgent({
    agentId: job.agentId,
    message,
    sessionId,
    walletAddress,
  })

  const classification = classifyCronAgentResult(result)
  const sideEffects = classification.ok
    ? await executeCronSideEffects({
        job,
        sessionId,
        triggeredAtIso: triggeredAt.effectiveIso,
        agentResponse: result.response,
      })
    : {
        executed: false,
        failed: false,
        notificationsCreated: 0,
        emailsSent: 0,
        deployTriggered: false,
        summaries: [] as string[],
        warnings: [] as string[],
      }

  const ok = classification.ok && !sideEffects.failed
  const failureReason = classification.failureReason || (sideEffects.failed ? "side_effect_failed" : null)
  const httpStatus = sideEffects.failed ? 502 : classification.httpStatus

  const payload = {
    ok,
    failureReason,
    dryRun: false,
    providerCalled: true,
    sideEffectsExecuted: sideEffects.executed,
    sideEffects: {
      notificationsCreated: sideEffects.notificationsCreated,
      emailsSent: sideEffects.emailsSent,
      deployTriggered: sideEffects.deployTriggered,
      summaries: sideEffects.summaries,
      warnings: sideEffects.warnings,
    },
    job,
    message,
    sessionId,
    triggeredAt,
    requestedBy: {
      userId: session.userId,
      role: session.role,
      authSource: session.authSource,
    },
    result: {
      response: result.response,
      agentId: result.agentId,
      handoff: result.handoff || null,
    },
    handoff: {
      requested: result.handoff || null,
      executed: false as const,
    },
    idempotency: {
      key: body.idempotencyKey || null,
      status: body.idempotencyKey ? "stored" : "none",
    },
    live: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    maxDurationSeconds: maxDuration,
  }

  writeCronIdempotency(job.id, body.idempotencyKey, payload)
  await recordCronRun({
    jobId: job.id,
    sessionId,
    requestedByUserId: session.userId,
    requestedByRole: session.role,
    authSource: session.authSource,
    dryRun: false,
    ok,
    failureReason,
    httpStatus,
    idempotencyKey: body.idempotencyKey || null,
    walletAddress: walletAddress || null,
    message,
    triggeredAt: triggeredAt.effectiveIso,
    responsePayload: payload,
  })

  return NextResponse.json(payload, {
    status: httpStatus,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  let body: CronRequestBody = {}
  try {
    const raw = await request.text()
    body = raw ? (JSON.parse(raw) as CronRequestBody) : {}
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    )
  }

  try {
    return await executeCronRequest(request, params.jobId, body)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected background job failure."
    return NextResponse.json(
      { ok: false, failureReason: "unhandled_error", error: message },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const search = request.nextUrl.searchParams
  const body: CronRequestBody = {
    message: search.get("message") || undefined,
    sessionId: search.get("sessionId") || undefined,
    walletAddress: search.get("walletAddress") || undefined,
    dryRun: parseBoolean(search.get("dryRun")),
    triggeredAt: search.get("triggeredAt") || undefined,
    idempotencyKey: search.get("idempotencyKey") || undefined,
    workerId: search.get("workerId") || undefined,
    workerType: search.get("workerType") || undefined,
  }
  try {
    return await executeCronRequest(request, params.jobId, body)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected background job failure."
    return NextResponse.json(
      { ok: false, failureReason: "unhandled_error", error: message },
      { status: 500 }
    )
  }
}
