import { NextRequest, NextResponse } from "next/server"
import { resolveClinicSession } from "@/lib/clinic-auth"
import { getCareTeamSnapshot } from "@/lib/care-team/store"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const session = await resolveClinicSession(request)
  const snapshot = session.canAccessCareTeam ? await getCareTeamSnapshot(10) : null

  return NextResponse.json({
    role: session.role,
    userId: session.userId,
    canAccessCareTeam: session.canAccessCareTeam,
    authSource: session.authSource,
    needsInputCount: snapshot?.needsInputCount || 0,
  })
}
