import crypto from "crypto"
import { promises as fs } from "fs"
import os from "os"
import path from "path"

export type ChatHistoryRole = "user" | "agent" | "system"

export type ChatHistoryMessage = {
  id: string
  role: ChatHistoryRole
  content: string
  agentId?: string
  collaborators?: string[]
  routingInfo?: string
  createdAt: string
}

export type ChatConversation = {
  id: string
  ownerKey: string
  title: string
  pinned: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
  messages: ChatHistoryMessage[]
}

export type ChatConversationSummary = Omit<ChatConversation, "ownerKey" | "messages"> & {
  messageCount: number
  lastMessagePreview: string
}

type ChatHistoryFile = {
  version: 1
  conversations: ChatConversation[]
}

const MAX_CONVERSATIONS_PER_OWNER = 80
const MAX_MESSAGES_PER_CONVERSATION = 80
const MAX_MESSAGE_CHARS = 12000
const STORE_PATH =
  process.env.OPENRX_CHAT_HISTORY_PATH ||
  path.join(os.tmpdir(), "openrx-chat-history.json")

let writeQueue = Promise.resolve()

function nowIso() {
  return new Date().toISOString()
}

function cleanContent(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_CHARS)
}

function cleanMessageContent(content: string): string {
  return content
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .trim()
    .slice(0, MAX_MESSAGE_CHARS)
}

function normalizeOwnerSecret(value: string): string {
  return value.trim().toLowerCase()
}

export function chatOwnerKeyFromWallet(walletAddress: string): string {
  return `wallet:${crypto.createHash("sha256").update(normalizeOwnerSecret(walletAddress)).digest("hex")}`
}

export function chatOwnerKeyFromSession(sessionId: string): string {
  return `session:${crypto.createHash("sha256").update(normalizeOwnerSecret(sessionId)).digest("hex")}`
}

export function generateConversationTitle(message: string): string {
  const cleaned = message
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\w\s?'":,.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!cleaned) return "New clinical question"

  const normalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  if (normalized.length <= 58) return normalized

  const truncated = normalized.slice(0, 58)
  const boundary = truncated.lastIndexOf(" ")
  return `${(boundary > 28 ? truncated.slice(0, boundary) : truncated).replace(/[,.:-]+$/, "")}...`
}

async function readStore(): Promise<ChatHistoryFile> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<ChatHistoryFile>
    if (parsed.version !== 1 || !Array.isArray(parsed.conversations)) {
      return { version: 1, conversations: [] }
    }
    return { version: 1, conversations: parsed.conversations }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, conversations: [] }
    }
    return { version: 1, conversations: [] }
  }
}

async function writeStore(store: ChatHistoryFile): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  const tempPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(store, null, 2), "utf8")
  await fs.rename(tempPath, STORE_PATH)
}

async function mutateStore<T>(mutator: (store: ChatHistoryFile) => T | Promise<T>): Promise<T> {
  const run = writeQueue.then(async () => {
    const store = await readStore()
    const result = await mutator(store)
    await writeStore(store)
    return result
  })
  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

function toSummary(conversation: ChatConversation): ChatConversationSummary {
  const lastMessage = [...conversation.messages].reverse().find((message) => message.role !== "system")
  const preview = lastMessage
    ? cleanContent(lastMessage.content)
        .replace(/^Direct answer:\s*/i, "")
        .replace(/^Direct answer\s*/i, "")
        .replace(/^References\s*/i, "")
        .slice(0, 96)
    : "No messages yet"
  return {
    id: conversation.id,
    title: conversation.title,
    pinned: conversation.pinned,
    archived: conversation.archived,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
    lastMessagePreview: preview,
  }
}

function sortConversations(a: ChatConversation, b: ChatConversation): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

function enforceOwnerLimit(store: ChatHistoryFile, ownerKey: string) {
  const ownerConversations = store.conversations
    .filter((conversation) => conversation.ownerKey === ownerKey && !conversation.pinned)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const excess = ownerConversations.slice(MAX_CONVERSATIONS_PER_OWNER)
  if (excess.length === 0) return

  const excessIds = new Set(excess.map((conversation) => conversation.id))
  store.conversations = store.conversations.filter((conversation) => !excessIds.has(conversation.id))
}

export async function listChatConversations(ownerKey: string): Promise<ChatConversationSummary[]> {
  const store = await readStore()
  return store.conversations
    .filter((conversation) => conversation.ownerKey === ownerKey && !conversation.archived)
    .sort(sortConversations)
    .map(toSummary)
}

export async function getChatConversation(ownerKey: string, conversationId: string): Promise<ChatConversation | null> {
  const store = await readStore()
  const conversation = store.conversations.find(
    (item) => item.ownerKey === ownerKey && item.id === conversationId && !item.archived
  )
  return conversation || null
}

export async function createChatConversation(params: {
  ownerKey: string
  title?: string
  initialMessage?: ChatHistoryMessage
}): Promise<ChatConversation> {
  return mutateStore((store) => {
    const createdAt = nowIso()
    const conversation: ChatConversation = {
      id: crypto.randomUUID(),
      ownerKey: params.ownerKey,
      title: params.title?.trim() || (params.initialMessage ? generateConversationTitle(params.initialMessage.content) : "New clinical question"),
      pinned: false,
      archived: false,
      createdAt,
      updatedAt: createdAt,
      messages: params.initialMessage ? [params.initialMessage] : [],
    }

    store.conversations.push(conversation)
    enforceOwnerLimit(store, params.ownerKey)
    return conversation
  })
}

export async function appendChatExchange(params: {
  ownerKey: string
  conversationId?: string
  userContent: string
  agentContent: string
  agentId?: string
  collaborators?: string[]
  routingInfo?: string
}): Promise<ChatConversation> {
  return mutateStore((store) => {
    const timestamp = nowIso()
    let conversation = params.conversationId
      ? store.conversations.find(
          (item) => item.ownerKey === params.ownerKey && item.id === params.conversationId && !item.archived
        )
      : undefined

    const userMessage: ChatHistoryMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: cleanMessageContent(params.userContent),
      createdAt: timestamp,
    }

    const agentMessage: ChatHistoryMessage = {
      id: crypto.randomUUID(),
      role: "agent",
      content: cleanMessageContent(params.agentContent),
      agentId: params.agentId,
      collaborators: params.collaborators?.filter(Boolean),
      routingInfo: params.routingInfo,
      createdAt: timestamp,
    }

    if (!conversation) {
      conversation = {
        id: crypto.randomUUID(),
        ownerKey: params.ownerKey,
        title: generateConversationTitle(params.userContent),
        pinned: false,
        archived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        messages: [],
      }
      store.conversations.push(conversation)
    }

    conversation.messages.push(userMessage, agentMessage)
    conversation.messages = conversation.messages.slice(-MAX_MESSAGES_PER_CONVERSATION)
    conversation.updatedAt = timestamp
    if (!conversation.title || conversation.title === "New clinical question") {
      conversation.title = generateConversationTitle(params.userContent)
    }

    enforceOwnerLimit(store, params.ownerKey)
    return conversation
  })
}

export async function updateChatConversation(params: {
  ownerKey: string
  conversationId: string
  title?: string
  pinned?: boolean
  archived?: boolean
}): Promise<ChatConversation | null> {
  return mutateStore((store) => {
    const conversation = store.conversations.find(
      (item) => item.ownerKey === params.ownerKey && item.id === params.conversationId
    )
    if (!conversation) return null

    if (typeof params.title === "string") {
      conversation.title = generateConversationTitle(params.title)
    }
    if (typeof params.pinned === "boolean") conversation.pinned = params.pinned
    if (typeof params.archived === "boolean") conversation.archived = params.archived
    conversation.updatedAt = nowIso()
    return conversation
  })
}

export async function deleteChatConversation(ownerKey: string, conversationId: string): Promise<boolean> {
  return mutateStore((store) => {
    const before = store.conversations.length
    store.conversations = store.conversations.filter(
      (conversation) => !(conversation.ownerKey === ownerKey && conversation.id === conversationId)
    )
    return store.conversations.length !== before
  })
}
