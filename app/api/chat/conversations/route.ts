import { NextRequest, NextResponse } from "next/server"
import { issueChatOwnerCookie, readChatOwnerId } from "@/lib/chat-history/owner"
import {
  appendMessage,
  listConversations,
  makeMessage,
} from "@/lib/chat-history/store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const wallet = url.searchParams.get("walletAddress") || undefined
  let ownerId = readChatOwnerId(request, wallet)
  const response = NextResponse.json({ conversations: [] as ReturnType<typeof listConversations> })
  if (!ownerId) {
    ownerId = issueChatOwnerCookie(response)
  }
  const conversations = listConversations(ownerId)
  return NextResponse.json(
    { conversations },
    {
      headers: response.headers,
    }
  )
}

interface AppendBody {
  conversationId?: string
  walletAddress?: string
  message: {
    role: "user" | "agent" | "system"
    content: string
    agentId?: string
  }
}

export async function POST(request: NextRequest) {
  let body: AppendBody
  try {
    body = (await request.json()) as AppendBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!body?.message?.content?.trim()) {
    return NextResponse.json({ error: "message.content is required" }, { status: 400 })
  }
  if (!["user", "agent", "system"].includes(body.message.role)) {
    return NextResponse.json({ error: "message.role must be user, agent or system" }, { status: 400 })
  }
  if (body.message.content.length > 10_000) {
    return NextResponse.json({ error: "message.content too long" }, { status: 400 })
  }

  let ownerId = readChatOwnerId(request, body.walletAddress)
  const response = NextResponse.json({ ok: true })
  if (!ownerId) {
    ownerId = issueChatOwnerCookie(response)
  }
  const message = makeMessage(body.message.role, body.message.content, body.message.agentId)
  const result = appendMessage(ownerId, {
    conversationId: body.conversationId,
    message,
    derivedTitle: body.message.role === "user" ? body.message.content : undefined,
  })
  return NextResponse.json(
    {
      conversationId: result.conversationId,
      message,
      conversation: {
        id: result.conversation.id,
        title: result.conversation.title,
        pinned: result.conversation.pinned,
        createdAt: result.conversation.createdAt,
        updatedAt: result.conversation.updatedAt,
        messageCount: result.conversation.messageCount,
        preview: result.conversation.preview,
      },
    },
    {
      headers: response.headers,
    }
  )
}
