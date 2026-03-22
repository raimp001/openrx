import { NextRequest, NextResponse } from "next/server"
import { resolveClinicSession } from "@/lib/clinic-auth"
import { listWorkerHeartbeats, upsertWorkerHeartbeat } from "@/lib/openclaw/runtime-persistence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function isAuthorized(authSource: string): boolean {
  return authSource === "admin_api_key" || authSource === "agent_token"
}

export async function GET(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (!isAuthorized(session.authSource)) {
    return NextResponse.json({ error: "Unauthorized worker heartbeat request." }, { status: 401 })
  }

  const workers = await listWorkerHeartbeats(50)
  return NextResponse.json({
    ok: true,
    workers,
    requestedBy: {
      userId: session.userId,
      role: session.role,
      authSource: session.authSource,
    },
  })
}

export async function POST(request: NextRequest) {
  const session = await resolveClinicSession(request)
  if (!isAuthorized(session.authSource)) {
    return NextResponse.json({ error: "Unauthorized worker heartbeat request." }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      workerId?: string
      workerType?: string
      status?: string
      metadata?: Record<string, unknown>
    }

    const workerId = (body.workerId || "").trim()
    const status = (body.status || "").trim() || "running"
    if (!workerId) {
      return NextResponse.json({ error: "workerId is required." }, { status: 400 })
    }

    await upsertWorkerHeartbeat({
      workerId,
      workerType: (body.workerType || "").trim() || "researcher-vm",
      status,
      metadata: body.metadata || {},
    })

    return NextResponse.json({
      ok: true,
      workerId,
      status,
      workerType: (body.workerType || "").trim() || "researcher-vm",
      recordedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record worker heartbeat."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
