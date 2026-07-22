import { NextRequest, NextResponse } from "next/server"
import { attachChatHistoryCookie, isChatHistoryPersistenceEnabled, resolveChatHistoryOwner } from "@/lib/chat-history-owner"
import {
  deleteChatConversation,
  getChatConversation,
  updateChatConversation,
  type ChatConversation,
} from "@/lib/chat-history-store"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: {
    conversationId: string
  }
}

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

function safeConversation(conversation: ChatConversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    folder: conversation.folder,
    pinned: conversation.pinned,
    archived: conversation.archived,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: conversation.messages,
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isChatHistoryPersistenceEnabled()) {
    return NextResponse.json(
      { error: "Chat history is disabled for the stateless MVP." },
      { status: 404 }
    )
  }

  const owner = await resolveChatHistoryOwner(request)
  if ("response" in owner) return owner.response

  let conversation: Awaited<ReturnType<typeof getChatConversation>>
  try {
    conversation = await getChatConversation(owner.ownerKey, context.params.conversationId)
  } catch (error) {
    if (isMissingChatHistorySchema(error)) {
      logChatHistorySchemaWarning(error)
      return attachChatHistoryCookie(
        NextResponse.json(
          {
            error: "Chat history is temporarily unavailable until persistence tables are migrated.",
            historyStatus: "schema_unavailable",
          },
          { status: 503 }
        ),
        owner
      )
    }
    console.error("[chat-history]", { code: "conversation_get_failed" })
    return attachChatHistoryCookie(
      NextResponse.json(
        {
          error: "Chat history is temporarily unavailable.",
          historyStatus: "temporarily_unavailable",
        },
        { status: 503 }
      ),
      owner
    )
  }
  if (!conversation) {
    return attachChatHistoryCookie(NextResponse.json({ error: "Conversation not found." }, { status: 404 }), owner)
  }

  return attachChatHistoryCookie(NextResponse.json({ conversation: safeConversation(conversation) }), owner)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isChatHistoryPersistenceEnabled()) {
    return NextResponse.json(
      { error: "Chat history is disabled for the stateless MVP." },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({})) as {
    title?: string
    folder?: string
    pinned?: boolean
    archived?: boolean
    walletAddress?: string
  }
  const owner = await resolveChatHistoryOwner(request, body.walletAddress)
  if ("response" in owner) return owner.response

  let conversation: Awaited<ReturnType<typeof updateChatConversation>>
  try {
    conversation = await updateChatConversation({
      ownerKey: owner.ownerKey,
      conversationId: context.params.conversationId,
      title: body.title,
      folder: body.folder,
      pinned: body.pinned,
      archived: body.archived,
    })
  } catch (error) {
    if (isMissingChatHistorySchema(error)) {
      logChatHistorySchemaWarning(error)
      return attachChatHistoryCookie(
        NextResponse.json(
          {
            error: "Chat history is temporarily unavailable until persistence tables are migrated.",
            historyStatus: "schema_unavailable",
          },
          { status: 503 }
        ),
        owner
      )
    }
    const message = error instanceof Error ? error.message : "Update failed."
    return attachChatHistoryCookie(NextResponse.json({ error: message }, { status: 409 }), owner)
  }

  if (!conversation) {
    return attachChatHistoryCookie(NextResponse.json({ error: "Conversation not found." }, { status: 404 }), owner)
  }

  return attachChatHistoryCookie(NextResponse.json({ conversation: safeConversation(conversation) }), owner)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isChatHistoryPersistenceEnabled()) {
    return NextResponse.json({ ok: false, historyStatus: "disabled" })
  }

  const owner = await resolveChatHistoryOwner(request)
  if ("response" in owner) return owner.response

  let deleted = false
  try {
    deleted = await deleteChatConversation(owner.ownerKey, context.params.conversationId)
  } catch (error) {
    if (isMissingChatHistorySchema(error)) {
      logChatHistorySchemaWarning(error)
      return attachChatHistoryCookie(
        NextResponse.json({ ok: false, historyStatus: "schema_unavailable" }, { status: 503 }),
        owner
      )
    }
    console.error("[chat-history]", { code: "conversation_delete_failed" })
    return attachChatHistoryCookie(
      NextResponse.json({ ok: false, historyStatus: "temporarily_unavailable" }, { status: 503 }),
      owner
    )
  }
  return attachChatHistoryCookie(NextResponse.json({ ok: deleted }), owner)
}
