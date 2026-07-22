import { defineConfig, devices } from "@playwright/test"
import os from "os"
import path from "path"

const PORT = Number(process.env.PORT || 3000)
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`
const USE_E2E_DATABASE = process.env.OPENRX_E2E_USE_DATABASE === "1"

// MOCK_LLM=1 stands up a mock model-API server and points the app's real SDK
// clients at it, so upstream-failure paths (429/500/timeout) can be exercised
// end-to-end without real keys. Used by tests/e2e/llm-failure.spec.ts and
// tests/e2e/demo-offline.spec.ts.
const MOCK_LLM = process.env.MOCK_LLM === "1"
const LLM_MOCK_PORT = Number(process.env.LLM_MOCK_PORT || 18790)

// Admin-gated routes (cron, platform readiness) require a key in production
// builds (CI). Inject a test-only key so both the app server and the test
// workers agree on it; a real key from the environment always wins.
process.env.OPENRX_ADMIN_API_KEY = process.env.OPENRX_ADMIN_API_KEY || "openrx-e2e-admin-key"

const appServerCommand = process.env.CI
  ? `npm run build && npm run start -- --hostname 127.0.0.1 --port ${PORT}`
  : `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`

const appServer = {
  command: appServerCommand,
  url: baseURL,
  reuseExistingServer: !process.env.CI,
  timeout: 5 * 60 * 1000,
  env: {
    ...process.env,
    // Chat history persistence is gated behind a PHI compliance flag in
    // production; tests run against synthetic data only, with the gate on so
    // save/restore behavior stays covered.
    OPENRX_ENABLE_PHI_CHAT_HISTORY: "true",
    DATABASE_URL: USE_E2E_DATABASE ? process.env.DATABASE_URL || "" : "",
    OPENRX_CHAT_HISTORY_PATH:
      process.env.OPENRX_CHAT_HISTORY_PATH ||
      path.join(os.tmpdir(), `openrx-chat-history-e2e-${PORT}.json`),
    ...(MOCK_LLM
      ? {
          ANTHROPIC_API_KEY: "sk-ant-mock-e2e",
          ANTHROPIC_BASE_URL: `http://127.0.0.1:${LLM_MOCK_PORT}`,
          OPENAI_API_KEY: "",
          OPENRX_MODEL_TIMEOUT_MS: "3000",
          OPENRX_MODEL_MAX_RETRIES: "0",
        }
      : {}),
  } as Record<string, string>,
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: Number(process.env.PLAYWRIGHT_WORKERS || 1),
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: MOCK_LLM
    ? [
        {
          command: "node tests/mocks/llm-mock-server.mjs",
          url: `http://127.0.0.1:${LLM_MOCK_PORT}/__mock/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 30 * 1000,
        },
        appServer,
      ]
    : appServer,
})
