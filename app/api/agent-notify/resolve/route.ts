import { NextRequest, NextResponse } from "next/server"
import { resolveClinicSession } from "@/lib/clinic-auth"
import { buildCareTeamEvent, resolveHumanInputRequest } from "@/lib/care-team/store"
import { publishCareTeamEvent } from "@/lib/care-team/realtime"
import type { CareTeamResolveInput } from "@/lib/care-team/types"

export const runtime = "nodejs"

function isValidDecision(value: string): value is CareTeamResolveInput["decision"] {
  return value === "approve" || value === "reject" || value === "edit"
}

export async function POST(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (!session.canAccessCareTeam) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  try {
    const payload = (await request.json()) as CareTeamResolveInput

    if (!payload.requestId?.trim() || !payload.decision || !isValidDecision(payload.decision)) {
      return NextResponse.json({ error: "requestId and a valid decision are required." }, { status: 400 })
    }

    const result = resolveHumanInputRequest({
      actor: { role: session.role, userId: session.userId },
      payload,
    })

    const event = buildCareTeamEvent({
      type: "request_resolved",
      request: result.request,
      agent: result.agent,
    })
    publishCareTeamEvent(event)

    return NextResponse.json({ request: result.request, agent: result.agent, event })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve request."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
