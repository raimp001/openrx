import { expect, test, type APIRequestContext } from "@playwright/test"
import { DEMO_WALKTHROUGH_CASES } from "@/lib/demo/cases"

// Demo mode must be bulletproof: all three seeded synthetic cases complete on
// deterministic paths with the model API fully mocked OFFLINE (every model
// call returns 500). Requires MOCK_LLM=1 (npm run test:e2e:llm-failures).

const MOCK_LLM = process.env.MOCK_LLM === "1"
const MOCK_BASE = `http://127.0.0.1:${process.env.LLM_MOCK_PORT || 18790}`
const CLEAN_BUSY_MESSAGE = "We're busy right now. Please try again in a moment."

test.describe("demo walkthrough with the model API down", () => {
  test.skip(!MOCK_LLM, "requires MOCK_LLM=1 with the mock model server")

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${MOCK_BASE}/__mock/mode`, { data: { mode: "500" } })
    expect(res.ok()).toBeTruthy()
  })

  test.afterAll(async ({ request }) => {
    await request.post(`${MOCK_BASE}/__mock/mode`, { data: { mode: "ok" } })
  })

  async function runCase(request: APIRequestContext, demoCase: (typeof DEMO_WALKTHROUGH_CASES)[number]) {
    const res = await request.post("/api/openclaw/chat", {
      data: {
        agentId: demoCase.agentId,
        message: demoCase.prompt,
        sessionId: `demo-offline-${demoCase.id}-${Date.now()}`,
      },
    })
    expect(res.status()).toBe(200)
    return (await res.json()) as { response: string }
  }

  for (const demoCase of DEMO_WALKTHROUGH_CASES) {
    test(`case "${demoCase.id}" completes deterministically offline`, async ({ request }) => {
      const body = await runCase(request, demoCase)

      expect(body.response, "demo case must not degrade to the busy fallback").not.toBe(CLEAN_BUSY_MESSAGE)
      for (const marker of demoCase.expectedMarkers) {
        expect(body.response).toContain(marker)
      }
      expect(body.response).not.toMatch(/rate_limit|overloaded|anthropic|stack|upstream_\d{3}/i)
    })
  }

  test("seeded cases API serves cached renderings offline", async ({ request }) => {
    const res = await request.get("/api/demo/cases")
    expect(res.status()).toBe(200)
    const body = (await res.json()) as { sandbox: boolean; cases: Array<{ id: string; caption: string; cachedRendering: string }> }

    expect(body.sandbox).toBe(true)
    expect(body.cases).toHaveLength(3)
    for (const demoCase of body.cases) {
      expect(demoCase.caption.length).toBeGreaterThan(0)
      expect(demoCase.cachedRendering.length, `case ${demoCase.id} must have a cached rendering`).toBeGreaterThan(0)
    }
  })

  test("demo page shows the guided walkthrough captions", async ({ request }) => {
    const res = await request.get("/demo")
    const html = await res.text()
    expect(html).toContain("Guided walkthrough")
    for (const demoCase of DEMO_WALKTHROUGH_CASES) {
      expect(html).toContain(`demo-case-${demoCase.id}`)
    }
  })
})
