import { NextRequest, NextResponse } from "next/server"
import { attachChatHistoryCookie, resolveChatHistoryOwner } from "@/lib/chat-history-owner"
import { createChatConversation, listChatConversations } from "@/lib/chat-history-store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const owner = await resolveChatHistoryOwner(request)
  if ("response" in owner) return owner.response

  const conversations = await listChatConversations(owner.ownerKey)
  return attachChatHistoryCookie(NextResponse.json({ conversations }), owner)
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
