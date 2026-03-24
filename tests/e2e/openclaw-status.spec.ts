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
  expect(data.backgroundWorkers.length).toBeGreaterThan(0)

  if (data.backgroundWorkers.length > 1) {
    expect(data.backgroundWorkers[0].workerType).not.toBe("manual")
  }
})
