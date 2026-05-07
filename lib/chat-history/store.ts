import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import type {
  ChatConversationDetail,
  ChatConversationSummary,
  ChatHistoryAppendInput,
  ChatHistoryPatch,
  ChatTranscriptMessage,
} from "./types"

interface OwnerStore {
  ownerId: string
  conversations: ChatConversationDetail[]
  updatedAt: string
}

interface RootStore {
  version: number
  owners: Record<string, OwnerStore>
}

const VERSION = 1
const MAX_CONVERSATIONS_PER_OWNER = 200
const MAX_MESSAGES_PER_CONVERSATION = 600
const MAX_TITLE = 80

function resolveStorePath(): string {
  const configured = process.env.OPENRX_CHAT_HISTORY_STORE_PATH
  if (configured) return configured
  return path.join(process.cwd(), ".openrx-chat-history.json")
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readRoot(): RootStore {
  const filePath = resolveStorePath()
  try {
    if (!fs.existsSync(filePath)) return { version: VERSION, owners: {} }
    const raw = fs.readFileSync(filePath, "utf-8")
    if (!raw.trim()) return { version: VERSION, owners: {} }
    const parsed = JSON.parse(raw) as RootStore
    if (!parsed || typeof parsed !== "object" || !parsed.owners) {
      return { version: VERSION, owners: {} }
    }
    return parsed
  } catch {
    return { version: VERSION, owners: {} }
  }
}

function writeRoot(root: RootStore) {
  const filePath = resolveStorePath()
  ensureDir(filePath)
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tmp, JSON.stringify(root, null, 2), "utf-8")
  fs.renameSync(tmp, filePath)
}

function getOwnerStore(root: RootStore, ownerId: string): OwnerStore {
  let owner = root.owners[ownerId]
  if (!owner) {
    owner = { ownerId, conversations: [], updatedAt: new Date().toISOString() }
    root.owners[ownerId] = owner
  }
  return owner
}

function summarize(conversation: ChatConversationDetail): ChatConversationSummary {
  const lastUserMessage = [...conversation.messages].reverse().find((m) => m.role === "user")
  const preview = lastUserMessage?.content?.slice(0, 140) || conversation.title
  return {
    id: conversation.id,
    title: conversation.title,
    pinned: conversation.pinned,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
    preview,
  }
}

function deriveTitle(seed: string): string {
  const trimmed = seed.replace(/\s+/g, " ").trim()
  if (!trimmed) return "New chat"
  // cut at sentence-ish boundary, then enforce max length
  const firstSentence = trimmed.split(/(?<=[.!?])\s/)[0] || trimmed
  if (firstSentence.length <= MAX_TITLE) return firstSentence
  // back off to last word boundary under MAX_TITLE
  const cropped = firstSentence.slice(0, MAX_TITLE)
  const lastSpace = cropped.lastIndexOf(" ")
  return (lastSpace > MAX_TITLE * 0.6 ? cropped.slice(0, lastSpace) : cropped).trimEnd() + "…"
}

export function createMessageId(prefix: "user" | "agent" | "system"): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function listConversations(ownerId: string): ChatConversationSummary[] {
  const root = readRoot()
  const owner = root.owners[ownerId]
  if (!owner) return []
  return owner.conversations
    .map(summarize)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
}

export function getConversation(ownerId: string, conversationId: string): ChatConversationDetail | null {
  const root = readRoot()
  const owner = root.owners[ownerId]
  if (!owner) return null
  return owner.conversations.find((c) => c.id === conversationId) || null
}

export function appendMessage(
  ownerId: string,
  input: ChatHistoryAppendInput
): { conversationId: string; conversation: ChatConversationDetail } {
  const root = readRoot()
  const owner = getOwnerStore(root, ownerId)

  let conversation = input.conversationId
    ? owner.conversations.find((c) => c.id === input.conversationId)
    : undefined

  const now = new Date().toISOString()

  if (!conversation) {
    conversation = {
      id: input.conversationId || `conv_${crypto.randomUUID()}`,
      title: input.derivedTitle ? deriveTitle(input.derivedTitle) : "New chat",
      pinned: false,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      preview: "",
      messages: [],
    }
    owner.conversations.unshift(conversation)
  } else if (conversation.title === "New chat" && input.message.role === "user") {
    conversation.title = deriveTitle(input.message.content)
  }

  conversation.messages.push(input.message)
  if (conversation.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
    conversation.messages.splice(0, conversation.messages.length - MAX_MESSAGES_PER_CONVERSATION)
  }
  conversation.messageCount = conversation.messages.length
  conversation.updatedAt = now
  conversation.preview = input.message.content.slice(0, 140)

  if (owner.conversations.length > MAX_CONVERSATIONS_PER_OWNER) {
    const overflow = owner.conversations.length - MAX_CONVERSATIONS_PER_OWNER
    // remove oldest non-pinned conversations first
    const removable = owner.conversations
      .filter((c) => !c.pinned)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, overflow)
      .map((c) => c.id)
    owner.conversations = owner.conversations.filter((c) => !removable.includes(c.id))
  }

  owner.updatedAt = now
  writeRoot(root)
  return { conversationId: conversation.id, conversation }
}

export function patchConversation(
  ownerId: string,
  conversationId: string,
  patch: ChatHistoryPatch
): ChatConversationDetail | null {
  const root = readRoot()
  const owner = root.owners[ownerId]
  if (!owner) return null
  const conversation = owner.conversations.find((c) => c.id === conversationId)
  if (!conversation) return null
  if (typeof patch.title === "string") {
    const cleaned = patch.title.trim().slice(0, MAX_TITLE)
    if (cleaned) conversation.title = cleaned
  }
  if (typeof patch.pinned === "boolean") {
    conversation.pinned = patch.pinned
  }
  conversation.updatedAt = new Date().toISOString()
  writeRoot(root)
  return conversation
}

export function deleteConversation(ownerId: string, conversationId: string): boolean {
  const root = readRoot()
  const owner = root.owners[ownerId]
  if (!owner) return false
  const before = owner.conversations.length
  owner.conversations = owner.conversations.filter((c) => c.id !== conversationId)
  if (owner.conversations.length === before) return false
  owner.updatedAt = new Date().toISOString()
  writeRoot(root)
  return true
}

export function clearAllForOwner(ownerId: string): number {
  const root = readRoot()
  const owner = root.owners[ownerId]
  if (!owner) return 0
  const removed = owner.conversations.length
  owner.conversations = []
  owner.updatedAt = new Date().toISOString()
  writeRoot(root)
  return removed
}

export function exportConversation(ownerId: string, conversationId: string): string | null {
  const conversation = getConversation(ownerId, conversationId)
  if (!conversation) return null
  const lines: string[] = []
  lines.push(`# ${conversation.title}`)
  lines.push("")
  lines.push(`_Created ${conversation.createdAt} · Updated ${conversation.updatedAt}_`)
  lines.push("")
  for (const message of conversation.messages) {
    const speaker = message.role === "user" ? "You" : message.role === "agent" ? "OpenRx" : "System"
    lines.push(`**${speaker}** — ${message.createdAt}`)
    lines.push("")
    lines.push(message.content)
    lines.push("")
  }
  return lines.join("\n")
}

export const __test = {
  deriveTitle,
  resolveStorePath,
}

export function makeMessage(
  role: "user" | "agent" | "system",
  content: string,
  agentId?: string
): ChatTranscriptMessage {
  return {
    id: createMessageId(role),
    role,
    content,
    agentId,
    createdAt: new Date().toISOString(),
  }
}
