#!/usr/bin/env node
// Synthetic golden-path canary. Runs the "age 45 male" profile (synthetic,
// never PHI) against a deployed environment and fails loudly if the response
// loses its version-stamped recommendations or contains error text.
//
// Usage: CANARY_BASE_URL=https://openrx.health node scripts/canary.mjs

const BASE_URL = (process.env.CANARY_BASE_URL || "https://openrx.health").replace(/\/$/, "")
const TIMEOUT_MS = Number(process.env.CANARY_TIMEOUT_MS || 30_000)

const ERROR_TEXT = /\b(stack trace|TypeError|ReferenceError|Internal Server Error|unhandled|rate_limit|overloaded)\b|\bupstream_\d{3}\b/i

const failures = []

function fail(check, detail) {
  failures.push({ check, detail })
  console.error(`[canary] FAIL ${check}: ${detail}`)
}

function pass(check) {
  console.log(`[canary] ok   ${check}`)
}

async function request(path, init) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function checkHealth() {
  const check = "GET /api/health"
  try {
    const res = await request("/api/health")
    const body = await res.json()
    if (res.status !== 200) return fail(check, `status ${res.status} (${body?.status})`)
    if (body?.components?.guidelineEngine?.status !== "ok") {
      return fail(check, `guideline engine status: ${body?.components?.guidelineEngine?.status}`)
    }
    pass(check)
  } catch (error) {
    fail(check, error?.message || "request failed")
  }
}

async function checkChatGoldenPath() {
  const check = "POST /api/openclaw/chat (age 45 male)"
  try {
    const res = await request("/api/openclaw/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "screening", message: "age 45 male", sessionId: `canary-${Date.now()}` }),
    })
    if (res.status !== 200) return fail(check, `status ${res.status}`)
    const body = await res.json()
    const text = String(body?.response || "")
    if (!text.trim()) return fail(check, "empty response")
    if (!/USPSTF/.test(text)) return fail(check, "no USPSTF-grounded recommendation in response")
    if (!/Grade [A-D]/.test(text)) return fail(check, "no evidence grade in response")
    if (!/\b20\d{2}-\d{2}-\d{2}\b|\b20\d{2}\b/.test(text)) return fail(check, "no version stamp in response")
    if (ERROR_TEXT.test(text)) return fail(check, "response contains error text")
    pass(check)
  } catch (error) {
    fail(check, error?.message || "request failed")
  }
}

async function checkStructuredAssessment() {
  const check = "POST /api/screening/assess (age 45 male)"
  try {
    const res = await request("/api/screening/assess", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ age: 45, gender: "male" }),
    })
    if (res.status !== 200) return fail(check, `status ${res.status}`)
    const body = await res.json()
    const recs = Array.isArray(body?.structuredRecommendations) ? body.structuredRecommendations : []
    if (recs.length === 0) return fail(check, "zero structured recommendations")
    const unstamped = recs.filter((rec) => !rec.engineVersion)
    if (unstamped.length > 0) {
      return fail(check, `${unstamped.length} recommendation(s) missing engineVersion`)
    }
    pass(check)
  } catch (error) {
    fail(check, error?.message || "request failed")
  }
}

console.log(`[canary] target: ${BASE_URL}`)
await checkHealth()
await checkChatGoldenPath()
await checkStructuredAssessment()

if (failures.length > 0) {
  console.error(`[canary] ${failures.length} check(s) failed`)
  process.exit(1)
}
console.log("[canary] all checks passed")
