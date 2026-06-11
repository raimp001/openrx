import { describe, expect, it } from "vitest"
import { buildDeterministicScreeningResponse } from "@/lib/ai-engine"

describe("screening answers actively gather missing risk factors", () => {
  it("an age/sex-only profile is asked about family history, smoking, and prior screenings", () => {
    const response = buildDeterministicScreeningResponse("I am a 45 year old man, what screening is due?")
    expect(response).toContain("Question to refine this")
    expect(response).toMatch(/family history of cancer/i)
    expect(response).toMatch(/smoking history/i)
    expect(response).toMatch(/screening tests and dates/i)
  })

  it("reported family history is not asked for again, but smoking still is", () => {
    const response = buildDeterministicScreeningResponse("I am 45 male, my father had colon cancer at age 48")
    expect(response).not.toMatch(/share any that apply: family history/i)
    // Family-history cases route to the clinician-review follow-up instead.
    expect(response).toMatch(/family diagnosis ages|smoking/i)
  })

  it("the follow-up answer with risk factors produces the richer plan", () => {
    const response = buildDeterministicScreeningResponse(
      "I am a 60 year old man, current smoker with 30 pack-years, father had colon cancer at age 48."
    )
    expect(response).toContain("Low-dose CT lung cancer screening")
    expect(response).toContain("Colonoscopy and GI review")
  })
})

describe("risk-factor replies continue the screening conversation", () => {
  it("a smoking follow-up after a deterministic screening answer yields LDCT guidance", async () => {
    const { recordAgentExchange, runAgent } = await import("@/lib/ai-engine")
    const sessionId = `follow-up-test-${Date.now()}`
    recordAgentExchange({
      agentId: "coordinator",
      sessionId,
      userMessage: "age 60 male",
      assistantMessage: "Answer\nThese guideline-backed screenings apply to the profile provided.\nDue now\n- Colorectal cancer screening (due)...",
    })

    const result = await runAgent({
      agentId: "coordinator",
      message: "I smoke, about 30 pack-years",
      sessionId,
    })

    expect(result.agentId).toBe("screening")
    expect(result.response).toContain("Low-dose CT lung cancer screening")
  })
})

describe("stateless follow-up (serverless: no shared memory between turns)", () => {
  it("client-carried context turns a risk-factor reply into the richer plan on a cold instance", async () => {
    const { runAgent } = await import("@/lib/ai-engine")
    const result = await runAgent({
      agentId: "coordinator",
      message: "I smoke, about 30 pack-years",
      screeningContext: "age 60 male\nI smoke, about 30 pack-years",
      sessionId: `stateless-${Date.now()}`,
    })

    expect(result.agentId).toBe("screening")
    expect(result.response).toContain("Low-dose CT lung cancer screening")
  })
})
