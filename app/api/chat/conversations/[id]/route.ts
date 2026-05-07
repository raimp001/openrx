import { NextRequest, NextResponse } from "next/server"
import { issueChatOwnerCookie, readChatOwnerId } from "@/lib/chat-history/owner"
import {
  deleteConversation,
  getConversation,
  patchConversation,
} from "@/lib/chat-history/store"

export const dynamic = "force-dynamic"

function resolveOwner(request: NextRequest, walletAddress?: string | null) {
  let ownerId = readChatOwnerId(request, walletAddress)
  let issuedCookie: string | null = null
  if (!ownerId) {
    // Issue a cookie even on read so a brand-new tab can save its scroll position.
    const tmp = NextResponse.json({})
    ownerId = issueChatOwnerCookie(tmp)
    issuedCookie = tmp.headers.get("set-cookie")
  }
  return { ownerId, issuedCookie }
}

function withCookie<T>(payload: T, cookie: string | null, init?: { status?: number }): NextResponse {
  const response = NextResponse.json(payload, init)
  if (cookie) response.headers.append("set-cookie", cookie)
  return response
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(request.url)
  const wallet = url.searchParams.get("walletAddress") || undefined
  const { ownerId, issuedCookie } = resolveOwner(request, wallet)
  const conversation = getConversation(ownerId, params.id)
  if (!conversation) {
    return withCookie({ error: "Conversation not found" }, issuedCookie, { status: 404 })
  }
  return withCookie({ conversation }, issuedCookie)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { title?: string; pinned?: boolean; walletAddress?: string }
  try {
    body = (await request.json()) as { title?: string; pinned?: boolean; walletAddress?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const { ownerId, issuedCookie } = resolveOwner(request, body?.walletAddress)
  if (typeof body.title === "string" && body.title.trim().length === 0) {
    return withCookie({ error: "title cannot be empty" }, issuedCookie, { status: 400 })
  }
  const conversation = patchConversation(ownerId, params.id, {
    title: body.title,
    pinned: body.pinned,
  })
  if (!conversation) {
    return withCookie({ error: "Conversation not found" }, issuedCookie, { status: 404 })
  }
  return withCookie({ conversation }, issuedCookie)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(request.url)
  const wallet = url.searchParams.get("walletAddress") || undefined
  const { ownerId, issuedCookie } = resolveOwner(request, wallet)
  const removed = deleteConversation(ownerId, params.id)
  if (!removed) {
    return withCookie({ error: "Conversation not found" }, issuedCookie, { status: 404 })
  }
  return withCookie({ ok: true }, issuedCookie)
}

