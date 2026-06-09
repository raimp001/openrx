import { canUseWalletScopedData, requestWalletProofMatches, requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { runAgentStream } from "@/lib/ai-engine"
import { attachChatHistoryCookie, isChatHistoryPersistenceEnabled, resolveChatHistoryOwner } from "@/lib/chat-history-owner"
import { appendChatExchange } from "@/lib/chat-history-store"
import { deterministicClinicalResponse } from "@/lib/openclaw/deterministic-clinical"
import {
  CLEAN_MODEL_BUSY_MESSAGE,
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

function isLegacyModelFailureText(text: string): boolean {
  return /Our AI assistant is handling a high volume|temporarily at capacity|rate_limit|overloaded/i.test(text)
}

function deterministicSseResponse(agentId: string, message: string): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sse("ready", { agentId })))
      controller.enqueue(encoder.encode(sse("delta", { text: message })))
      controller.enqueue(encoder.encode(sse("done", {
        agentId: "screening",
        conversationId: "",
        conversationTitle: "",
        handoff: null,
        finalText: message,
        deterministic: true,
      })))
      controller.close()
    },
  })

  return new Response(stream, {
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

  const deterministicResponse = deterministicClinicalResponse(screeningContext?.trim() || message)
  if (deterministicResponse) {
    return deterministicSseResponse(agentId, deterministicResponse)
  }

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
          screeningContext: agentId === "screening" ? screeningContext?.trim() : undefined,
          sessionId,
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
          if (isLegacyModelFailureText(next.value)) {
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
      if (persistChatHistory) {
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
