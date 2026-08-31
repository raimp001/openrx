import { defineConfig, devices } from "@playwright/test"

// Sandbox pilot suite.
//
// The screening-commitment pilot is deliberately unavailable in production:
// `getTrustedRole` (lib/clinic-auth.ts) refuses role headers when
// NODE_ENV=production so a role cannot be spoofed by header, and
// `isCommitmentFeatureEnabled` (lib/commitments/flags.ts) additionally requires
// an explicit sandbox marker there. The main E2E suite builds and serves in
// production mode, so these tests can never authenticate under it — which is
// why they failed on every CI run rather than only on some.
//
// They belong on a dev server, which is the mode the pilot is designed for.
// This config supplies that plus the pilot's own configuration.

const PORT = Number(process.env.SANDBOX_PORT || 3210)
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`

const sandboxEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  // Pilot feature flags. `isCommitmentFeatureEnabled` compares against the
  // literal string "true" — "1" silently reads as disabled.
  SCREENING_COMMITMENT_PILOT: "true",
  PRIVATE_COMPLETION_CREDENTIALS: "true",
  INSURER_VERIFIER_DEMO: "true",
  COINBASE_ONRAMP_PILOT: "true",
  // Eligibility proofs are signed; outside production the code falls back to a
  // sandbox secret, but set one explicitly so the suite does not depend on that.
  COMMITMENT_ELIGIBILITY_SIGNING_SECRET:
    process.env.COMMITMENT_ELIGIBILITY_SIGNING_SECRET || "openrx-e2e-eligibility-secret",
  // The specs authenticate as patient/provider via x-openrx-user-role.
  OPENRX_TRUST_ROLE_HEADER: "true",
  OPENRX_ADMIN_API_KEY: process.env.OPENRX_ADMIN_API_KEY || "openrx-e2e-admin-key",
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/screening-commitment-pilot.spec.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  // A dev server compiles each route on first request, so the first navigation
  // into a pilot page is slow. These budgets cover that cold compile; they are
  // not masking a slow product path.
  timeout: 3 * 60 * 1000,
  expect: { timeout: 30 * 1000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: 60 * 1000,
    actionTimeout: 30 * 1000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 5 * 60 * 1000,
    env: sandboxEnv,
  },
})
