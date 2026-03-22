import { NextRequest, NextResponse } from "next/server"
import { resolveClinicSession } from "@/lib/clinic-auth"
import { findCareTeamRequest, getCareTeamSnapshot } from "@/lib/care-team/store"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (!session.canAccessCareTeam) {
    return NextResponse.json(
      {
        needsInputCount: 0,
        request: null,
      },
      { status: 200 }
    )
  }

  const { searchParams } = new URL(request.url)
  const requestId = (searchParams.get("requestId") || "").trim()
  const limitRaw = Number.parseInt(searchParams.get("limit") || "30", 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30

  const snapshot = await getCareTeamSnapshot(20)
  const requestItem = requestId ? await findCareTeamRequest(requestId) : null

  return NextResponse.json({
    needsInputCount: snapshot.needsInputCount,
    requests: snapshot.openRequests.slice(0, limit),
    request: requestItem,
    agents: snapshot.agents,
    lastUpdated: snapshot.lastUpdated,
  })
}
