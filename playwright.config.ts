import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.PORT || 3000)
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`

// MOCK_LLM=1 stands up a mock model-API server and points the app's real SDK
// clients at it, so upstream-failure paths (429/500/timeout) can be exercised
// end-to-end without real keys. Used by tests/e2e/llm-failure.spec.ts and
// tests/e2e/demo-offline.spec.ts.
const MOCK_LLM = process.env.MOCK_LLM === "1"
const LLM_MOCK_PORT = Number(process.env.LLM_MOCK_PORT || 18790)

const appServerCommand = process.env.CI
  ? `npm run build && npm run start -- --hostname 127.0.0.1 --port ${PORT}`
  : `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`

const appServer = {
  command: appServerCommand,
  url: baseURL,
  reuseExistingServer: !process.env.CI,
  timeout: 5 * 60 * 1000,
  ...(MOCK_LLM
    ? {
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: "sk-ant-mock-e2e",
          ANTHROPIC_BASE_URL: `http://127.0.0.1:${LLM_MOCK_PORT}`,
          OPENAI_API_KEY: "",
          OPENRX_MODEL_TIMEOUT_MS: "3000",
          OPENRX_MODEL_MAX_RETRIES: "0",
        } as Record<string, string>,
      }
    : {}),
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
