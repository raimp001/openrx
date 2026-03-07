import { NextRequest, NextResponse } from "next/server"
import { resolveClinicSession } from "@/lib/clinic-auth"
import {
  buildCareTeamEvent,
  consumeCareTeamRateLimit,
  getCareTeamSnapshot,
  submitHumanInputRequest,
  updateAgentStatus,
} from "@/lib/care-team/store"
import { publishCareTeamEvent } from "@/lib/care-team/realtime"
import type { AgentNotifyPayload } from "@/lib/care-team/types"

export const runtime = "nodejs"

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for") || ""
  const first = forwarded.split(",")[0]?.trim()
  if (first) return first
  return request.headers.get("x-real-ip") || "local"
}

function isValidStatus(value: string): value is AgentNotifyPayload["status"] {
  return value === "running" || value === "paused" || value === "needs_input"
}

export async function GET(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (!session.canAccessCareTeam) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const snapshot = getCareTeamSnapshot(50)
  return NextResponse.json({
    session: {
      role: session.role,
      userId: session.userId,
      canAccessCareTeam: session.canAccessCareTeam,
      authSource: session.authSource,
    },
    snapshot,
  })
}

export async function POST(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (!session.canAccessCareTeam) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const ip = getClientIp(request)
  const limit = consumeCareTeamRateLimit({
    key: `notify:${ip}`,
    limit: 80,
    windowMs: 60 * 1000,
  })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded.", retryAfterMs: limit.retryAfterMs },
      {
        status: 429,
        headers: limit.retryAfterMs
          ? {
              "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)),
            }
          : undefined,
      }
    )
  }

  try {
    const payload = (await request.json()) as AgentNotifyPayload

    if (!payload.agent_id?.trim() || !payload.agent_name?.trim()) {
      return NextResponse.json({ error: "agent_id and agent_name are required." }, { status: 400 })
    }
    if (!isValidStatus(payload.status)) {
      return NextResponse.json({ error: "status must be running, paused, or needs_input." }, { status: 400 })
    }

    if (payload.status === "needs_input") {
      if (!payload.context) {
        return NextResponse.json({ error: "context is required when status is needs_input." }, { status: 400 })
      }

      const result = submitHumanInputRequest({
        payload,
        actor: { role: session.role, userId: session.userId },
      })
      const event = buildCareTeamEvent({ type: "request_created", request: result.request, agent: result.agent })
      publishCareTeamEvent(event)

      return NextResponse.json({ request: result.request, agent: result.agent, event }, { status: 201 })
    }

    const result = updateAgentStatus({
      agentId: payload.agent_id,
      agentName: payload.agent_name,
      status: payload.status,
      actor: { role: session.role, userId: session.userId },
    })
    const event = buildCareTeamEvent({ type: "agent_status", agent: result.agent })
    publishCareTeamEvent(event)

    return NextResponse.json({ agent: result.agent, event })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process notification."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
