import { canUseWalletScopedData, requestWalletProofMatches, requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { recordAgentExchange, runAgentStream } from "@/lib/ai-engine"
import { attachChatHistoryCookie, isChatHistoryPersistenceEnabled, resolveChatHistoryOwner } from "@/lib/chat-history-owner"
import { appendChatExchange } from "@/lib/chat-history-store"
import { deterministicClinicalResponse } from "@/lib/openclaw/deterministic-clinical"
import {
  CLEAN_MODEL_BUSY_MESSAGE,
  isModelFailureText,
  modelErrorCode,
  requestIdFromModelError,
} from "@/lib/openclaw/model-boundary"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const VALID_AGENTS = [
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
] as const

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function deterministicSseResponse(
  agentId: string,
  message: string,
  conversation: { id: string; title: string }
): NextResponse {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sse("ready", { agentId })))
      controller.enqueue(encoder.encode(sse("delta", { text: message })))
      controller.enqueue(encoder.encode(sse("done", {
        agentId: "screening",
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        handoff: null,
        finalText: message,
        deterministic: true,
      })))
      controller.close()
    },
  })

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  })
}

export async function POST(req: NextRequest) {
  let body: {
    message?: string
    agentId?: string
    screeningContext?: string
    sessionId?: string
    walletAddress?: string
    conversationId?: string
    collaborators?: string[]
    routingInfo?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  const { message, agentId, screeningContext, sessionId, walletAddress, conversationId, collaborators, routingInfo } = body

  if (!message || typeof message !== "string" || !message.trim()) {
    return new Response(
      JSON.stringify({ error: "message is required and must be a non-empty string" }),
      { status: 400, headers: { "content-type": "application/json" } }
    )
  }
  if (!agentId || !VALID_AGENTS.includes(agentId as (typeof VALID_AGENTS)[number])) {
    return new Response(
      JSON.stringify({ error: `agentId must be one of: ${VALID_AGENTS.join(", ")}` }),
      { status: 400, headers: { "content-type": "application/json" } }
    )
  }
  if (message.length > 5000) {
    return new Response(
      JSON.stringify({ error: "message must be under 5000 characters" }),
      { status: 400, headers: { "content-type": "application/json" } }
    )
  }
  if (screeningContext !== undefined && (typeof screeningContext !== "string" || screeningContext.length > 5000)) {
    return new Response(
      JSON.stringify({ error: "screeningContext must be a string under 5000 characters" }),
      { status: 400, headers: { "content-type": "application/json" } }
    )
  }

  const deterministicResponse = deterministicClinicalResponse(
    screeningContext?.trim() || message,
    agentId as string
  )

  const auth = await requireAuth(req, { allowPublic: true })
  if ("response" in auth) return auth.response

  const walletProofMatches = walletAddress
    ? await requestWalletProofMatches(req, walletAddress)
    : false
  const effectiveWalletAddress =
    canUseWalletScopedData(auth.session, walletAddress) || walletProofMatches
      ? walletAddress
      : undefined
  const persistChatHistory = isChatHistoryPersistenceEnabled()
  let historyOwner: Awaited<ReturnType<typeof resolveChatHistoryOwner>> | null = null
  if (persistChatHistory) {
    try {
      historyOwner = await resolveChatHistoryOwner(req, effectiveWalletAddress || walletAddress)
    } catch {
      console.error("[openclaw-stream-history]", { code: "history_owner_resolution_failed" })
    }
  }

  // Deterministic answers participate in chat history like any other answer,
  // so they can be restored from the sidebar after a reload.
  if (deterministicResponse) {
    recordAgentExchange({
      agentId: agentId as string,
      sessionId: conversationId || sessionId,
      userMessage: message.trim(),
      assistantMessage: deterministicResponse,
    })
    let conversation = { id: conversationId || "", title: "" }
    try {
      if (historyOwner && !("response" in historyOwner)) {
        const saved = await appendChatExchange({
          ownerKey: historyOwner.ownerKey,
          conversationId,
          userContent: message.trim(),
          agentContent: deterministicResponse,
          agentId: "screening",
          collaborators: Array.isArray(collaborators) ? collaborators : undefined,
          routingInfo: typeof routingInfo === "string" ? routingInfo : undefined,
        })
        conversation = { id: saved.id, title: saved.title }
        // The client adopts the saved conversation id as its next sessionId,
        // so mirror this exchange under that key for follow-up context.
        if (saved.id && saved.id !== (conversationId || sessionId)) {
          recordAgentExchange({
            agentId: agentId as string,
            sessionId: saved.id,
            userMessage: message.trim(),
            assistantMessage: deterministicResponse,
          })
        }
      }
    } catch {
      console.error("[openclaw-stream-history]", { code: "history_store_failed" })
    }
    const response = deterministicSseResponse(agentId, deterministicResponse, conversation)
    return historyOwner && !("response" in historyOwner)
      ? attachChatHistoryCookie(response, historyOwner)
      : response
  }

  const encoder = new TextEncoder()
  const aborted = req.signal.aborted

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sse(event, data)))
        } catch {
          // Controller may be closed if client disconnected.
        }
      }

      send("ready", { agentId })

      let finalText = ""
      let resolvedAgentId = agentId as string
      let handoff: string | undefined

      try {
        const generator = runAgentStream({
          agentId: agentId as string,
          message,
          screeningContext: ["screening", "coordinator", "wellness"].includes(agentId as string) ? screeningContext?.trim() : undefined,
          sessionId: conversationId || sessionId,
          walletAddress: effectiveWalletAddress,
        })

        while (true) {
          if (req.signal.aborted) break
          const next = await generator.next()
          if (next.done) {
            const finalValue = next.value
            if (finalValue) {
              finalText = finalText || finalValue.finalText
              resolvedAgentId = finalValue.agentId
              handoff = finalValue.handoff
            }
            break
          }
          if (isModelFailureText(next.value)) {
            finalText = CLEAN_MODEL_BUSY_MESSAGE
            send("error", { message: CLEAN_MODEL_BUSY_MESSAGE })
            break
          }
          send("delta", { text: next.value })
        }
      } catch (error) {
        console.error("[openclaw-stream]", {
          code: modelErrorCode(error),
          requestId: requestIdFromModelError(error),
        })
        finalText = CLEAN_MODEL_BUSY_MESSAGE
        send("error", { message: CLEAN_MODEL_BUSY_MESSAGE })
      }

      // Save chat history only after the Phase 2 PHI gate is explicitly enabled.
      let savedConversationId = conversationId || ""
      let savedTitle = ""
      // A model-failure placeholder is not a clinical exchange; persisting it
      // would pollute restored conversations with error turns.
      if (persistChatHistory && finalText !== CLEAN_MODEL_BUSY_MESSAGE) {
        try {
          if (historyOwner && !("response" in historyOwner)) {
            const conversation = await appendChatExchange({
              ownerKey: historyOwner.ownerKey,
              conversationId,
              userContent: message.trim(),
              agentContent: finalText,
              agentId: resolvedAgentId,
              collaborators: Array.isArray(collaborators) ? collaborators : undefined,
              routingInfo: typeof routingInfo === "string" ? routingInfo : undefined,
            })
            savedConversationId = conversation.id
            savedTitle = conversation.title
          }
        } catch {
          console.error("[openclaw-stream-history]", { code: "history_save_failed" })
        }
      }

      send("done", {
        agentId: resolvedAgentId,
        conversationId: savedConversationId,
        conversationTitle: savedTitle,
        handoff: handoff || null,
        finalText,
      })

      controller.close()
    },
    cancel() {
      // Client disconnected - nothing else to do.
    },
  })

  // Suppress unused-aborted warning (kept for clarity above).
  void aborted

  const response = new NextResponse(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  })
  return persistChatHistory && historyOwner && !("response" in historyOwner)
    ? attachChatHistoryCookie(response, historyOwner)
    : response
}
