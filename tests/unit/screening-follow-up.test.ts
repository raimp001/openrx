import { describe, expect, it } from "vitest"
import { buildDeterministicScreeningResponse } from "@/lib/ai-engine"

describe("screening answers actively gather missing risk factors", () => {
  it("an age/sex-only profile is asked about family history, smoking, and prior screenings", () => {
    const response = buildDeterministicScreeningResponse("I am a 45 year old man, what screening is due?")
    expect(response).toContain("Questions that could change this plan")
    expect(response).toMatch(/you or any close blood relative had cancer/i)
    expect(response).toMatch(/colonoscopy, FIT\/stool testing/i)
    expect(response).toContain("Colorectal cancer screening")
    expect(response).toMatch(/current due status cannot be settled yet/i)
  })

  it("reported family history is not asked for again, but smoking still is", () => {
    const response = buildDeterministicScreeningResponse("I am 45 male, my father had colon cancer at age 48")
    expect(response).not.toMatch(/exact relationship, cancer type, and age/i)
    expect(response).toMatch(/ever been diagnosed with cancer/i)
    expect(response).toMatch(/prior colonoscopy|colorectal test/i)
  })

  it("the follow-up answer with risk factors produces the richer plan", () => {
    const response = buildDeterministicScreeningResponse(
      "I am a 60 year old man, current smoker with 30 pack-years, father had colon cancer at age 48."
    )
    expect(response).toContain("Low-dose CT lung cancer screening")
    expect(response).toContain("Colonoscopy and GI review")
  })

  it("explicit negative history resolves uncertainty and marks never-screened colorectal care as due", () => {
    const response = buildDeterministicScreeningResponse(
      "I am 45 male. No personal history of cancer, no family history of cancer, and I have never had colorectal screening."
    )
    expect(response).toContain("Colorectal cancer screening (due)")
    expect(response).not.toContain("Questions that could change this plan")
    expect(response).not.toContain("Cancer follow-up plan")
  })

  it("vague personal cancer history asks for diagnosis, treatment, and surveillance details", () => {
    const response = buildDeterministicScreeningResponse("I am 62 male with hx cancer")
    expect(response).toContain("Cancer follow-up plan")
    expect(response).toMatch(/what cancer was diagnosed/i)
    expect(response).toMatch(/what treatment was given/i)
    expect(response).toMatch(/what follow-up plan/i)
  })

  it("prior colonoscopy with polyps routes to surveillance clarification instead of average-risk due logic", () => {
    const response = buildDeterministicScreeningResponse(
      "I am 55 male. My colonoscopy showed polyps. No personal or family history of cancer."
    )
    expect(response).toContain("Prior abnormal colorectal result review")
    expect(response).not.toContain("Colorectal cancer screening (due)")
    expect(response).toMatch(/number\/size\/type of polyps or adenomas/i)
    expect(response).toMatch(/pathology/i)
  })

  it("qualifying smoking history asks whether a prior chest CT was screening or diagnostic", () => {
    const response = buildDeterministicScreeningResponse(
      "I am 60 male, current smoker with 30 pack-years. No personal or family history of cancer. Never had colorectal screening."
    )
    expect(response).toContain("Low-dose CT lung cancer screening")
    expect(response).toMatch(/screening low-dose chest CT before/i)
    expect(response).toMatch(/screening or a diagnostic CT/i)
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
