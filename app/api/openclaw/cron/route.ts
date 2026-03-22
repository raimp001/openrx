import { NextRequest, NextResponse } from "next/server"
import { resolveClinicSession } from "@/lib/clinic-auth"
import { buildCronAgentMessage, listCronJobs } from "@/lib/openclaw/cron-dispatch"
import { listRecentCronRuns, listWorkerHeartbeats } from "@/lib/openclaw/runtime-persistence"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function authorizeBackgroundRequest(request: NextRequest) {
  const session = await resolveClinicSession(request)
  const authorized =
    session.authSource === "admin_api_key" ||
    session.authSource === "agent_token" ||
    (process.env.NODE_ENV !== "production" && session.authSource === "default")

  return { session, authorized }
}

export async function GET(request: NextRequest) {
  const { session, authorized } = await authorizeBackgroundRequest(request)

  if (!authorized) {
    return NextResponse.json(
      { error: "Unauthorized background job request." },
      { status: 401 }
    )
  }

  const [recentRuns, workers] = await Promise.all([
    listRecentCronRuns(12),
    listWorkerHeartbeats(12),
  ])

  const jobs = listCronJobs().map((job) => ({
    ...job,
    previewMessage: buildCronAgentMessage(job),
  }))

  return NextResponse.json({
    ok: true,
    jobs,
    total: jobs.length,
    maxDurationSeconds: maxDuration,
    recentRuns,
    workers,
    requestedBy: {
      userId: session.userId,
      role: session.role,
      authSource: session.authSource,
    },
  })
}
