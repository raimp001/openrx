import { expect, test } from "@playwright/test"

test("status API exposes scheduler summary and prioritizes active workers", async ({ request }) => {
  const response = await request.get("/api/openclaw/status")
  expect(response.ok()).toBeTruthy()

  const data = (await response.json()) as {
    connected: boolean
    scheduler: {
      mode: string
      awsWorkerActive: boolean
      vercelCronActive: boolean
      cutoverReady: boolean
      message: string
    }
    backgroundWorkers: Array<{ workerType: string }>
  }

  expect(typeof data.connected).toBe("boolean")
  expect(data.scheduler.message.length).toBeGreaterThan(0)
  expect(["offline", "manual", "vercel", "aws", "hybrid"]).toContain(data.scheduler.mode)
  if (data.backgroundWorkers.length > 1) {
    expect(data.backgroundWorkers[0].workerType).not.toBe("manual")
  }
})

test("platform readiness exposes launch-blocking email and worker checks", async ({ request }) => {
  const response = await request.get("/api/platform/readiness")
  expect(response.ok()).toBeTruthy()

  const data = (await response.json()) as {
    readinessScore: number
    checks: Array<{ id: string; status: string; metric: string; description: string }>
  }

  expect(data.readinessScore).toBeGreaterThanOrEqual(0)
  expect(data.readinessScore).toBeLessThanOrEqual(100)

  const emailCheck = data.checks.find((check) => check.id === "email-delivery")
  expect(emailCheck).toBeTruthy()
  expect(emailCheck?.metric.length).toBeGreaterThan(0)
  expect(emailCheck?.description.length).toBeGreaterThan(0)

  const workerCheck = data.checks.find((check) => check.id === "aws-worker-cutover")
  expect(workerCheck).toBeTruthy()
  expect(["ready", "attention"]).toContain(workerCheck?.status)
})
