import { NextRequest, NextResponse } from "next/server"
import { attachChatHistoryCookie, resolveChatHistoryOwner } from "@/lib/chat-history-owner"
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

function safeConversation(conversation: ChatConversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    pinned: conversation.pinned,
    archived: conversation.archived,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: conversation.messages,
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const owner = await resolveChatHistoryOwner(request)
  if ("response" in owner) return owner.response

  const conversation = await getChatConversation(owner.ownerKey, context.params.conversationId)
  if (!conversation) {
    return attachChatHistoryCookie(NextResponse.json({ error: "Conversation not found." }, { status: 404 }), owner)
  }

  return attachChatHistoryCookie(NextResponse.json({ conversation: safeConversation(conversation) }), owner)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const body = await request.json().catch(() => ({})) as {
    title?: string
    pinned?: boolean
    archived?: boolean
    walletAddress?: string
  }
  const owner = await resolveChatHistoryOwner(request, body.walletAddress)
  if ("response" in owner) return owner.response

  const conversation = await updateChatConversation({
    ownerKey: owner.ownerKey,
    conversationId: context.params.conversationId,
    title: body.title,
    pinned: body.pinned,
    archived: body.archived,
  })

  if (!conversation) {
    return attachChatHistoryCookie(NextResponse.json({ error: "Conversation not found." }, { status: 404 }), owner)
  }

  return attachChatHistoryCookie(NextResponse.json({ conversation: safeConversation(conversation) }), owner)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const owner = await resolveChatHistoryOwner(request)
  if ("response" in owner) return owner.response

  const deleted = await deleteChatConversation(owner.ownerKey, context.params.conversationId)
  return attachChatHistoryCookie(NextResponse.json({ ok: deleted }), owner)
}
