import { NextRequest, NextResponse } from "next/server"
import { getCallProvider } from "@/lib/clinician-calls/provider"
import { normalizePhone } from "@/lib/clinician-calls/utils"
import type { CallSessionRequest } from "@/lib/clinician-calls/types"

export const runtime = "nodejs"

// In-memory rate limiter — enough to slow down accidental loops in dev.
// Production must use a distributed limiter and abuse-detection pipeline.
const rateState = new Map<string, { count: number; resetAt: number }>()

function rateLimit(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now()
  const current = rateState.get(key)
  if (!current || current.resetAt < now) {
    rateState.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (current.count >= limit) return false
  current.count += 1
  return true
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for") || ""
  return forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local"
}

export async function GET() {
  const provider = getCallProvider()
  const capabilities = provider.capabilities()
  const recent = await provider.listRecent(20)
  return NextResponse.json({
    provider: provider.key,
    capabilities,
    recent,
  })
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateLimit(`call-start:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many call requests. Slow down." }, { status: 429 })
  }

  let body: Partial<CallSessionRequest>
  try {
    body = (await request.json()) as Partial<CallSessionRequest>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  if (!body.patientRef?.trim()) {
    return NextResponse.json({ error: "patientRef is required." }, { status: 400 })
  }
  if (!body.reason?.trim()) {
    return NextResponse.json({ error: "reason is required." }, { status: 400 })
  }
  if (!body.consentAttested) {
    return NextResponse.json({ error: "Patient consent must be attested." }, { status: 400 })
  }
  const phone = normalizePhone(body.patientPhone || "")
  if (!phone) {
    return NextResponse.json({ error: "Patient phone must be valid E.164 (e.g. +15551234567)." }, { status: 400 })
  }

  const provider = getCallProvider()
  const capabilities = provider.capabilities()

  // When live calling is disabled, we still create a mock session so the UI can
  // demonstrate documentation and follow-through. We surface the disabled state
  // explicitly in the response so the client can show a "demo only" banner.
  try {
    const session = await provider.startCall({
      patientRef: body.patientRef,
      patientDisplayName: body.patientDisplayName,
      patientPhone: phone.e164,
      consentAttested: true,
      reason: body.reason,
      callerIdLabel: body.callerIdLabel,
      recordCall: Boolean(body.recordCall),
    })
    return NextResponse.json(
      {
        session,
        liveCallingEnabled: capabilities.liveCallingEnabled,
        demoMode: !capabilities.liveCallingEnabled,
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start call."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
