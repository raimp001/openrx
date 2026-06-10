import { expect, test } from "@playwright/test"

test.describe("/api/health", () => {
  test("reports component statuses and a healthy guideline engine", async ({ request }) => {
    const res = await request.get("/api/health")
    expect(res.status()).toBe(200)
    const body = await res.json()

    expect(["ok", "degraded"]).toContain(body.status)
    expect(body.components.database).toBeDefined()
    expect(body.components.modelApi).toBeDefined()
    expect(body.components.guidelineEngine.status).toBe("ok")
    expect(body.components.guidelineEngine.engineVersion).toMatch(/^openrx-screening-engine-\d{4}-\d{2}-\d{2}$/)
  })
})
