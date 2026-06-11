import { canUseWalletScopedData, requestWalletProofMatches, requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { recordAgentExchange, runAgent, runCoordinator } from "@/lib/ai-engine"
import { attachChatHistoryCookie, isChatHistoryPersistenceEnabled, resolveChatHistoryOwner } from "@/lib/chat-history-owner"
import { appendChatExchange } from "@/lib/chat-history-store"
import { deterministicClinicalResponse } from "@/lib/openclaw/deterministic-clinical"
import {
  CLEAN_MODEL_BUSY_MESSAGE,
  isModelFailureText,
  modelErrorCode,
  requestIdFromModelError,
} from "@/lib/openclaw/model-boundary"
import { logAgentRequest } from "@/lib/observability/log"
import { SCREENING_ENGINE_VERSION } from "@/lib/screening/version"

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()
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

    if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
    }

    const deterministicResponse = deterministicClinicalResponse(message)

    const auth = await requireAuth(req, { allowPublic: true })
    if ("response" in auth) return auth.response
    const walletProofMatches = walletAddress
      ? await requestWalletProofMatches(req, walletAddress)
      : false
    const effectiveWalletAddress = canUseWalletScopedData(auth.session, walletAddress) || walletProofMatches
      ? walletAddress
      : undefined

    // Deterministic answers participate in chat history like any other
    // answer, so they can be restored from the sidebar after a reload.
    if (deterministicResponse) {
      recordAgentExchange({ agentId, sessionId: conversationId || sessionId, userMessage: message.trim(), assistantMessage: deterministicResponse })
      logAgentRequest({
        requestId,
        requestedAgentId: agentId,
        routedAgentId: "screening",
        outcome: "deterministic",
        latencyMs: Date.now() - startedAt,
        engineVersion: SCREENING_ENGINE_VERSION,
        modelConfigured: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
      })
      let savedConversation = { id: conversationId || "", title: "" }
      let deterministicOwner: Awaited<ReturnType<typeof resolveChatHistoryOwner>> | null = null
      try {
        if (isChatHistoryPersistenceEnabled()) {
          deterministicOwner = await resolveChatHistoryOwner(req, effectiveWalletAddress || walletAddress)
        }
        if (deterministicOwner && !("response" in deterministicOwner)) {
          const saved = await appendChatExchange({
            ownerKey: deterministicOwner.ownerKey,
            conversationId,
            userContent: message.trim(),
            agentContent: deterministicResponse,
            agentId: "screening",
            collaborators: Array.isArray(collaborators) ? collaborators : undefined,
            routingInfo: typeof routingInfo === "string" ? routingInfo : undefined,
          })
          savedConversation = { id: saved.id, title: saved.title }
          // The client adopts the saved conversation id as its next
          // sessionId, so mirror this exchange under that key too.
          if (saved.id && saved.id !== (conversationId || sessionId)) {
            recordAgentExchange({ agentId, sessionId: saved.id, userMessage: message.trim(), assistantMessage: deterministicResponse })
          }
        }
      } catch {
        console.error("[openclaw-chat-history]", { code: "history_store_failed" })
      }
      const deterministicJson = NextResponse.json({
        sessionId: sessionId || `session-${Date.now()}`,
        conversationId: savedConversation.id,
        conversationTitle: savedConversation.title,
        response: deterministicResponse,
        agentId: "screening",
        handoff: null,
        live: false,
        deterministic: true,
      })
      return deterministicOwner && !("response" in deterministicOwner)
        ? attachChatHistoryCookie(deterministicJson, deterministicOwner)
        : deterministicJson
    }

    const result = agentId === "coordinator"
      ? await runCoordinator(message, conversationId || sessionId, effectiveWalletAddress)
      : await runAgent({
          agentId,
          message,
          screeningContext: agentId === "screening" ? screeningContext?.trim() : undefined,
          sessionId: conversationId || sessionId,
          walletAddress: effectiveWalletAddress,
        })

    const resultResponse = isModelFailureText(result.response) ? CLEAN_MODEL_BUSY_MESSAGE : result.response

    logAgentRequest({
      requestId,
      requestedAgentId: agentId,
      routedAgentId: result.agentId,
      outcome:
        resultResponse === CLEAN_MODEL_BUSY_MESSAGE
          ? "fallback"
          : result.agentId === "triage" && agentId !== "triage"
            ? "clinician_route"
            : "success",
      latencyMs: Date.now() - startedAt,
      modelConfigured: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    })

    let savedConversationId = conversationId || ""
    let savedTitle = ""
    let owner: Awaited<ReturnType<typeof resolveChatHistoryOwner>> | null = null
    const persistChatHistory = isChatHistoryPersistenceEnabled()
    if (persistChatHistory) {
      try {
        owner = await resolveChatHistoryOwner(req, effectiveWalletAddress || walletAddress)
        if (owner && !("response" in owner)) {
          const conversation = await appendChatExchange({
            ownerKey: owner.ownerKey,
            conversationId,
            userContent: message.trim(),
            agentContent: resultResponse,
            agentId: result.agentId,
            collaborators: Array.isArray(collaborators) ? collaborators : undefined,
            routingInfo: typeof routingInfo === "string" ? routingInfo : undefined,
          })
          savedConversationId = conversation.id
          savedTitle = conversation.title
        }
      } catch {
        console.error("[openclaw-chat-history]", { code: "history_store_failed" })
      }
    }

    const response = NextResponse.json({
      sessionId: sessionId || `session-${Date.now()}`,
      conversationId: savedConversationId,
      conversationTitle: savedTitle,
      response: resultResponse,
      agentId: result.agentId,
      handoff: result.handoff || null,
      live: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    })

    if (persistChatHistory && owner && !("response" in owner)) {
      return attachChatHistoryCookie(response, owner)
    }
    return response
  } catch (error) {
    console.error("[openclaw-chat]", {
      code: modelErrorCode(error),
      requestId: requestIdFromModelError(error),
    })
    logAgentRequest({
      requestId,
      requestedAgentId: "unknown",
      routedAgentId: "unknown",
      outcome: "error",
      latencyMs: Date.now() - startedAt,
      modelConfigured: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    })
    return NextResponse.json(
      { error: CLEAN_MODEL_BUSY_MESSAGE },
      { status: 503 }
    )
  }
}
