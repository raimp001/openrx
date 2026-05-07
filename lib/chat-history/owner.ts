import crypto from "node:crypto"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"
import { normalizeWalletAddress } from "@/lib/api-auth"

export const CHAT_OWNER_COOKIE = "openrx_chat_owner"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function newOwnerToken(): string {
  return `anon_${crypto.randomUUID()}`
}

/**
 * Resolve the opaque ownerId for chat-history storage.
 * - Authenticated wallet sessions use `wallet_<lowercase-address>`.
 * - Anonymous sessions get a long-lived first-party cookie.
 *
 * This is intentionally narrow: it never stores PHI, only an opaque token
 * scoped to chat history.
 */
export function resolveChatOwnerId(walletAddress?: string | null): string {
  const wallet = normalizeWalletAddress(walletAddress)
  if (wallet) return `wallet_${wallet}`
  const store = cookies()
  const existing = store.get(CHAT_OWNER_COOKIE)?.value
  if (existing && existing.startsWith("anon_")) return existing
  const next = newOwnerToken()
  // Note: cookies().set is only allowed inside Server Actions / Route Handlers
  // in Next 14. We intentionally do not throw if the call site is read-only;
  // the caller can use issueChatOwnerCookie() to set a cookie on a response.
  try {
    store.set(CHAT_OWNER_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    })
  } catch {
    // ignored; route handler may set the cookie via issueChatOwnerCookie
  }
  return next
}

export function readChatOwnerId(request: NextRequest, walletAddress?: string | null): string | null {
  const wallet = normalizeWalletAddress(walletAddress)
  if (wallet) return `wallet_${wallet}`
  const value = request.cookies.get(CHAT_OWNER_COOKIE)?.value
  return value && value.startsWith("anon_") ? value : null
}

export function issueChatOwnerCookie(response: NextResponse, ownerId?: string): string {
  const value = ownerId && ownerId.startsWith("anon_") ? ownerId : newOwnerToken()
  response.cookies.set(CHAT_OWNER_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
  return value
}
