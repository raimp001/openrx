"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Folder,
  FolderPlus,
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
const CUSTOM_FOLDERS_KEY = "openrx.chat.custom-folders"
const FOLDER_ASSIGNMENTS_KEY = "openrx.chat.folder-assignments"

function getConversationId(searchParams: URLSearchParams): string {
  return searchParams.get("c") || searchParams.get("conversationId") || ""
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
    // Sandbox-safe: local folder labels are convenience metadata.
  }
}

function parseStoredFolders(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item).trim()).filter(Boolean).slice(0, 24)
  } catch {
    return []
  }
}

function parseFolderAssignments(value: string | null): Record<string, string> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([id, folder]) => [id, String(folder).trim()] as const)
        .filter(([id, folder]) => Boolean(id && folder))
    )
  } catch {
    return {}
  }
}

function inferIssueFolder(conversation: ChatConversationSummary): string {
  if (conversation.folder) return conversation.folder
  const text = `${conversation.title} ${conversation.lastMessagePreview}`.toLowerCase()
  if (/\b(screen|screening|colonoscopy|colon|colorectal|mammogram|breast|lung|ldct|pap|hpv|psa|brca|lynch|cancer)\b/.test(text)) {
    return "Screening"
  }
  if (/\b(medication|meds|drug|rx|ibuprofen|lisinopril|pharmacy|refill)\b/.test(text)) return "Medications"
  if (/\b(provider|doctor|primary care|pcp|specialist|referral|appointment|schedule|near me|find care)\b/.test(text)) {
    return "Care access"
  }
  if (/\b(bill|claim|coverage|insurance|prior auth|authorization|cost|copay|denial)\b/.test(text)) return "Coverage"
  if (/\b(chest pain|shortness|symptom|fever|cough|bleeding|triage|urgent)\b/.test(text)) return "Symptoms"
  return "General"
}

function folderSort(a: string, b: string) {
  const order = ["Screening", "Symptoms", "Medications", "Care access", "Coverage", "General"]
  const ai = order.indexOf(a)
  const bi = order.indexOf(b)
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  return a.localeCompare(b)
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
  const [customFolders, setCustomFolders] = useState<string[]>([])
  const [folderAssignments, setFolderAssignments] = useState<Record<string, string>>({})
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
    setCustomFolders(parseStoredFolders(safeLocalStorageGet(CUSTOM_FOLDERS_KEY)))
    setFolderAssignments(parseFolderAssignments(safeLocalStorageGet(FOLDER_ASSIGNMENTS_KEY)))
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty("--openrx-sidebar-width", collapsed ? "76px" : "308px")
    safeLocalStorageSet(COLLAPSED_KEY, collapsed ? "true" : "false")
    return () => {
      if (pathname !== "/chat") document.documentElement.style.setProperty("--openrx-sidebar-width", "76px")
    }
  }, [collapsed, pathname])

  const saveCustomFolders = useCallback((folders: string[]) => {
    const unique = Array.from(new Set(folders.map((folder) => folder.trim()).filter(Boolean))).slice(0, 24)
    setCustomFolders(unique)
    safeLocalStorageSet(CUSTOM_FOLDERS_KEY, JSON.stringify(unique))
  }, [])

  const saveFolderAssignments = useCallback((assignments: Record<string, string>) => {
    setFolderAssignments(assignments)
    safeLocalStorageSet(FOLDER_ASSIGNMENTS_KEY, JSON.stringify(assignments))
  }, [])

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

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return conversations
    return conversations.filter((conversation) =>
      `${conversation.title} ${conversation.lastMessagePreview} ${folderAssignments[conversation.id] || conversation.folder || ""}`.toLowerCase().includes(needle)
    )
  }, [conversations, folderAssignments, query])

  const pinnedConversations = useMemo(
    () => filteredConversations.filter((conversation) => conversation.pinned),
    [filteredConversations]
  )

  const issueFolders = useMemo(() => {
    const folderMap = new Map<string, ChatConversationSummary[]>()
    for (const folder of customFolders) folderMap.set(folder, [])
    for (const conversation of filteredConversations) {
      if (conversation.pinned) continue
      const folder = folderAssignments[conversation.id] || inferIssueFolder(conversation)
      folderMap.set(folder, [...(folderMap.get(folder) || []), conversation])
    }
    return Array.from(folderMap.entries()).sort(([a], [b]) => folderSort(a, b))
  }, [customFolders, filteredConversations, folderAssignments])

  const openConversation = useCallback((conversationId: string) => {
    router.push(`/chat?c=${encodeURIComponent(conversationId)}`)
    setMobileOpen(false)
  }, [router])

  const patchConversation = useCallback(async (
    conversationId: string,
    patch: { title?: string; folder?: string; pinned?: boolean; archived?: boolean }
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
    const title = window.prompt("Rename chat", conversation.title)
    if (!title?.trim()) return
    await patchConversation(conversation.id, { title })
  }, [patchConversation])

  const createFolder = useCallback(() => {
    const folder = window.prompt("Create folder", "Screening follow-up")
    const cleaned = folder?.trim()
    if (!cleaned) return
    saveCustomFolders([...customFolders, cleaned])
  }, [customFolders, saveCustomFolders])

  const moveConversation = useCallback(async (conversation: ChatConversationSummary) => {
    const folder = window.prompt("Move to folder", folderAssignments[conversation.id] || conversation.folder || inferIssueFolder(conversation))
    if (!folder?.trim()) return
    const cleaned = folder.trim()
    saveCustomFolders([...customFolders, cleaned])
    saveFolderAssignments({ ...folderAssignments, [conversation.id]: cleaned })
    await patchConversation(conversation.id, { folder: cleaned }).catch(() => undefined)
  }, [customFolders, folderAssignments, patchConversation, saveCustomFolders, saveFolderAssignments])

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

  const renderConversationRow = (conversation: ChatConversationSummary) => {
    const active = conversation.id === activeConversationId
    const focusIndex = filteredConversations.findIndex((item) => item.id === conversation.id)
    return (
      <div
        key={conversation.id}
        className={cn(
          "group relative overflow-hidden rounded-xl border transition",
          active
            ? "border-cyan-200/24 bg-cyan-200/[0.075]"
            : "border-transparent hover:border-white/8 hover:bg-white/[0.055]"
        )}
      >
        {active ? <span className="absolute left-0 top-2 h-[calc(100%-1rem)] w-0.5 rounded-full bg-cyan-200" /> : null}
        <button
          type="button"
          ref={(node) => { itemRefs.current[focusIndex] = node }}
          onClick={() => openConversation(conversation.id)}
          className="w-full rounded-xl px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-cyan-400/30"
          data-testid="chat-history-item"
          aria-current={active ? "page" : undefined}
        >
          <span className="flex items-center gap-2 pr-7">
            {conversation.pinned ? <Pin size={12} className={cn("shrink-0", active ? "text-cyan-200" : "text-cyan-300")} /> : null}
            <span className={cn("line-clamp-1 text-[13px] font-medium leading-5", active ? "text-white" : "text-zinc-100")}>
              {conversation.title}
            </span>
          </span>
          <span className={cn("mt-0.5 line-clamp-1 block pr-7 text-[11px] leading-5", active ? "text-zinc-300" : "text-zinc-500")}>
            {conversation.lastMessagePreview}
          </span>
        </button>
        <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <details className="relative">
            <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-lg bg-black/70 text-zinc-400 shadow-sm transition hover:text-white">
              <MoreHorizontal size={15} />
              <span className="sr-only">Open chat actions</span>
            </summary>
            <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#151515] p-1 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
              <button type="button" onClick={() => renameConversation(conversation)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white">
                <Pencil size={13} /> Rename
              </button>
              <button type="button" onClick={() => moveConversation(conversation)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white">
                <Folder size={13} /> Move
              </button>
              <button type="button" onClick={() => patchConversation(conversation.id, { pinned: !conversation.pinned })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white">
                {conversation.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                {conversation.pinned ? "Unpin" : "Pin"}
              </button>
              <button type="button" onClick={() => exportConversation(conversation)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white">
                <Download size={13} /> Export
              </button>
              <button type="button" onClick={() => deleteConversation(conversation)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-300 hover:bg-red-500/10">
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </details>
        </div>
      </div>
    )
  }

  const fullSidebar = (
    <div className="flex h-full flex-col bg-[#030303] text-zinc-100" data-testid="chat-history-sidebar">
      <div className="border-b border-white/[0.07] px-3 py-3">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="OpenRx home">
            <BrandMark size="sm" tone="dark" />
            <BrandWordmark tone="dark" subtitle={false} titleClassName="text-[15px] font-semibold text-white" />
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="hidden rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white lg:inline-flex"
              aria-label="Collapse chat history"
              data-testid="chat-history-toggle"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close chat history"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={startNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/18 bg-cyan-200/[0.09] px-4 py-2.5 text-sm font-semibold text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-cyan-200/32 hover:bg-cyan-200/[0.14]"
          data-testid="chat-history-new"
        >
          <Plus size={16} />
          New chat
        </button>

        <button
          type="button"
          onClick={createFolder}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/18 hover:bg-white/[0.065] hover:text-white"
          data-testid="chat-folder-new"
        >
          <FolderPlus size={15} />
          New folder
        </button>

        <div className="relative mt-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            className="w-full rounded-2xl border border-white/10 bg-[#0b0c0c] py-2.5 pl-9 pr-3 text-sm text-zinc-50 placeholder:text-zinc-500 transition focus:border-cyan-300/45 focus:outline-none focus:ring-2 focus:ring-cyan-300/12"
            data-testid="chat-history-search"
            aria-label="Search chats"
          />
        </div>
      </div>

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        {loading ? (
          <div className="space-y-3 px-2 py-2" aria-label="Loading chat history">
            <div className="h-2 w-24 animate-pulse rounded-full bg-white/[0.08]" />
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-2 rounded-xl border border-white/[0.04] bg-white/[0.025] px-3 py-3">
                <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-white/[0.08]" />
                <div className="h-2 w-1/2 animate-pulse rounded-full bg-white/[0.055]" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-3 text-xs leading-5 text-amber-100">
            {error}
          </div>
        ) : conversations.length === 0 && customFolders.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-4 text-sm leading-6 text-zinc-400">
            No saved chats yet. Ask one question and OpenRx will keep the handoff here.
          </div>
        ) : filteredConversations.length === 0 && query ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-4 text-sm leading-6 text-zinc-400">
            No matching chats.
          </div>
        ) : (
          <div className="space-y-4">
            {pinnedConversations.length > 0 ? (
              <section aria-label="Pinned chats">
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">Pinned</p>
                <div className="space-y-1">{pinnedConversations.map(renderConversationRow)}</div>
              </section>
            ) : null}

            {issueFolders.map(([label, items]) => (
              <details key={label} open className="group/folder" aria-label={label}>
                <summary className="mb-1.5 flex cursor-pointer list-none items-center justify-between rounded-lg px-2 py-1.5 text-[12px] font-medium text-zinc-200 transition hover:bg-white/[0.06] hover:text-white">
                  <span className="flex items-center gap-2">
                    <Folder size={14} className="text-zinc-400" />
                    {label}
                  </span>
                  <span className="text-[11px] text-zinc-400">{items.length}</span>
                </summary>
                {items.length > 0 ? (
                  <div className="space-y-1">{items.map(renderConversationRow)}</div>
                ) : (
                  <p className="rounded-lg px-3 py-2 text-[12px] leading-5 text-zinc-400">Drop a chat here from the menu.</p>
                )}
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.07] px-3 py-3">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition hover:bg-white/[0.08]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-200 shadow-sm">
            <Settings size={15} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-zinc-100">{accountLabel}</span>
            <span className="block text-[11px] text-zinc-400">Settings and privacy</span>
          </span>
        </Link>
      </div>
    </div>
  )

  const collapsedSidebar = (
    <div className="flex h-full flex-col items-center bg-[#030303] py-4" data-testid="chat-history-sidebar">
      <Link href="/" aria-label="OpenRx home">
        <BrandMark size="sm" tone="dark" />
      </Link>
      <button
        type="button"
        onClick={startNewChat}
        className="mt-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200/18 bg-cyan-200/[0.10] text-cyan-50 transition hover:bg-cyan-200/[0.16]"
        aria-label="New chat"
        data-testid="chat-history-new"
      >
        <Plus size={18} />
      </button>
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="mt-2 flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/10 hover:text-white"
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
        className="mt-2 flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/10 hover:text-white"
        aria-label="Search chats"
      >
        <Search size={17} />
      </button>
      <Link
        href="/profile"
        className="mt-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-zinc-400 transition hover:text-white"
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
        className="fixed left-4 top-4 z-50 rounded-xl border border-white/10 bg-[#0b0b0b]/92 p-2.5 text-zinc-200 shadow-card transition hover:text-white lg:hidden"
        aria-label="Open chat history"
        data-testid="chat-history-mobile-toggle"
      >
        <Menu size={18} />
      </button>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[320px] flex-col border-r border-white/[0.07] bg-[#030303] transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Chat history"
      >
        {fullSidebar}
      </aside>

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-white/[0.07] bg-[#030303] transition-[width] duration-200 lg:flex",
          collapsed ? "w-[76px]" : "w-[308px]"
        )}
        aria-label="Chat history"
      >
        {collapsed ? collapsedSidebar : fullSidebar}
      </aside>
    </>
  )
}
