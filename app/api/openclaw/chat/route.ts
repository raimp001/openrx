import { canUseWalletScopedData, requestWalletProofMatches, requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { runAgent, runCoordinator } from "@/lib/ai-engine"
import { attachChatHistoryCookie, resolveChatHistoryOwner } from "@/lib/chat-history-owner"
import { appendChatExchange } from "@/lib/chat-history-store"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, agentId, screeningContext, sessionId, walletAddress, conversationId, collaborators, routingInfo } = body as {
      message: string
      agentId: string
      screeningContext?: string
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

    if (screeningContext !== undefined && (typeof screeningContext !== "string" || screeningContext.length > 5000)) {
      return NextResponse.json(
        { error: "screeningContext must be a string under 5000 characters" },
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
      : await runAgent({
          agentId,
          message,
          screeningContext: agentId === "screening" ? screeningContext?.trim() : undefined,
          sessionId,
          walletAddress: effectiveWalletAddress,
        })

    // Try to persist the exchange in chat history — but never block the response.
    let savedConversationId = conversationId || ""
    let savedTitle = ""
    let owner: Awaited<ReturnType<typeof resolveChatHistoryOwner>> | null = null
    try {
      owner = await resolveChatHistoryOwner(req, effectiveWalletAddress || walletAddress)
      if (owner && !("response" in owner)) {
        const conversation = await appendChatExchange({
          ownerKey: owner.ownerKey,
          conversationId,
          userContent: message.trim(),
          agentContent: result.response,
          agentId: result.agentId,
          collaborators: Array.isArray(collaborators) ? collaborators : undefined,
          routingInfo: typeof routingInfo === "string" ? routingInfo : undefined,
        })
        savedConversationId = conversation.id
        savedTitle = conversation.title
      }
    } catch (historyError) {
      console.error("Chat history storage failed (response still returned):", historyError)
    }

    const response = NextResponse.json({
      sessionId: sessionId || `session-${Date.now()}`,
      conversationId: savedConversationId,
      conversationTitle: savedTitle,
      response: result.response,
      agentId: result.agentId,
      handoff: result.handoff || null,
      live: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    })

    if (owner && !("response" in owner)) {
      return attachChatHistoryCookie(response, owner)
    }
    return response
  } catch (error) {
    console.error("Chat API error:", error)
    const message_str = error instanceof Error ? error.message : ""
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined
    if (status === 401 || message_str.includes("API key")) {
      return NextResponse.json(
        { error: "AI service configuration issue. The care team has been notified — please try again shortly." },
        { status: 502 }
      )
    }
    return NextResponse.json(
      { error: "Something went wrong while processing your request. Please try again." },
      { status: 500 }
    )
  }
}
