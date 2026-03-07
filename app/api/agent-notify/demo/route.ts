import { NextRequest, NextResponse } from "next/server"
import { resolveClinicSession } from "@/lib/clinic-auth"
import { buildCareTeamEvent, submitHumanInputRequest } from "@/lib/care-team/store"
import { publishCareTeamEvent } from "@/lib/care-team/realtime"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (!(session.role === "admin" || session.role === "staff")) {
    return NextResponse.json({ error: "Only clinic staff/admin can run demo." }, { status: 403 })
  }

  const now = new Date().toISOString()
  const requestRecord = submitHumanInputRequest({
    payload: {
      agent_id: "prior-auth",
      agent_name: "Rex Prior Auth",
      status: "needs_input",
      timestamp: now,
      context: {
        patient_id_hash: "1d7dc35f2ea1ed28e0f1325a6fb7a87c462c2f29aeec9f5f1b2f79ea9f8cf22e",
        workflow: "prior_auth",
        reason: "Prior auth denial exception requires MD review.",
        suggested_action: "Review denial packet and approve expedited appeal.",
        confidence_score: 0.78,
        document_snapshot_hash: "182f8f8ca9e8f07ff9d6a0e5f7df87ca2f8f4d6758f2bf3ee9f1fdb95ec8d5a6",
        browser_url: "https://payer-portal.example.com/pa/denial-review",
      },
    },
    actor: { role: session.role, userId: session.userId },
  })

  const event = buildCareTeamEvent({
    type: "request_created",
    request: requestRecord.request,
    agent: requestRecord.agent,
  })
  publishCareTeamEvent(event)

  return NextResponse.json({
    ok: true,
    message: "Demo notification triggered.",
    request: requestRecord.request,
  })
}
