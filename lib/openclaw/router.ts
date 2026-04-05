// ── LLM-based semantic router ─────────────────────────────
// Server-only. Imported by API routes, never by client components.

import Anthropic from "@anthropic-ai/sdk"
import { OPENCLAW_CONFIG, type AgentId } from "./config"
import { routeUserMessage } from "./orchestrator"

const ROUTER_SYSTEM = `You are Atlas, the OpenRx routing intelligence. Given a user message, return ONLY valid JSON with this shape:
{
  "primaryAgent": "<agentId>",
  "collaborators": ["<agentId>", ...],
  "reasoning": "<one short sentence>",
  "urgency": "low" | "medium" | "high" | "emergency"
}

Available agentIds: coordinator, triage, scheduling, billing, rx, prior-auth, onboarding, wellness, screening, second-opinion, trials, devops

Rules:
- Emergency symptoms (chest pain, stroke, can't breathe) → primaryAgent: "triage", urgency: "emergency"
- Medication / refill / pharmacy → primaryAgent: "rx"
- Appointment / book / cancel → primaryAgent: "scheduling"
- Bill / claim / charge / appeal → primaryAgent: "billing"
- Prior auth / authorization / denied → primaryAgent: "prior-auth"
- New patient / register / onboard → primaryAgent: "onboarding"
- Screening / risk / genetics / BRCA → primaryAgent: "screening"
- Second opinion / review diagnosis → primaryAgent: "second-opinion"
- Clinical trial / research study → primaryAgent: "trials"
- Preventive / vaccine / wellness → primaryAgent: "wellness"
- System / deploy / uptime → primaryAgent: "devops"
- Anything else → primaryAgent: "coordinator"

Pick 0-2 collaborators who genuinely add value. Return only JSON, no prose.`

export async function routeUserMessageLLM(message: string): Promise<{
  primaryAgent: AgentId
  collaborators: AgentId[]
  reasoning: string
  urgency: "low" | "medium" | "high" | "emergency"
  usedFallback?: boolean
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey })
      const resp = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system: ROUTER_SYSTEM,
        messages: [{ role: "user", content: message }],
      })
      const text = resp.content.find((b) => b.type === "text")?.text || ""
      const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text) as {
        primaryAgent?: string
        collaborators?: string[]
        reasoning?: string
        urgency?: string
      }
      const validIds = new Set<string>(OPENCLAW_CONFIG.agents.map((a) => a.id))
      const primary = validIds.has(json.primaryAgent || "") ? (json.primaryAgent as AgentId) : "coordinator"
      const collabs = (json.collaborators || []).filter((id) => validIds.has(id)) as AgentId[]
      const urgency = (["low", "medium", "high", "emergency"] as const).includes(
        json.urgency as "low" | "medium" | "high" | "emergency"
      )
        ? (json.urgency as "low" | "medium" | "high" | "emergency")
        : "medium"
      return { primaryAgent: primary, collaborators: collabs, reasoning: json.reasoning || "", urgency }
    } catch (error) {
      console.warn("[OpenClaw Router] LLM routing failed, falling back to keywords:", error instanceof Error ? error.message : error)
    }
  }

  const kw = routeUserMessage(message)
  return { ...kw, urgency: "medium", usedFallback: true }
}
