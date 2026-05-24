import { NextRequest, NextResponse } from "next/server"
import {
  appealResponse,
  evidenceResponse,
  fhirSubmissionResponse,
  getDemoScenario,
  type DemoAction,
} from "@/lib/demo/prior-auth"

const VALID_ACTIONS: DemoAction[] = ["retrieve_evidence", "draft_appeal", "submit_fhir"]

export async function POST(req: NextRequest) {
  let payload: { action?: string; scenarioId?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const scenario = typeof payload.scenarioId === "string" ? getDemoScenario(payload.scenarioId) : undefined
  if (!scenario) {
    return NextResponse.json({ error: "Unknown demo scenario." }, { status: 404 })
  }

  if (!payload.action || !VALID_ACTIONS.includes(payload.action as DemoAction)) {
    return NextResponse.json({ error: "Unknown demo action." }, { status: 400 })
  }

  switch (payload.action as DemoAction) {
    case "retrieve_evidence":
      return NextResponse.json(evidenceResponse(scenario))
    case "draft_appeal":
      return NextResponse.json(appealResponse(scenario))
    case "submit_fhir":
      return NextResponse.json(fhirSubmissionResponse(scenario))
  }
}
