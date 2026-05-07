import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { reviewSecondOpinion, type SecondOpinionInput, type SecondOpinionResult } from "@/lib/basehealth"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"

// Pull Orion's (second-opinion agent) system prompt from config
const ORION = OPENCLAW_CONFIG.agents.find((a) => a.id === "second-opinion")!

const ORION_JSON_INSTRUCTIONS = `
Return ONLY valid JSON matching this TypeScript type — no prose, no markdown fences:
{
  "agreement": "supports-current-plan" | "partial-agreement" | "needs-clinician-review",
  "confidence": "low" | "moderate" | "high",
  "summary": string,
  "keyQuestions": string[],
  "alternativeConsiderations": string[],
  "redFlags": string[],
  "specialistSuggestions": string[]
}
`

async function reviewWithClaude(input: SecondOpinionInput): Promise<SecondOpinionResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const userPrompt = [
    `Diagnosis: ${input.diagnosis}`,
    `Current treatment plan: ${input.currentPlan}`,
    input.symptoms?.length ? `Reported symptoms: ${input.symptoms.join(", ")}` : null,
    input.medications?.length ? `Current medications: ${input.medications.join(", ")}` : null,
    input.patient
      ? `Patient context: DOB ${input.patient.date_of_birth}, conditions: ${input.patient.medical_history.map((h) => h.condition).join(", ")}`
      : null,
    "",
    ORION_JSON_INSTRUCTIONS,
  ]
    .filter(Boolean)
    .join("\n")

  // Extended thinking enabled — Orion reasons privately before answering
  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    thinking: { type: "enabled", budget_tokens: 8000 },
    system: ORION.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  })

  const text = resp.content.find((b) => b.type === "text")?.text || ""
  let raw: Partial<SecondOpinionResult>
  try {
    raw = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text) as Partial<SecondOpinionResult>
  } catch {
    return reviewSecondOpinion(input)
  }

  return {
    generatedAt: new Date().toISOString(),
    diagnosis: input.diagnosis,
    agreement: raw.agreement || "needs-clinician-review",
    confidence: raw.confidence || "moderate",
    summary: raw.summary || "",
    keyQuestions: Array.isArray(raw.keyQuestions) ? raw.keyQuestions : [],
    alternativeConsiderations: Array.isArray(raw.alternativeConsiderations) ? raw.alternativeConsiderations : [],
    redFlags: Array.isArray(raw.redFlags) ? raw.redFlags : [],
    specialistSuggestions: Array.isArray(raw.specialistSuggestions) ? raw.specialistSuggestions : [],
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const body = (await request.json()) as SecondOpinionInput

    if (!body.diagnosis || !body.currentPlan) {
      return NextResponse.json(
        { error: "diagnosis and currentPlan are required." },
        { status: 400 }
      )
    }

    // Use Claude when available; fall back to heuristic engine
    const opinion = process.env.ANTHROPIC_API_KEY
      ? await reviewWithClaude(body)
      : reviewSecondOpinion(body)

    return NextResponse.json({ ...opinion, poweredBy: process.env.ANTHROPIC_API_KEY ? "claude" : "heuristic" })
  } catch (err) {
    console.error("Second-opinion error:", err)
    return NextResponse.json(
      { error: "Failed to generate second-opinion review." },
      { status: 500 }
    )
  }
}
