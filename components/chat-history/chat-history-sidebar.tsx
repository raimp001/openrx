"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  Edit3,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"
import type { ChatConversationSummary } from "@/lib/chat-history/types"
import { cn } from "@/lib/utils"

export type ChatHistoryGrouping = "today" | "yesterday" | "previous-7" | "previous-30" | "older"

const GROUP_ORDER: ChatHistoryGrouping[] = [
  "today",
  "yesterday",
  "previous-7",
  "previous-30",
  "older",
]

const GROUP_LABEL: Record<ChatHistoryGrouping, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "previous-7": "Previous 7 days",
  "previous-30": "Previous 30 days",
  older: "Older",
}

function dayDiff(later: Date, earlier: Date): number {
  const ms = later.getTime() - earlier.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function groupConversation(
  conversation: ChatConversationSummary,
  now = new Date()
): ChatHistoryGrouping {
  const updated = new Date(conversation.updatedAt)
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfUpdated = new Date(updated.getFullYear(), updated.getMonth(), updated.getDate())
  const diff = dayDiff(startOfNow, startOfUpdated)
  if (diff <= 0) return "today"
  if (diff === 1) return "yesterday"
  if (diff <= 7) return "previous-7"
  if (diff <= 30) return "previous-30"
  return "older"
}

interface SidebarProps {
  conversations: ChatConversationSummary[]
  activeConversationId: string | null
  isLoading: boolean
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapsed: () => void
  onCloseMobile: () => void
  onNewChat: () => void
  onSelectConversation: (id: string) => void
  onRenameConversation: (id: string, title: string) => Promise<void> | void
  onTogglePinned: (id: string, pinned: boolean) => Promise<void> | void
  onDeleteConversation: (id: string) => Promise<void> | void
  onExportConversation?: (id: string) => void
  onOpenAccount?: () => void
}

export function ChatHistorySidebar(props: SidebarProps) {
  const {
    conversations,
    activeConversationId,
    isLoading,
    collapsed,
    mobileOpen,
    onToggleCollapsed,
    onCloseMobile,
    onNewChat,
    onSelectConversation,
    onRenameConversation,
    onTogglePinned,
    onDeleteConversation,
    onExportConversation,
  } = props

  const [search, setSearch] = useState("")
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function close(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (target.closest("[data-conversation-menu]")) return
      setOpenMenuId(null)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) =>
      c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q)
    )
  }, [conversations, search])

  const grouped = useMemo(() => {
    const buckets: Record<ChatHistoryGrouping, ChatConversationSummary[]> = {
      today: [],
      yesterday: [],
      "previous-7": [],
      "previous-30": [],
      older: [],
    }
    const pinned: ChatConversationSummary[] = []
    for (const conversation of filtered) {
      if (conversation.pinned) {
        pinned.push(conversation)
        continue
      }
      buckets[groupConversation(conversation)].push(conversation)
    }
    return { pinned, buckets }
  }, [filtered])

  const sidebar = (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col border-r border-border bg-white",
        collapsed ? "w-[64px]" : "w-[280px]"
      )}
      data-testid="chat-history-sidebar"
      data-collapsed={collapsed}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        {!collapsed && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Chat history
          </p>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted transition hover:bg-surface-2 hover:text-primary"
          aria-label={collapsed ? "Expand chat history" : "Collapse chat history"}
          data-testid="chat-history-collapse-toggle"
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted transition hover:bg-surface-2 hover:text-primary md:hidden"
          aria-label="Close chat history"
          data-testid="chat-history-close-drawer"
        >
          <X size={15} />
        </button>
      </div>

      <div className={cn("px-3 pt-3", collapsed && "px-2")}>
        <button
          type="button"
          onClick={onNewChat}
          className={cn(
            "group inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-navy px-3 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(11,27,51,0.18)] transition hover:bg-navy-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal",
            collapsed && "h-10 w-10 px-0"
          )}
          aria-label="Start a new chat"
          data-testid="chat-history-new"
        >
          <Plus size={14} />
          {!collapsed && <span>New chat</span>}
          {!collapsed && (
            <span className="ml-auto hidden rounded-md border border-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/70 lg:inline">
              ⌘⇧O
            </span>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pt-3">
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search past chats"
              className="w-full rounded-[8px] border border-border bg-surface py-2 pl-8 pr-9 text-[13px] text-primary placeholder:text-subtle focus:border-teal/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal/15"
              aria-label="Search past chats"
              data-testid="chat-history-search"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-border-strong bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted lg:block"
            >
              ⌘K
            </span>
          </div>
        </div>
      )}

      {/* List */}
      <nav
        className={cn(
          "mt-3 flex-1 overflow-y-auto px-2 pb-3",
          collapsed && "px-1"
        )}
        aria-label="Past conversations"
        data-testid="chat-history-list"
      >
        {isLoading ? (
          <ul className="space-y-1.5 p-2" aria-hidden>
            {[...Array(5)].map((_, i) => (
              <li
                key={i}
                className="h-9 animate-pulse rounded-[8px] bg-surface-2"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </ul>
        ) : conversations.length === 0 ? (
          <EmptyState collapsed={collapsed} />
        ) : filtered.length === 0 ? (
          <p
            className="px-3 py-4 text-[12px] text-muted"
            data-testid="chat-history-no-results"
          >
            No chats match “{search}”.
          </p>
        ) : (
          <Fragment>
            {grouped.pinned.length > 0 && (
              <Group
                label="Pinned"
                items={grouped.pinned}
                collapsed={collapsed}
                renderItem={(conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    active={conversation.id === activeConversationId}
                    collapsed={collapsed}
                    isRenaming={renamingId === conversation.id}
                    renameValue={renameValue}
                    setRenameValue={setRenameValue}
                    setRenamingId={setRenamingId}
                    isMenuOpen={openMenuId === conversation.id}
                    setOpenMenuId={setOpenMenuId}
                    onSelect={() => onSelectConversation(conversation.id)}
                    onRename={(title) => onRenameConversation(conversation.id, title)}
                    onTogglePinned={() => onTogglePinned(conversation.id, !conversation.pinned)}
                    onDelete={() => onDeleteConversation(conversation.id)}
                    onExport={
                      onExportConversation
                        ? () => onExportConversation(conversation.id)
                        : undefined
                    }
                  />
                )}
              />
            )}
            {GROUP_ORDER.map((group) => {
              const items = grouped.buckets[group]
              if (!items.length) return null
              return (
                <Group
                  key={group}
                  label={GROUP_LABEL[group]}
                  collapsed={collapsed}
                  items={items}
                  renderItem={(conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      active={conversation.id === activeConversationId}
                      collapsed={collapsed}
                      isRenaming={renamingId === conversation.id}
                      renameValue={renameValue}
                      setRenameValue={setRenameValue}
                      setRenamingId={setRenamingId}
                      isMenuOpen={openMenuId === conversation.id}
                      setOpenMenuId={setOpenMenuId}
                      onSelect={() => onSelectConversation(conversation.id)}
                      onRename={(title) => onRenameConversation(conversation.id, title)}
                      onTogglePinned={() => onTogglePinned(conversation.id, !conversation.pinned)}
                      onDelete={() => onDeleteConversation(conversation.id)}
                      onExport={
                        onExportConversation
                          ? () => onExportConversation(conversation.id)
                          : undefined
                      }
                    />
                  )}
                />
              )
            })}
          </Fragment>
        )}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <div className="text-[11px] text-muted">
          {!collapsed ? (
            <p>
              Saved in your browser session. Decision support — not a substitute for clinician judgment.
            </p>
          ) : (
            <span aria-hidden>·</span>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <Fragment>
      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden",
          mobileOpen ? "block" : "hidden"
        )}
        onClick={onCloseMobile}
        aria-hidden={!mobileOpen}
        data-testid="chat-history-drawer-scrim"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!mobileOpen}
        data-testid="chat-history-drawer"
      >
        {sidebar}
      </aside>
      {/* Desktop pane */}
      <aside
        className="hidden h-full md:flex"
        aria-label="Chat history"
        data-testid="chat-history-pane"
      >
        {sidebar}
      </aside>
    </Fragment>
  )
}

function EmptyState({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return <div className="py-2 text-center text-[11px] text-muted">—</div>
  }
  return (
    <div
      className="rounded-[10px] border border-dashed border-border bg-surface-2/60 px-3 py-4 text-[12px] leading-5 text-muted"
      data-testid="chat-history-empty"
    >
      <p className="font-semibold text-secondary">No conversations yet.</p>
      <p className="mt-1">
        Ask a clinical question and OpenRx will save the answer here for next time.
      </p>
    </div>
  )
}

interface GroupProps {
  label: string
  items: ChatConversationSummary[]
  collapsed: boolean
  renderItem: (conversation: ChatConversationSummary) => React.ReactNode
}

function Group({ label, items, collapsed, renderItem }: GroupProps) {
  if (collapsed) {
    return (
      <div className="my-1 space-y-0.5">
        {items.map((conversation) => renderItem(conversation))}
      </div>
    )
  }
  return (
    <div className="mb-3">
      <p className="px-2 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <ul className="space-y-0.5" role="list">
        {items.map((conversation) => (
          <li key={conversation.id}>{renderItem(conversation)}</li>
        ))}
      </ul>
    </div>
  )
}

interface ItemProps {
  conversation: ChatConversationSummary
  active: boolean
  collapsed: boolean
  isRenaming: boolean
  renameValue: string
  setRenameValue: (value: string) => void
  setRenamingId: (id: string | null) => void
  isMenuOpen: boolean
  setOpenMenuId: (id: string | null) => void
  onSelect: () => void
  onRename: (title: string) => Promise<void> | void
  onTogglePinned: () => Promise<void> | void
  onDelete: () => Promise<void> | void
  onExport?: () => void
}

function ConversationItem({
  conversation,
  active,
  collapsed,
  isRenaming,
  renameValue,
  setRenameValue,
  setRenamingId,
  isMenuOpen,
  setOpenMenuId,
  onSelect,
  onRename,
  onTogglePinned,
  onDelete,
  onExport,
}: ItemProps) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "mx-auto flex h-9 w-9 items-center justify-center rounded-[8px] text-[12px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal",
          active
            ? "bg-navy text-white"
            : "bg-surface-2 text-secondary hover:bg-surface-2/70 hover:text-primary"
        )}
        aria-label={conversation.title}
        title={conversation.title}
        data-testid="chat-history-item"
        data-conversation-id={conversation.id}
        data-active={active ? "true" : undefined}
      >
        {conversation.title.charAt(0).toUpperCase() || "·"}
      </button>
    )
  }
  return (
    <div
      className={cn(
        "group relative flex items-center gap-1 rounded-[8px] px-2 py-1.5 text-[13px] transition",
        active
          ? "bg-surface-2 text-primary"
          : "text-secondary hover:bg-surface-2/70 hover:text-primary"
      )}
      data-testid="chat-history-item"
      data-conversation-id={conversation.id}
      data-active={active ? "true" : undefined}
    >
      {isRenaming ? (
        <form
          className="flex-1"
          onSubmit={async (event) => {
            event.preventDefault()
            const next = renameValue.trim()
            if (!next) {
              setRenamingId(null)
              return
            }
            await onRename(next)
            setRenamingId(null)
          }}
        >
          <input
            type="text"
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onBlur={() => setRenamingId(null)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setRenamingId(null)
            }}
            className="w-full rounded-md border border-border-strong bg-white px-2 py-1 text-[13px] text-primary focus:border-teal/40 focus:outline-none focus:ring-2 focus:ring-teal/20"
            aria-label="Rename conversation"
            data-testid="chat-history-rename-input"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 truncate text-left focus-visible:outline-none"
          aria-current={active ? "page" : undefined}
        >
          {conversation.pinned ? (
            <Pin size={11} className="shrink-0 text-teal" />
          ) : null}
          <span className="truncate">{conversation.title}</span>
        </button>
      )}

      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 transition",
          isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        )}
        data-conversation-menu
      >
        <button
          type="button"
          onClick={() => setOpenMenuId(isMenuOpen ? null : conversation.id)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-white hover:text-primary"
          aria-label="Conversation options"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          data-testid="chat-history-item-menu"
        >
          <MenuDotsIcon />
        </button>
        {isMenuOpen ? (
          <div
            role="menu"
            data-conversation-menu
            className="absolute right-1 top-full z-10 mt-1 w-44 overflow-hidden rounded-[10px] border border-border bg-white shadow-card"
            data-testid="chat-history-item-menu-list"
          >
            <MenuButton
              icon={<Edit3 size={12} />}
              label="Rename"
              testId="chat-history-rename-action"
              onClick={() => {
                setRenamingId(conversation.id)
                setRenameValue(conversation.title)
                setOpenMenuId(null)
              }}
            />
            <MenuButton
              icon={conversation.pinned ? <PinOff size={12} /> : <Pin size={12} />}
              label={conversation.pinned ? "Unpin" : "Pin to top"}
              testId="chat-history-pin-action"
              onClick={async () => {
                await onTogglePinned()
                setOpenMenuId(null)
              }}
            />
            {onExport ? (
              <MenuButton
                icon={<Check size={12} />}
                label="Export as Markdown"
                testId="chat-history-export-action"
                onClick={() => {
                  onExport()
                  setOpenMenuId(null)
                }}
              />
            ) : null}
            <div className="my-1 border-t border-border" />
            <MenuButton
              icon={<Trash2 size={12} />}
              label="Delete"
              testId="chat-history-delete-action"
              destructive
              onClick={async () => {
                if (typeof window !== "undefined" && !window.confirm("Delete this conversation? This cannot be undone.")) {
                  setOpenMenuId(null)
                  return
                }
                await onDelete()
                setOpenMenuId(null)
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MenuDotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="3" cy="7" r="1.2" fill="currentColor" />
      <circle cx="7" cy="7" r="1.2" fill="currentColor" />
      <circle cx="11" cy="7" r="1.2" fill="currentColor" />
    </svg>
  )
}

interface MenuButtonProps {
  icon: React.ReactNode
  label: string
  testId: string
  destructive?: boolean
  onClick: () => void
}

function MenuButton({ icon, label, testId, destructive, onClick }: MenuButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal",
        destructive
          ? "text-danger hover:bg-red-50"
          : "text-secondary hover:bg-surface-2 hover:text-primary"
      )}
    >
      <span className={cn("text-muted", destructive && "text-danger")} aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  )
}
