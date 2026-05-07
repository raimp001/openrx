import { NextRequest, NextResponse } from "next/server"
import { issueChatOwnerCookie, readChatOwnerId } from "@/lib/chat-history/owner"
import { exportConversation } from "@/lib/chat-history/store"

export const dynamic = "force-dynamic"

function resolveOwner(request: NextRequest, walletAddress?: string | null) {
  let ownerId = readChatOwnerId(request, walletAddress)
  let issuedCookie: string | null = null
  if (!ownerId) {
    const tmp = NextResponse.json({})
    ownerId = issueChatOwnerCookie(tmp)
    issuedCookie = tmp.headers.get("set-cookie")
  }
  return { ownerId, issuedCookie }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(request.url)
  const wallet = url.searchParams.get("walletAddress") || undefined
  const { ownerId, issuedCookie } = resolveOwner(request, wallet)
  const md = exportConversation(ownerId, params.id)
  if (!md) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }
  const response = new NextResponse(md, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="openrx-chat-${params.id}.md"`,
    },
  })
  if (issuedCookie) response.headers.append("set-cookie", issuedCookie)
  return response
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return GET(request, { params })
}
