import { NextRequest, NextResponse } from "next/server"
import { resolveClinicSession } from "@/lib/clinic-auth"
import { buildCareTeamEvent, createCustomAgent, getCareTeamSnapshot } from "@/lib/care-team/store"
import { publishCareTeamEvent } from "@/lib/care-team/realtime"
import type { CareTeamCustomAgentInput } from "@/lib/care-team/types"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (!session.canAccessCareTeam) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const snapshot = getCareTeamSnapshot(10)
  return NextResponse.json({ agents: snapshot.agents })
}

export async function POST(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (!(session.role === "admin" || session.role === "staff")) {
    return NextResponse.json({ error: "Only clinic staff/admin can create agents." }, { status: 403 })
  }

  try {
    const payload = (await request.json()) as CareTeamCustomAgentInput
    if (!payload.name?.trim() || !payload.role?.trim()) {
      return NextResponse.json({ error: "name and role are required." }, { status: 400 })
    }

    const result = createCustomAgent({
      payload,
      actor: { role: session.role, userId: session.userId },
    })

    const event = buildCareTeamEvent({ type: "agent_status", agent: result.agent })
    publishCareTeamEvent(event)

    return NextResponse.json({ agent: result.agent, event }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create agent."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
