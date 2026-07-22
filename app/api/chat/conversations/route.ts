import { NextRequest, NextResponse } from "next/server"
import { attachChatHistoryCookie, isChatHistoryPersistenceEnabled, resolveChatHistoryOwner } from "@/lib/chat-history-owner"
import { createChatConversation, listChatConversations } from "@/lib/chat-history-store"

export const dynamic = "force-dynamic"

let warnedMissingChatHistorySchema = false

function isMissingChatHistorySchema(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === "P2021" || code === "P2022"
}

function logChatHistorySchemaWarning(error: unknown) {
  if (warnedMissingChatHistorySchema) return
  warnedMissingChatHistorySchema = true
  const meta = (error as { meta?: { table?: string; column?: string } } | null)?.meta
  const location = meta?.table || meta?.column || "chat history persistence tables"
  console.warn(`[chat-history] schema_unavailable: ${location}`)
}

export async function GET(request: NextRequest) {
  if (!isChatHistoryPersistenceEnabled()) {
    return NextResponse.json({ conversations: [], historyStatus: "disabled" })
  }

  const owner = await resolveChatHistoryOwner(request)
  if ("response" in owner) return owner.response

  try {
    const conversations = await listChatConversations(owner.ownerKey)
    // Reading an empty anonymous history must not establish a competing owner
    // while the user's first streamed message creates the actual conversation.
    return NextResponse.json({ conversations })
  } catch (error) {
    if (isMissingChatHistorySchema(error)) {
      logChatHistorySchemaWarning(error)
      return NextResponse.json({
        conversations: [],
        historyStatus: "schema_unavailable",
      })
    }
    console.error("[chat-history]", { code: "list_failed" })
    return NextResponse.json({
      conversations: [],
      historyStatus: "temporarily_unavailable",
    })
  }
}

export async function POST(request: NextRequest) {
  if (!isChatHistoryPersistenceEnabled()) {
    return NextResponse.json(
      { error: "Chat history is disabled for the stateless MVP." },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({})) as {
    title?: string
    walletAddress?: string
  }
  const owner = await resolveChatHistoryOwner(request, body.walletAddress)
  if ("response" in owner) return owner.response

  let conversation: Awaited<ReturnType<typeof createChatConversation>>
  try {
    conversation = await createChatConversation({
      ownerKey: owner.ownerKey,
      title: body.title,
    })
  } catch (error) {
    if (isMissingChatHistorySchema(error)) {
      logChatHistorySchemaWarning(error)
      return NextResponse.json(
        {
          error: "Chat history is temporarily unavailable until persistence tables are migrated.",
          historyStatus: "schema_unavailable",
        },
        { status: 503 }
      )
    }
    console.error("[chat-history]", { code: "create_failed" })
    return NextResponse.json(
      {
        error: "Chat history is temporarily unavailable.",
        historyStatus: "temporarily_unavailable",
      },
      { status: 503 }
    )
  }

  return attachChatHistoryCookie(NextResponse.json({ conversation }), owner)
}
