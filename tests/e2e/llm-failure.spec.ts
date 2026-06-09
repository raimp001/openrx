import { expect, test, type APIRequestContext } from "@playwright/test"

// Golden path 4 — simulated upstream model failure.
//
// Requires MOCK_LLM=1 (npm run test:e2e:llm-failures): the app's real
// Anthropic SDK client is pointed at tests/mocks/llm-mock-server.mjs, which is
// switched into 429 / 500 / timeout modes. In every case the patient-facing
// response must be the single graceful busy message — no provider error text,
// no HTTP codes, and exactly one failure message (double-failure regression).

const MOCK_LLM = process.env.MOCK_LLM === "1"
const MOCK_BASE = `http://127.0.0.1:${process.env.LLM_MOCK_PORT || 18790}`
const CLEAN_BUSY_MESSAGE = "We're busy right now. Please try again in a moment."

test.describe("golden path 4 — upstream model failures", () => {
  test.skip(!MOCK_LLM, "requires MOCK_LLM=1 with the mock model server")
  // Each failure mode includes SDK timeout waits; keep generous headroom.
  test.setTimeout(120_000)

  async function setMode(request: APIRequestContext, mode: string) {
    const res = await request.post(`${MOCK_BASE}/__mock/mode`, { data: { mode } })
    expect(res.ok()).toBeTruthy()
  }

  test.afterEach(async ({ request }) => {
    await setMode(request, "ok")
  })

  for (const mode of ["429", "500", "timeout"] as const) {
    test(`upstream ${mode} collapses to exactly one clean fallback message`, async ({ request }) => {
      await setMode(request, mode)

      const res = await request.post("/api/openclaw/chat", {
        data: {
          agentId: "billing",
          message: "Can you explain how my deductible applies to my last visit?",
          sessionId: `llm-failure-${mode}-${Date.now()}`,
        },
      })
      expect(res.status(), "failure must not leak as an HTTP error to the client").toBe(200)
      const body = (await res.json()) as { response: string; conversationTitle?: string }

      expect(body.response).toBe(CLEAN_BUSY_MESSAGE)

      const occurrences = body.response.split(CLEAN_BUSY_MESSAGE).length - 1
      expect(occurrences, "exactly one failure message must be emitted").toBe(1)

      // Patient-visible text must contain no provider error text or HTTP codes.
      const visible = `${body.response}\n${body.conversationTitle || ""}`
      expect(visible).not.toMatch(/rate_limit|overloaded|anthropic|api\.anthropic|openai|status code|stack/i)
      expect(visible).not.toMatch(/\b(429|500|502|503|529)\b/)
    })
  }

  test("mock model in ok mode still answers through the normal path", async ({ request }) => {
    await setMode(request, "ok")
    const res = await request.post("/api/openclaw/chat", {
      data: {
        agentId: "billing",
        message: "Can you explain how my deductible applies to my last visit?",
        sessionId: `llm-ok-${Date.now()}`,
      },
    })
    expect(res.status()).toBe(200)
    const body = (await res.json()) as { response: string }
    expect(body.response).toContain("Mock model response")
  })
})
