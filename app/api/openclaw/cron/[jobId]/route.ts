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
import { recordCronRun } from "@/lib/openclaw/runtime-persistence"

interface CronRequestBody {
  message?: string
  sessionId?: string
  walletAddress?: string
  dryRun?: boolean
  triggeredAt?: string
  idempotencyKey?: string
}

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
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

  const jobId = decodeURIComponent(params.jobId || "")
  const job = getCronJob(jobId)

  if (!job) {
    return NextResponse.json(
      { error: `Unknown cron job "${jobId}".` },
      { status: 404 }
    )
  }

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

  const triggeredAt = normalizeTriggeredAt(body.triggeredAt)
  const message = buildCronAgentMessage(job, {
    override: body.message,
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
      walletAddress: body.walletAddress || null,
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
        "OpenClaw AI service is unavailable. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
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
      walletAddress: body.walletAddress || null,
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
    sideEffectsExecuted: false
    handoff: { requested: string | null; executed: false }
    idempotency: { key: string | null; status: string }
    maxDurationSeconds: number
  }>(job.id, body.idempotencyKey)

  if (cached) {
    await recordCronRun({
      jobId: job.id,
      sessionId: cached.sessionId,
      requestedByUserId: session.userId,
      requestedByRole: session.role,
      authSource: session.authSource,
      dryRun: false,
      ok: cached.ok,
      failureReason: cached.failureReason,
      httpStatus: cached.ok ? 200 : 503,
      idempotencyKey: body.idempotencyKey || null,
      walletAddress: body.walletAddress || null,
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
      { status: cached.ok ? 200 : 503 }
    )
  }

  const sessionId = body.sessionId || `cron-${job.id}-${Date.now()}`

  const result = await runAgent({
    agentId: job.agentId,
    message,
    sessionId,
    walletAddress: body.walletAddress,
  })

  const classification = classifyCronAgentResult(result)

  const payload = {
    ok: classification.ok,
    failureReason: classification.failureReason,
    dryRun: false,
    providerCalled: true,
    sideEffectsExecuted: false,
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
    ok: payload.ok,
    failureReason: payload.failureReason,
    httpStatus: classification.httpStatus,
    idempotencyKey: body.idempotencyKey || null,
    walletAddress: body.walletAddress || null,
    message,
    triggeredAt: triggeredAt.effectiveIso,
    responsePayload: payload,
  })

  return NextResponse.json(payload, {
    status: classification.httpStatus,
  })
}
