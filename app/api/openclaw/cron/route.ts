import { NextRequest, NextResponse } from "next/server"
import { resolveClinicSession } from "@/lib/clinic-auth"
import {
  buildCronAgentMessage,
  listCronJobs,
  listDueCronJobs,
  normalizeTriggeredAt,
} from "@/lib/openclaw/cron-dispatch"
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

  const search = request.nextUrl.searchParams
  const dueOnly = search.get("dueOnly") === "true"
  const at = normalizeTriggeredAt(search.get("at") || undefined)
  const [recentRuns, workers] = await Promise.all([
    listRecentCronRuns(12),
    listWorkerHeartbeats(12),
  ])

  const jobs = (dueOnly ? listDueCronJobs(new Date(at.effectiveIso)) : listCronJobs()).map((job) => ({
    ...job,
    previewMessage: buildCronAgentMessage(job),
  }))

  return NextResponse.json({
    ok: true,
    jobs,
    total: jobs.length,
    dueOnly,
    evaluatedAt: at.effectiveIso,
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
