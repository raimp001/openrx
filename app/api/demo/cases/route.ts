import { NextResponse } from "next/server"
import { DEMO_WALKTHROUGH_CASES, type DemoWalkthroughCase } from "@/lib/demo/cases"
import { getDemoScenario } from "@/lib/demo/prior-auth"
import { buildDeterministicPriorAuthResponse, buildDeterministicScreeningResponse } from "@/lib/ai-engine"
import { deterministicClinicalResponse } from "@/lib/openclaw/deterministic-clinical"

export const dynamic = "force-dynamic"

// Cached fallback rendering per case: produced by the deterministic builders,
// so it is identical whether the model API is up or down.
function cachedRendering(demoCase: DemoWalkthroughCase): string {
  if (demoCase.agentId === "prior-auth") {
    const scenario = getDemoScenario("teclistamab-rrmm")
    return scenario ? buildDeterministicPriorAuthResponse(scenario) : ""
  }
  return deterministicClinicalResponse(demoCase.prompt) ?? buildDeterministicScreeningResponse(demoCase.prompt)
}

export async function GET() {
  return NextResponse.json({
    sandbox: true,
    cases: DEMO_WALKTHROUGH_CASES.map((demoCase) => ({
      ...demoCase,
      cachedRendering: cachedRendering(demoCase),
    })),
  })
}
