import { expect, test } from "@playwright/test"
import { allowsUnsignedWalletHeader, requestWalletMatches } from "@/lib/api-auth"
import {
  allowsCronRequestOverrides,
  canRunCronSideEffectsAfterAgentFailure,
} from "@/lib/openclaw/cron-dispatch"

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

test("production does not trust unsigned wallet headers by default", () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAllowUnsigned = process.env.OPENRX_ALLOW_UNSIGNED_WALLET_HEADER
  const wallet = "0x0000000000000000000000000000000000000001"
  const fakeRequest = {
    headers: new Headers({ "x-wallet-address": wallet }),
  } as Parameters<typeof requestWalletMatches>[0]

  try {
    process.env.NODE_ENV = "production"
    delete process.env.OPENRX_ALLOW_UNSIGNED_WALLET_HEADER

    expect(allowsUnsignedWalletHeader()).toBe(false)
    expect(requestWalletMatches(fakeRequest, wallet)).toBe(false)

    process.env.OPENRX_ALLOW_UNSIGNED_WALLET_HEADER = "true"
    expect(allowsUnsignedWalletHeader()).toBe(true)
    expect(requestWalletMatches(fakeRequest, wallet)).toBe(true)
  } finally {
    process.env.NODE_ENV = originalNodeEnv
    if (originalAllowUnsigned === undefined) {
      delete process.env.OPENRX_ALLOW_UNSIGNED_WALLET_HEADER
    } else {
      process.env.OPENRX_ALLOW_UNSIGNED_WALLET_HEADER = originalAllowUnsigned
    }
  }
})

test("production ignores live cron request overrides by default", () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAllowOverrides = process.env.OPENRX_ALLOW_CRON_REQUEST_OVERRIDES

  try {
    process.env.NODE_ENV = "production"
    delete process.env.OPENRX_ALLOW_CRON_REQUEST_OVERRIDES

    expect(allowsCronRequestOverrides({ authSource: "admin_api_key", dryRun: false })).toBe(false)
    expect(allowsCronRequestOverrides({ authSource: "agent_token", dryRun: false })).toBe(false)
    expect(allowsCronRequestOverrides({ authSource: "admin_api_key", dryRun: true })).toBe(true)

    process.env.OPENRX_ALLOW_CRON_REQUEST_OVERRIDES = "true"
    expect(allowsCronRequestOverrides({ authSource: "admin_api_key", dryRun: false })).toBe(true)
    expect(allowsCronRequestOverrides({ authSource: "agent_token", dryRun: false })).toBe(false)
  } finally {
    process.env.NODE_ENV = originalNodeEnv
    if (originalAllowOverrides === undefined) {
      delete process.env.OPENRX_ALLOW_CRON_REQUEST_OVERRIDES
    } else {
      process.env.OPENRX_ALLOW_CRON_REQUEST_OVERRIDES = originalAllowOverrides
    }
  }
})

test("provider outages do not block deterministic reminder side effects", () => {
  expect(canRunCronSideEffectsAfterAgentFailure("refill-reminders", "provider_unavailable")).toBe(true)
  expect(canRunCronSideEffectsAfterAgentFailure("appointment-reminders", "missing_model_credentials")).toBe(true)
  expect(canRunCronSideEffectsAfterAgentFailure("screening-reminders", "provider_rate_limited")).toBe(true)
  expect(canRunCronSideEffectsAfterAgentFailure("daily-deploy", "provider_unavailable")).toBe(false)
  expect(canRunCronSideEffectsAfterAgentFailure("refill-reminders", "unknown_agent")).toBe(false)
})
