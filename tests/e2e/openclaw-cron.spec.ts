import { expect, test } from "@playwright/test"

function adminHeaders() {
  const apiKey = process.env.OPENRX_ADMIN_API_KEY
  return apiKey ? { "x-admin-api-key": apiKey } : {}
}

test("cron API lists jobs and supports dry-run previews", async ({ request }) => {
  const headers = adminHeaders()

  const listResponse = await request.get("/api/openclaw/cron", {
    headers,
  })
  expect(listResponse.ok()).toBeTruthy()

  const listData = (await listResponse.json()) as {
    ok: boolean
    total: number
    jobs: Array<{ id: string; previewMessage: string }>
  }

  expect(listData.ok).toBe(true)
  expect(listData.total).toBeGreaterThan(0)
  expect(listData.jobs.some((job) => job.id === "refill-reminders")).toBe(true)
  expect(listData.jobs.every((job) => job.previewMessage.length > 0)).toBe(true)

  const dryRunResponse = await request.post("/api/openclaw/cron/refill-reminders", {
    headers,
    data: {
      dryRun: true,
      triggeredAt: "not-a-real-date",
      idempotencyKey: "playwright-dry-run",
    },
  })
  expect(dryRunResponse.ok()).toBeTruthy()

  const dryRunData = (await dryRunResponse.json()) as {
    ok: boolean
    dryRun: boolean
    providerCalled: boolean
    message: string
    job: { id: string }
    triggeredAt: { invalidInput: boolean; effectiveIso: string }
    idempotency: { status: string }
  }

  expect(dryRunData.ok).toBe(true)
  expect(dryRunData.dryRun).toBe(true)
  expect(dryRunData.providerCalled).toBe(false)
  expect(dryRunData.job.id).toBe("refill-reminders")
  expect(dryRunData.triggeredAt.invalidInput).toBe(true)
  expect(dryRunData.triggeredAt.effectiveIso.length).toBeGreaterThan(10)
  expect(dryRunData.message.toLowerCase()).toContain("refill")
  expect(dryRunData.idempotency.status).toBe("preview_only")

  const getDryRunResponse = await request.get(
    "/api/openclaw/cron/daily-health-check?dryRun=true&workerId=playwright-worker&workerType=test-cron",
    {
      headers,
    }
  )
  expect(getDryRunResponse.ok()).toBeTruthy()

  const getDryRunData = (await getDryRunResponse.json()) as {
    ok: boolean
    dryRun: boolean
    providerCalled: boolean
    job: { id: string }
    requestedBy: { authSource: string }
  }

  expect(getDryRunData.ok).toBe(true)
  expect(getDryRunData.dryRun).toBe(true)
  expect(getDryRunData.providerCalled).toBe(false)
  expect(getDryRunData.job.id).toBe("daily-health-check")
  expect(getDryRunData.requestedBy.authSource.length).toBeGreaterThan(0)
})
