import { requireAuth } from "@/lib/api-auth"
// ── Parallel Expert Fan-out — MoE-inspired endpoint ───────
// Inspired by Sparse MoE architecture (DeepSeek V3, Llama 4 Maverick, etc.)
// from Sebastian Raschka's LLM Architecture Gallery:
//   • Sparse MoE routing: activate top-K experts per token in parallel
//   • Applied here: fan out to the top-K most relevant clinical agents
//     simultaneously, then return each expert's answer for synthesis.
//
// Also applies:
//   • GQA-style context sharing: patient snapshot is fetched once and
//     reused across all expert calls in the fan-out round.
//   • Reasoning mode (DeepSeek R1-inspired): prior-auth, second-opinion,
//     and triage experts silently use extended thinking before answering.

import { NextRequest, NextResponse } from "next/server"
import { runParallelExperts } from "@/lib/ai-engine"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"

const VALID_EXPERT_IDS = new Set<string>(OPENCLAW_CONFIG.agents.map((a) => a.id))
const MAX_EXPERTS = 5

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if ("response" in auth) return auth.response;
  try {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "AI service is unavailable. Set ANTHROPIC_API_KEY or OPENAI_API_KEY." },
        { status: 503 }
      )
    }

    const body = await req.json()
    const { message, expertIds, sessionId, walletAddress } = body as {
      message: string
      expertIds: string[]
      sessionId?: string
      walletAddress?: string
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: "message must be under 5000 characters" }, { status: 400 })
    }
    if (!Array.isArray(expertIds) || expertIds.length === 0) {
      return NextResponse.json({ error: "expertIds must be a non-empty array" }, { status: 400 })
    }
    if (expertIds.length > MAX_EXPERTS) {
      return NextResponse.json({ error: `Maximum ${MAX_EXPERTS} experts per request` }, { status: 400 })
    }

    const invalidIds = expertIds.filter((id) => !VALID_EXPERT_IDS.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Unknown expert IDs: ${invalidIds.join(", ")}` },
        { status: 400 }
      )
    }

    const results = await runParallelExperts({ expertIds, message, sessionId, walletAddress })

    return NextResponse.json({
      sessionId: sessionId || `session-${Date.now()}`,
      experts: results,
      live: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    })
  } catch (error) {
    console.error("Parallel experts API error:", error)
    return NextResponse.json({ error: "Failed to process expert fan-out" }, { status: 500 })
  }
}
