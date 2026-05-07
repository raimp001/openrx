import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  canUseWalletScopedData,
  getRequestWalletAddress,
  normalizeWalletAddress,
  requestWalletProofMatches,
  requireAuth,
} from "@/lib/api-auth"
import { chatOwnerKeyFromSession, chatOwnerKeyFromWallet } from "@/lib/chat-history-store"

const CHAT_SESSION_COOKIE = "openrx_chat_session"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180

export type ChatHistoryOwner = {
  ownerKey: string
  identity: "wallet" | "anonymous"
  sessionId?: string
  shouldSetCookie: boolean
}

function validSessionId(value?: string): value is string {
  return !!value && /^[a-zA-Z0-9._:-]{16,160}$/.test(value)
}

export async function resolveChatHistoryOwner(
  request: NextRequest,
  walletAddressFromBody?: string | null
): Promise<ChatHistoryOwner | { response: NextResponse }> {
  const auth = await requireAuth(request, { allowPublic: true })
  if ("response" in auth) return auth

  const walletAddress = normalizeWalletAddress(walletAddressFromBody || getRequestWalletAddress(request))
  if (
    walletAddress &&
    (canUseWalletScopedData(auth.session, walletAddress) || await requestWalletProofMatches(request, walletAddress))
  ) {
    return {
      ownerKey: chatOwnerKeyFromWallet(walletAddress),
      identity: "wallet",
      shouldSetCookie: false,
    }
  }

  const existingSession = request.cookies.get(CHAT_SESSION_COOKIE)?.value
  const sessionId = validSessionId(existingSession) ? existingSession : `chat_${crypto.randomUUID()}`

  return {
    ownerKey: chatOwnerKeyFromSession(sessionId),
    identity: "anonymous",
    sessionId,
    shouldSetCookie: sessionId !== existingSession,
  }
}

export function attachChatHistoryCookie<T extends NextResponse>(
  response: T,
  owner: ChatHistoryOwner
): T {
  if (owner.identity === "anonymous" && owner.sessionId && owner.shouldSetCookie) {
    response.cookies.set(CHAT_SESSION_COOKIE, owner.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
    })
  }
  return response
}
