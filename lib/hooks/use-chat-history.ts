"use client"

import { useCallback, useEffect, useState } from "react"
import type {
  ChatConversationDetail,
  ChatConversationSummary,
} from "@/lib/chat-history/types"

export interface UseChatHistory {
  conversations: ChatConversationSummary[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  appendMessage: (
    role: "user" | "agent" | "system",
    content: string,
    options: { conversationId?: string; agentId?: string }
  ) => Promise<{ conversationId: string; conversation: ChatConversationSummary } | null>
  fetchConversation: (id: string) => Promise<ChatConversationDetail | null>
  renameConversation: (id: string, title: string) => Promise<boolean>
  togglePinned: (id: string, pinned: boolean) => Promise<boolean>
  deleteConversation: (id: string) => Promise<boolean>
}

interface ListResponse {
  conversations: ChatConversationSummary[]
}

interface AppendResponse {
  conversationId: string
  conversation: ChatConversationSummary
}

interface DetailResponse {
  conversation: ChatConversationDetail
}

const BASE = "/api/chat/conversations"

export function useChatHistory(walletAddress?: string | null): UseChatHistory {
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (walletAddress) params.set("walletAddress", walletAddress)
      const res = await fetch(`${BASE}${params.toString() ? `?${params}` : ""}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`history list failed: ${res.status}`)
      const data = (await res.json()) as ListResponse
      setConversations(data.conversations || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat history")
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const appendMessage: UseChatHistory["appendMessage"] = useCallback(
    async (role, content, options) => {
      try {
        const res = await fetch(BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            conversationId: options.conversationId,
            walletAddress: walletAddress || undefined,
            message: { role, content, agentId: options.agentId },
          }),
        })
        if (!res.ok) return null
        const data = (await res.json()) as AppendResponse
        setConversations((prev) => {
          const filtered = prev.filter((c) => c.id !== data.conversation.id)
          return [data.conversation, ...filtered].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
            return b.updatedAt.localeCompare(a.updatedAt)
          })
        })
        return data
      } catch {
        return null
      }
    },
    [walletAddress]
  )

  const fetchConversation = useCallback(
    async (id: string) => {
      try {
        const params = new URLSearchParams()
        if (walletAddress) params.set("walletAddress", walletAddress)
        const res = await fetch(`${BASE}/${encodeURIComponent(id)}${params.toString() ? `?${params}` : ""}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })
        if (!res.ok) return null
        const data = (await res.json()) as DetailResponse
        return data.conversation
      } catch {
        return null
      }
    },
    [walletAddress]
  )

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title, walletAddress: walletAddress || undefined }),
        })
        if (!res.ok) return false
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title } : c))
        )
        return true
      } catch {
        return false
      }
    },
    [walletAddress]
  )

  const togglePinned = useCallback(
    async (id: string, pinned: boolean) => {
      try {
        const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ pinned, walletAddress: walletAddress || undefined }),
        })
        if (!res.ok) return false
        setConversations((prev) =>
          [...prev.map((c) => (c.id === id ? { ...c, pinned } : c))].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
            return b.updatedAt.localeCompare(a.updatedAt)
          })
        )
        return true
      } catch {
        return false
      }
    },
    [walletAddress]
  )

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const params = new URLSearchParams()
        if (walletAddress) params.set("walletAddress", walletAddress)
        const res = await fetch(`${BASE}/${encodeURIComponent(id)}${params.toString() ? `?${params}` : ""}`, {
          method: "DELETE",
          credentials: "include",
        })
        if (!res.ok) return false
        setConversations((prev) => prev.filter((c) => c.id !== id))
        return true
      } catch {
        return false
      }
    },
    [walletAddress]
  )

  return {
    conversations,
    isLoading,
    error,
    refresh,
    appendMessage,
    fetchConversation,
    renameConversation,
    togglePinned,
    deleteConversation,
  }
}
