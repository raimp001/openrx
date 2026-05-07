import { NextRequest, NextResponse } from "next/server"
import { getCallProvider } from "@/lib/clinician-calls/provider"
import type { CallNextStep, CallOutcome } from "@/lib/clinician-calls/types"

export const runtime = "nodejs"

const VALID_OUTCOMES: CallOutcome[] = [
  "reached_patient",
  "left_voicemail",
  "no_answer",
  "wrong_number",
  "needs_callback",
  "patient_declined",
  "abandoned",
]

const VALID_NEXT_STEPS: CallNextStep[] = [
  "schedule_appointment",
  "order_screening_study",
  "send_instructions",
  "route_to_care_team",
  "create_reminder",
  "refer_specialist",
  "no_action",
]

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const provider = getCallProvider()
  const session = await provider.getCall(params.id)
  if (!session) return NextResponse.json({ error: "Call session not found." }, { status: 404 })
  return NextResponse.json({ session })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const provider = getCallProvider()
  let body: { action?: string; outcome?: string; notes?: string; nextSteps?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  if (body.action === "end") {
    try {
      const session = await provider.endCall(params.id)
      return NextResponse.json({ session })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to end call."
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  if (body.action === "document") {
    if (!body.outcome || !VALID_OUTCOMES.includes(body.outcome as CallOutcome)) {
      return NextResponse.json({ error: "Invalid outcome." }, { status: 400 })
    }
    const nextSteps = (body.nextSteps || []).filter((step): step is CallNextStep =>
      VALID_NEXT_STEPS.includes(step as CallNextStep)
    )
    try {
      const session = await provider.documentCall({
        sessionId: params.id,
        outcome: body.outcome as CallOutcome,
        notes: body.notes,
        nextSteps,
      })
      return NextResponse.json({ session })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to document call."
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
