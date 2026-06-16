import { NextResponse } from "next/server"
import { getDatabaseHealth } from "@/lib/database-health"
import { resolveOpenAIHealthcareConfig } from "@/lib/openai-healthcare"
import { recommendScreenings, screeningIntakeFromLegacy } from "@/lib/screening/recommend"
import { SCREENING_ENGINE_VERSION } from "@/lib/screening/version"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type ComponentStatus = "ok" | "degraded" | "not_configured" | "error"

interface HealthComponent {
  status: ComponentStatus
  detail: string
}

const MODEL_PING_TIMEOUT_MS = 3500

async function checkModelApi(): Promise<HealthComponent> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const openai = resolveOpenAIHealthcareConfig()
  if (!apiKey && !openai.apiKeyConfigured) {
    return { status: "not_configured", detail: "No model API key configured; deterministic fallbacks only." }
  }
  if (!apiKey) {
    if (openai.apiPhiAllowed) {
      return { status: "ok", detail: `OpenAI API BAA gate enabled for PHI-adjacent calls (${openai.clinicianModel}; reachability not probed).` }
    }
    return {
      status: "not_configured",
      detail: "OpenAI key is present, but PHI-adjacent API calls are disabled until OPENRX_OPENAI_BAA_ENABLED=true.",
    }
  }

  // Lightweight reachability ping — an authenticated metadata request, never a
  // completion, so the check costs no tokens.
  const baseUrl = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), MODEL_PING_TIMEOUT_MS)
    const res = await fetch(`${baseUrl}/v1/models`, {
      method: "GET",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timer)
    if (res.status >= 500) {
      return { status: "degraded", detail: `Model API responded with a server error (${res.status}).` }
    }
    return { status: "ok", detail: "Model API endpoint reachable." }
  } catch {
    return { status: "degraded", detail: "Model API endpoint unreachable within timeout." }
  }
}

function checkGuidelineEngine(): HealthComponent & { engineVersion?: string } {
  try {
    const result = recommendScreenings(screeningIntakeFromLegacy({ age: 45, gender: "male" }))
    if (result.engineVersion !== SCREENING_ENGINE_VERSION || result.recommendations.length === 0) {
      return { status: "error", detail: "Guideline engine returned an unexpected result for the synthetic profile." }
    }
    if (result.recommendations.some((rec) => !rec.engineVersion)) {
      return { status: "error", detail: "Guideline engine produced an unstamped recommendation." }
    }
    return { status: "ok", detail: "Guideline engine produced version-stamped recommendations.", engineVersion: result.engineVersion }
  } catch {
    return { status: "error", detail: "Guideline engine threw on the synthetic profile." }
  }
}

export async function GET() {
  const [database, modelApi] = await Promise.all([getDatabaseHealth(), checkModelApi()])
  const guidelineEngine = checkGuidelineEngine()

  const databaseComponent: HealthComponent = database.configured
    ? database.reachable
      ? { status: "ok", detail: "Database is reachable." }
      : { status: "error", detail: "Database is configured but unreachable." }
    : { status: "not_configured", detail: "DATABASE_URL is not configured." }

  // The platform can serve its deterministic core without a model key or a
  // database, so "not_configured" does not fail health. Hard failures do.
  const failing =
    databaseComponent.status === "error" ||
    guidelineEngine.status === "error" ||
    modelApi.status === "error"
  const degraded = failing || modelApi.status === "degraded"

  const body = {
    status: failing ? "unhealthy" : degraded ? "degraded" : "ok",
    generatedAt: new Date().toISOString(),
    components: {
      database: databaseComponent,
      modelApi,
      guidelineEngine,
    },
  }

  return NextResponse.json(body, { status: failing ? 503 : 200 })
}
