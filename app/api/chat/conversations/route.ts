import { NextRequest, NextResponse } from "next/server"
import { attachChatHistoryCookie, resolveChatHistoryOwner } from "@/lib/chat-history-owner"
import { createChatConversation, listChatConversations } from "@/lib/chat-history-store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const owner = await resolveChatHistoryOwner(request)
  if ("response" in owner) return owner.response

  try {
    const conversations = await listChatConversations(owner.ownerKey)
    // Reading an empty anonymous history must not establish a competing owner
    // while the user's first streamed message creates the actual conversation.
    return NextResponse.json({ conversations })
  } catch (error) {
    console.error("Chat history list failed; returning empty history:", error)
    return NextResponse.json({
      conversations: [],
      historyStatus: "temporarily_unavailable",
    })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    title?: string
    walletAddress?: string
  }
  const owner = await resolveChatHistoryOwner(request, body.walletAddress)
  if ("response" in owner) return owner.response

  const conversation = await createChatConversation({
    ownerKey: owner.ownerKey,
    title: body.title,
  })

  return attachChatHistoryCookie(NextResponse.json({ conversation }), owner)
}
