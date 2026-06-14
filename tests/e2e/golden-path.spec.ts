import { expect, test, type APIRequestContext } from "@playwright/test"

// Golden-path regression suite for the OpenRx core loop.
//
// These tests run against the real app with no model API configured (or a
// mocked one) — every assertion below must hold on the deterministic,
// guideline-engine-backed paths. They are the deploy gate for "it works".

const ERROR_TEXT = /\b(stack trace|TypeError|ReferenceError|SyntaxError|ECONNREFUSED|ETIMEDOUT|Internal Server Error|unhandled|rate_limit|overloaded)\b|\bupstream_\d{3}\b|\b(?:status|HTTP)\s*(?:code\s*)?[45]\d{2}\b/i

async function chat(request: APIRequestContext, message: string, agentId = "screening") {
  const res = await request.post("/api/openclaw/chat", {
    data: { agentId, message, sessionId: `golden-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
  })
  expect(res.status(), "chat endpoint must not surface an HTTP failure").toBe(200)
  return (await res.json()) as { response: string; agentId: string; deterministic?: boolean }
}

test.describe("golden path 1 — minimal input", () => {
  test('"age 45 male" returns at least one guideline-grounded, version-stamped recommendation', async ({ request }) => {
    const body = await chat(request, "age 45 male")

    expect(body.response.trim().length, "response must not be empty").toBeGreaterThan(0)
    expect(body.response).toContain("Colorectal cancer screening")
    expect(body.response).toContain("USPSTF")
    expect(body.response).toMatch(/Grade [AB]/)
    expect(body.response).toContain("Rule: uspstf-average-risk-colorectal")
    expect(body.response).toContain("source version 2021-05-18")
    expect(body.response).not.toMatch(ERROR_TEXT)
  })

  test("structured assessment for age 45 male has a non-empty recommendations array with source, grade, and version", async ({ request }) => {
    const res = await request.post("/api/screening/assess", { data: { age: 45, gender: "male" } })
    expect(res.status()).toBe(200)
    const body = await res.json()

    const recs = body.structuredRecommendations as Array<Record<string, unknown>>
    expect(Array.isArray(recs)).toBe(true)
    expect(recs.length, "recommendations array must not be empty").toBeGreaterThan(0)

    const colorectal = recs.find((rec) => rec.id === "uspstf-average-risk-colorectal")
    expect(colorectal, "colorectal recommendation must be present at age 45").toBeDefined()
    expect(colorectal?.sourceSystem).toBe("USPSTF")
    expect(colorectal?.sourceVersion).toBe("2021-05-18")
    expect(colorectal?.evidenceGrade).toBe("B")
  })
})

test.describe("golden path 2 — rich input", () => {
  test("52F smoker with breast-cancer family history gets USPSTF recs plus a hereditary-risk flag, all version-stamped", async ({ request }) => {
    const body = await chat(request, "I am 52 female, a smoker, with a family history of breast cancer.")

    expect(body.response).toContain("Breast cancer screening")
    expect(body.response).toMatch(/BRCA-related risk assessment|hereditary/i)
    // References must carry guideline version stamps from the engine sources.
    expect(body.response).toContain("2024-04-30") // USPSTF breast 2024
    expect(body.response).toContain("2019-08-20") // USPSTF BRCA risk assessment 2019
    expect(body.response).not.toMatch(ERROR_TEXT)
  })

  test("structured assessment carries the hereditary-risk flag", async ({ request }) => {
    const res = await request.post("/api/screening/assess", {
      data: { age: 52, gender: "female", smoker: true, familyHistory: ["mother had breast cancer at age 48"] },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    const recs = body.structuredRecommendations as Array<Record<string, unknown>>

    const hereditary = recs.find((rec) => rec.riskCategory === "hereditary_risk")
    expect(hereditary, "hereditary-risk flag must be present").toBeDefined()
    expect(hereditary?.requiresClinicianReview).toBe(true)

    const breast = recs.find((rec) => rec.id === "uspstf-average-risk-breast")
    expect(breast?.sourceVersion).toBe("2024-04-30")
  })
})

test.describe("golden path 3 — unknown input", () => {
  test('"asdf qwerty" returns a clean clarification, never a raw error', async ({ request }) => {
    const body = await chat(request, "asdf qwerty")

    expect(body.response.trim().length).toBeGreaterThan(0)
    // The safe behavior: ask one clear question instead of fabricating guidance.
    expect(body.response).toMatch(/age/i)
    expect(body.response).not.toMatch(ERROR_TEXT)
    expect(body.response).not.toMatch(/\{\{|\}\}|undefined|\[object Object\]/)
  })
})

test.describe("golden path 5 — pipeline-order assertion", () => {
  const profiles = [
    { label: "minimal", data: { age: 45, gender: "male" } },
    { label: "rich", data: { age: 52, gender: "female", smoker: true, familyHistory: ["mother had breast cancer at age 48"] } },
    { label: "symptomatic", data: { age: 50, gender: "female", symptoms: ["rectal bleeding"] } },
  ]

  for (const profile of profiles) {
    test(`every recommendation in the ${profile.label} response originated from the guideline engine`, async ({ request }) => {
      const res = await request.post("/api/screening/assess", { data: profile.data })
      expect(res.status()).toBe(200)
      const body = await res.json()
      const recs = body.structuredRecommendations as Array<Record<string, unknown>>

      expect(Array.isArray(recs)).toBe(true)
      expect(recs.length).toBeGreaterThan(0)
      for (const rec of recs) {
        expect(
          rec.engineVersion,
          `recommendation ${String(rec.id)} is missing engineVersion — it did not come from the guideline engine`
        ).toMatch(/^openrx-screening-engine-\d{4}-\d{2}-\d{2}$/)
      }
    })
  }
})
