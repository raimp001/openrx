import { NextRequest, NextResponse } from "next/server"
import { runAgent } from "@/lib/ai-engine"
import { resolveClinicSession } from "@/lib/clinic-auth"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"

interface CronRequestBody {
  message?: string
  sessionId?: string
  walletAddress?: string
}

function buildScheduledMessage(jobId: string, description: string, override?: string) {
  if (override && override.trim()) {
    return override.trim()
  }

  return [
    `Execute the OpenRx scheduled background job "${jobId}".`,
    description,
    "Work only within your agent role, summarize actions taken, and explicitly call out blockers or required human follow-up.",
  ].join(" ")
}

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

  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "OpenClaw AI service is unavailable. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
      },
      { status: 503 }
    )
  }

  const jobId = decodeURIComponent(params.jobId || "")
  const job = OPENCLAW_CONFIG.cronJobs.find((item) => item.id === jobId)

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

  const message = buildScheduledMessage(job.id, job.description, body.message)
  const sessionId = body.sessionId || `cron-${job.id}-${Date.now()}`

  const result = await runAgent({
    agentId: job.agentId,
    message,
    sessionId,
    walletAddress: body.walletAddress,
  })

  return NextResponse.json({
    job,
    sessionId,
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
    live: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
  })
}
