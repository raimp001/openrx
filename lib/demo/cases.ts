// Seeded synthetic demo cases for the guided walkthrough. No real data.
//
// All three cases resolve on fully deterministic paths (prior-auth scenario
// builder, guideline engine, red-flag routing) — the model API is never
// required, so the demo completes even when the LLM is down or rate-limited.
// tests/e2e/demo-offline.spec.ts proves this with the model API mocked offline.

export type DemoCaseId = "prior-auth-denial" | "screening-recommendation" | "route-to-clinician"

export interface DemoWalkthroughCase {
  id: DemoCaseId
  title: string
  /** One line explaining what the engine is doing — the visible moat. */
  caption: string
  agentId: "prior-auth" | "screening"
  prompt: string
  /** Markers the deterministic response must contain (used by tests and the canary). */
  expectedMarkers: string[]
}

export const DEMO_WALKTHROUGH_CASES: DemoWalkthroughCase[] = [
  {
    id: "prior-auth-denial",
    title: "A denied prior authorization becomes an appeal-ready packet",
    caption:
      "Deterministic scenario engine: synthetic Tecvayli denial with a full document trail, public-source citations, and a simulated FHIR trace — no model improvisation.",
    agentId: "prior-auth",
    prompt: "Walk me through the denied Tecvayli (teclistamab) prior authorization.",
    expectedMarkers: ["Denial reason", "What to assemble", "FDA"],
  },
  {
    id: "screening-recommendation",
    title: "A minimal profile gets a version-stamped screening plan",
    caption:
      "Guideline engine: encoded USPSTF rules answer “age 45 male” with source, evidence grade, and a version stamp on every recommendation.",
    agentId: "screening",
    prompt: "age 45 male — what screening is due?",
    expectedMarkers: ["USPSTF", "Grade B", "Colorectal cancer screening"],
  },
  {
    id: "route-to-clinician",
    title: "A symptom signal routes to a clinician, not a checklist",
    caption:
      "Safety routing: a reported red flag (rectal bleeding) overrides routine screening logic and produces an urgent clinician-review row instead of an interval.",
    agentId: "screening",
    prompt: "I am 62 and I noticed rectal bleeding this week.",
    expectedMarkers: ["clinician", "Rectal bleeding"],
  },
]

export function getDemoWalkthroughCase(id: string): DemoWalkthroughCase | undefined {
  return DEMO_WALKTHROUGH_CASES.find((demoCase) => demoCase.id === id)
}
