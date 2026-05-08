"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Menu,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import { useWalletIdentity } from "@/lib/wallet-context"
import { cn } from "@/lib/utils"
import type { ChatConversationSummary } from "@/lib/chat-history-store"

type ConversationResponse = {
  conversations?: ChatConversationSummary[]
}

type FullConversationResponse = {
  conversation?: {
    title: string
    messages: Array<{
      role: string
      content: string
      agentId?: string
      createdAt: string
    }>
  }
}

const COLLAPSED_KEY = "openrx.chat.sidebar.collapsed"

function getConversationId(searchParams: URLSearchParams): string {
  return searchParams.get("c") || searchParams.get("conversationId") || ""
}

function monthLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" })
}

function daysBetween(now: Date, date: Date): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return Math.round((start - target) / 86_400_000)
}

function groupConversations(conversations: ChatConversationSummary[]) {
  const now = new Date()
  const groups = new Map<string, ChatConversationSummary[]>()

  for (const conversation of conversations) {
    const updatedAt = new Date(conversation.updatedAt)
    const age = daysBetween(now, updatedAt)
    const label =
      age <= 0
        ? "Today"
        : age === 1
          ? "Yesterday"
          : age <= 7
            ? "Previous 7 Days"
            : age <= 30
              ? "Previous 30 Days"
              : monthLabel(updatedAt)

    groups.set(label, [...(groups.get(label) || []), conversation])
  }

  return Array.from(groups.entries())
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Sandbox-safe: collapsed state is a convenience, not required for care.
  }
}

export default function ChatHistorySidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { walletAddress, getWalletAuthHeaders, profile, isConnected } = useWalletIdentity()
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([])
  const [query, setQuery] = useState("")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeConversationId = getConversationId(searchParams)

  const authHeaders = useCallback(async () => {
    return walletAddress ? await getWalletAuthHeaders() : {}
  }, [getWalletAuthHeaders, walletAddress])

  const loadConversations = useCallback(async () => {
    setError("")
    try {
      const response = await fetch("/api/chat/conversations", {
        headers: await authHeaders(),
        credentials: "include",
      })
      const body = (await response.json().catch(() => ({}))) as ConversationResponse
      if (!response.ok) throw new Error("Could not load chat history.")
      setConversations(body.conversations || [])
    } catch {
      setError("History is temporarily unavailable.")
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    setCollapsed(safeLocalStorageGet(COLLAPSED_KEY) === "true")
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty("--openrx-sidebar-width", collapsed ? "76px" : "320px")
    safeLocalStorageSet(COLLAPSED_KEY, collapsed ? "true" : "false")
    return () => {
      if (pathname !== "/chat") document.documentElement.style.setProperty("--openrx-sidebar-width", "76px")
    }
  }, [collapsed, pathname])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    const refresh = () => void loadConversations()
    const newChat = () => {
      router.push("/chat")
      setMobileOpen(false)
    }
    window.addEventListener("openrx:chat-history-refresh", refresh)
    window.addEventListener("openrx:new-chat", newChat)
    return () => {
      window.removeEventListener("openrx:chat-history-refresh", refresh)
      window.removeEventListener("openrx:new-chat", newChat)
    }
  }, [loadConversations, router])

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return conversations
    return conversations.filter((conversation) =>
      `${conversation.title} ${conversation.lastMessagePreview}`.toLowerCase().includes(needle)
    )
  }, [conversations, query])

  const grouped = useMemo(() => groupConversations(filteredConversations), [filteredConversations])

  const startNewChat = useCallback(() => {
    router.push("/chat")
    setMobileOpen(false)
    window.dispatchEvent(new CustomEvent("openrx:new-chat"))
  }, [router])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const editable = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
      const isMacLike = event.metaKey || event.ctrlKey

      if (isMacLike && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setMobileOpen(true)
        setCollapsed(false)
        window.setTimeout(() => searchRef.current?.focus(), 30)
        return
      }

      if (isMacLike && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault()
        startNewChat()
        return
      }

      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !editable && pathname === "/chat") {
        const focusable = itemRefs.current.filter(Boolean) as HTMLButtonElement[]
        if (focusable.length === 0) return
        event.preventDefault()
        const activeIndex = Math.max(0, focusable.findIndex((item) => item === document.activeElement))
        const nextIndex = event.key === "ArrowDown"
          ? Math.min(activeIndex + 1, focusable.length - 1)
          : Math.max(activeIndex - 1, 0)
        focusable[nextIndex]?.focus()
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [pathname, startNewChat])

  const openConversation = useCallback((conversationId: string) => {
    router.push(`/chat?c=${encodeURIComponent(conversationId)}`)
    setMobileOpen(false)
  }, [router])

  const patchConversation = useCallback(async (
    conversationId: string,
    patch: { title?: string; pinned?: boolean; archived?: boolean }
  ) => {
    const response = await fetch(`/api/chat/conversations/${conversationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      credentials: "include",
      body: JSON.stringify({ ...patch, walletAddress }),
    })
    if (!response.ok) throw new Error("Update failed")
    await loadConversations()
  }, [authHeaders, loadConversations, walletAddress])

  const renameConversation = useCallback(async (conversation: ChatConversationSummary) => {
    const title = window.prompt("Rename this clinical thread", conversation.title)
    if (!title?.trim()) return
    await patchConversation(conversation.id, { title })
  }, [patchConversation])

  const deleteConversation = useCallback(async (conversation: ChatConversationSummary) => {
    const confirmed = window.confirm(`Delete "${conversation.title}"?`)
    if (!confirmed) return
    const response = await fetch(`/api/chat/conversations/${conversation.id}`, {
      method: "DELETE",
      headers: await authHeaders(),
      credentials: "include",
    })
    if (!response.ok) return
    if (activeConversationId === conversation.id) router.push("/chat")
    await loadConversations()
  }, [activeConversationId, authHeaders, loadConversations, router])

  const exportConversation = useCallback(async (conversation: ChatConversationSummary) => {
    const response = await fetch(`/api/chat/conversations/${conversation.id}`, {
      headers: await authHeaders(),
      credentials: "include",
    })
    const body = (await response.json().catch(() => ({}))) as FullConversationResponse
    if (!response.ok || !body.conversation) return

    const markdown = [
      `# ${body.conversation.title}`,
      "",
      ...body.conversation.messages.flatMap((message) => [
        `## ${message.role === "user" ? "Question" : "OpenRx"}${message.agentId ? ` (${message.agentId})` : ""}`,
        message.content,
        "",
      ]),
    ].join("\n")

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${conversation.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "openrx-chat"}.md`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [authHeaders])

  const accountLabel = isConnected
    ? profile?.fullName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Wallet")
    : "Anonymous mode"

  const fullSidebar = (
    <div className="flex h-full flex-col" data-testid="chat-history-sidebar">
      <div className="border-b border-[rgba(86,107,130,0.16)] px-4 py-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="OpenRx home">
            <BrandMark size="sm" />
            <BrandWordmark subtitle={false} titleClassName="text-[16px] font-semibold text-primary" />
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="hidden rounded-full p-2 text-muted transition hover:bg-white/80 hover:text-primary lg:inline-flex"
              aria-label="Collapse chat history"
              data-testid="chat-history-toggle"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-full p-2 text-muted transition hover:bg-white/80 hover:text-primary lg:hidden"
              aria-label="Close chat history"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={startNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(7,17,31,0.16)] transition hover:bg-[#12213a]"
          data-testid="chat-history-new"
        >
          <Plus size={16} />
          New chat
        </button>

        <div className="relative mt-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search past chats"
            className="w-full rounded-2xl border border-[rgba(86,107,130,0.18)] bg-white/82 py-2.5 pl-9 pr-3 text-sm text-primary placeholder:text-muted transition focus:border-teal/35 focus:outline-none focus:ring-2 focus:ring-teal/12"
            data-testid="chat-history-search"
            aria-label="Search past chats"
          />
        </div>
      </div>

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {loading ? (
          <div className="space-y-2 px-1" aria-label="Loading chat history">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-2xl bg-white/60" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-3 py-3 text-xs leading-5 text-amber-900">
            {error}
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-2xl border border-[rgba(86,107,130,0.16)] bg-white/58 px-3 py-4 text-sm leading-6 text-secondary">
            No saved chats yet. Ask one clinical question and OpenRx will keep the handoff here.
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-2xl border border-[rgba(86,107,130,0.16)] bg-white/58 px-3 py-4 text-sm leading-6 text-secondary">
            No matching chats.
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([label, items]) => (
              <section key={label} aria-label={label}>
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {label}
                </p>
                <div className="space-y-1">
                  {items.map((conversation) => {
                    const active = conversation.id === activeConversationId
                    const focusIndex = filteredConversations.findIndex((item) => item.id === conversation.id)
                    return (
                      <div
                        key={conversation.id}
                        className={cn(
                          "group relative rounded-2xl border transition",
                          active
                            ? "border-[rgba(8,126,139,0.34)] bg-white shadow-[0_14px_34px_rgba(8,24,46,0.08)]"
                            : "border-transparent hover:border-[rgba(86,107,130,0.14)] hover:bg-white/70"
                        )}
                      >
                        <button
                          type="button"
                          ref={(node) => { itemRefs.current[focusIndex] = node }}
                          onClick={() => openConversation(conversation.id)}
                          className="w-full rounded-2xl px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-teal/20"
                          data-testid="chat-history-item"
                          aria-current={active ? "page" : undefined}
                        >
                          <span className="flex items-center gap-2">
                            {conversation.pinned ? <Pin size={12} className="shrink-0 text-teal" /> : null}
                            <span className="line-clamp-1 text-[13px] font-semibold leading-5 text-primary">
                              {conversation.title}
                            </span>
                          </span>
                          <span className="mt-0.5 line-clamp-1 block text-[11px] leading-5 text-muted">
                            {conversation.lastMessagePreview}
                          </span>
                        </button>
                        <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                          <details className="relative">
                            <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full bg-white/92 text-muted shadow-sm transition hover:text-primary">
                              <MoreHorizontal size={15} />
                              <span className="sr-only">Open chat actions</span>
                            </summary>
                            <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-2xl border border-[rgba(86,107,130,0.14)] bg-white p-1 shadow-[0_20px_50px_rgba(8,24,46,0.14)]">
                              <button type="button" onClick={() => renameConversation(conversation)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-secondary hover:bg-slate-50 hover:text-primary">
                                <Pencil size={13} /> Rename
                              </button>
                              <button type="button" onClick={() => patchConversation(conversation.id, { pinned: !conversation.pinned })} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-secondary hover:bg-slate-50 hover:text-primary">
                                {conversation.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                                {conversation.pinned ? "Unpin" : "Pin"}
                              </button>
                              <button type="button" onClick={() => exportConversation(conversation)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-secondary hover:bg-slate-50 hover:text-primary">
                                <Download size={13} /> Export
                              </button>
                              <button type="button" onClick={() => deleteConversation(conversation)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50">
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          </details>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[rgba(86,107,130,0.16)] px-4 py-3">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-2xl px-2 py-2 text-sm transition hover:bg-white/70"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-sm">
            <Settings size={15} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-primary">{accountLabel}</span>
            <span className="block text-[11px] text-muted">Settings and privacy</span>
          </span>
        </Link>
      </div>
    </div>
  )

  const collapsedSidebar = (
    <div className="flex h-full flex-col items-center py-4" data-testid="chat-history-sidebar">
      <Link href="/" aria-label="OpenRx home">
        <BrandMark size="sm" />
      </Link>
      <button
        type="button"
        onClick={startNewChat}
        className="mt-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_14px_30px_rgba(7,17,31,0.16)] transition hover:bg-[#12213a]"
        aria-label="New chat"
        data-testid="chat-history-new"
      >
        <Plus size={18} />
      </button>
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="mt-2 flex h-10 w-10 items-center justify-center rounded-2xl text-muted transition hover:bg-white/78 hover:text-primary"
        aria-label="Expand chat history"
        data-testid="chat-history-toggle"
      >
        <ChevronRight size={18} />
      </button>
      <button
        type="button"
        onClick={() => {
          setCollapsed(false)
          window.setTimeout(() => searchRef.current?.focus(), 30)
        }}
        className="mt-2 flex h-10 w-10 items-center justify-center rounded-2xl text-muted transition hover:bg-white/78 hover:text-primary"
        aria-label="Search chats"
      >
        <Search size={17} />
      </button>
      <Link
        href="/profile"
        className="mt-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/74 text-secondary transition hover:text-primary"
        aria-label="Settings"
      >
        <Settings size={16} />
      </Link>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-full border border-[rgba(86,107,130,0.16)] bg-white/92 p-2.5 text-secondary shadow-card transition hover:text-primary lg:hidden"
        aria-label="Open chat history"
        data-testid="chat-history-mobile-toggle"
      >
        <Menu size={18} />
      </button>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/28 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "shell-rail fixed left-0 top-0 z-50 flex h-screen w-[320px] flex-col border-r transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Chat history"
      >
        {fullSidebar}
      </aside>

      <aside
        className={cn(
          "shell-rail fixed left-0 top-0 z-40 hidden h-screen flex-col border-r transition-[width] duration-200 lg:flex",
          collapsed ? "w-[76px]" : "w-[320px]"
        )}
        aria-label="Chat history"
      >
        {collapsed ? collapsedSidebar : fullSidebar}
      </aside>
    </>
  )
}
