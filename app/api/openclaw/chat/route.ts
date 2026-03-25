import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { runAgent, runCoordinator } from "@/lib/ai-engine"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenClaw AI service is unavailable. Set ANTHROPIC_API_KEY or OPENAI_API_KEY." },
        { status: 503 }
      )
    }

    const body = await req.json()
    const { message, agentId, sessionId, walletAddress } = body as {
      message: string
      agentId: string
      sessionId?: string
      walletAddress?: string
    }

    const validAgents = [
      "coordinator",
      "triage",
      "scheduling",
      "billing",
      "rx",
      "prior-auth",
      "onboarding",
      "wellness",
      "screening",
      "second-opinion",
      "trials",
      "devops",
    ]

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "message is required and must be a non-empty string" },
        { status: 400 }
      )
    }

    if (!agentId || !validAgents.includes(agentId)) {
      return NextResponse.json(
        { error: `agentId must be one of: ${validAgents.join(", ")}` },
        { status: 400 }
      )
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: "message must be under 5000 characters" },
        { status: 400 }
      )
    }

    // Use coordinator routing for the coordinator agent
    const result = agentId === "coordinator"
      ? await runCoordinator(message, sessionId, walletAddress)
      : await runAgent({ agentId, message, sessionId, walletAddress })

    return NextResponse.json({
      sessionId: sessionId || `session-${Date.now()}`,
      response: result.response,
      agentId: result.agentId,
      handoff: result.handoff || null,
      live: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    )
  }
}
