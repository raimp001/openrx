import { expect, test } from "@playwright/test"
import { allowsUnsignedWalletHeader, requestWalletMatches } from "@/lib/api-auth"

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
