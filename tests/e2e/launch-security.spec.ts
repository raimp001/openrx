import { expect, test } from "@playwright/test"

test("admin-only launch surfaces reject unauthenticated requests", async ({ request }) => {
  const endpoints = [
    "/api/admin/applications",
    "/api/admin/notifications",
    "/api/payments/treasury",
    "/api/openclaw/worker-heartbeat",
  ]

  for (const endpoint of endpoints) {
    const response = await request.get(endpoint)
    expect(response.status(), `${endpoint} should require admin/service auth`).toBe(401)
  }
})
