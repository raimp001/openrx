import { canUseWalletScopedData, requestWalletProofMatches, requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { runAgent, runCoordinator } from "@/lib/ai-engine"
import { attachChatHistoryCookie, resolveChatHistoryOwner } from "@/lib/chat-history-owner"
import { appendChatExchange } from "@/lib/chat-history-store"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, agentId, sessionId, walletAddress, conversationId, collaborators, routingInfo } = body as {
      message: string
      agentId: string
      sessionId?: string
      walletAddress?: string
      conversationId?: string
      collaborators?: string[]
      routingInfo?: string
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

    const auth = await requireAuth(req, { allowPublic: true })
    if ("response" in auth) return auth.response
    const walletProofMatches = walletAddress
      ? await requestWalletProofMatches(req, walletAddress)
      : false
    const effectiveWalletAddress = canUseWalletScopedData(auth.session, walletAddress) || walletProofMatches
      ? walletAddress
      : undefined

    // Use coordinator routing for the coordinator agent
    const result = agentId === "coordinator"
      ? await runCoordinator(message, sessionId, effectiveWalletAddress)
      : await runAgent({ agentId, message, sessionId, walletAddress: effectiveWalletAddress })

    const owner = await resolveChatHistoryOwner(req, effectiveWalletAddress || walletAddress)
    if ("response" in owner) return owner.response

    const conversation = await appendChatExchange({
      ownerKey: owner.ownerKey,
      conversationId,
      userContent: message.trim(),
      agentContent: result.response,
      agentId: result.agentId,
      collaborators: Array.isArray(collaborators) ? collaborators : undefined,
      routingInfo: typeof routingInfo === "string" ? routingInfo : undefined,
    })

    return attachChatHistoryCookie(NextResponse.json({
      sessionId: sessionId || `session-${Date.now()}`,
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      response: result.response,
      agentId: result.agentId,
      handoff: result.handoff || null,
      live: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    }), owner)
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    )
  }
}
