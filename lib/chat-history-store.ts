import crypto from "crypto"
import { promises as fs } from "fs"
import os from "os"
import path from "path"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

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
const MAX_PINNED_CONVERSATIONS_PER_OWNER = 20
const MAX_MESSAGES_PER_CONVERSATION = 80
const MAX_MESSAGE_CHARS = 12000
const STORE_PATH =
  process.env.OPENRX_CHAT_HISTORY_PATH ||
  path.join(os.tmpdir(), "openrx-chat-history.json")

let writeQueue = Promise.resolve()

function nowIso() {
  return new Date().toISOString()
}

function isDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL)
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

function previewFromMessages(messages: ChatHistoryMessage[]): string {
  const lastMessage = [...messages].reverse().find((message) => message.role !== "system")
  if (!lastMessage) return "No messages yet"
  return cleanContent(lastMessage.content)
    .replace(/^Direct answer:\s*/i, "")
    .replace(/^Direct answer\s*/i, "")
    .replace(/^References\s*/i, "")
    .slice(0, 96)
}

// ── File engine ───────────────────────────────────────────────────────────

async function readFileStore(): Promise<ChatHistoryFile> {
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

async function writeFileStore(store: ChatHistoryFile): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  const tempPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(store, null, 2), "utf8")
  await fs.rename(tempPath, STORE_PATH)
}

async function mutateFileStore<T>(mutator: (store: ChatHistoryFile) => T | Promise<T>): Promise<T> {
  const run = writeQueue.then(async () => {
    const store = await readFileStore()
    const result = await mutator(store)
    await writeFileStore(store)
    return result
  })
  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

function fileToSummary(conversation: ChatConversation): ChatConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    pinned: conversation.pinned,
    archived: conversation.archived,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
    lastMessagePreview: previewFromMessages(conversation.messages),
  }
}

function sortConversations(a: ChatConversation, b: ChatConversation): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

function enforceFileOwnerLimit(store: ChatHistoryFile, ownerKey: string) {
  const owned = store.conversations.filter((c) => c.ownerKey === ownerKey)
  const sortedByRecency = [...owned].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  const pinned = sortedByRecency.filter((c) => c.pinned)
  const unpinned = sortedByRecency.filter((c) => !c.pinned)

  const excessPinnedIds = new Set(
    pinned.slice(MAX_PINNED_CONVERSATIONS_PER_OWNER).map((c) => c.id)
  )
  if (excessPinnedIds.size > 0) {
    for (const conversation of store.conversations) {
      if (excessPinnedIds.has(conversation.id)) conversation.pinned = false
    }
  }

  const allowedUnpinned = Math.max(
    0,
    MAX_CONVERSATIONS_PER_OWNER - Math.min(pinned.length, MAX_PINNED_CONVERSATIONS_PER_OWNER)
  )
  const excessUnpinnedIds = new Set(unpinned.slice(allowedUnpinned).map((c) => c.id))
  if (excessUnpinnedIds.size > 0) {
    store.conversations = store.conversations.filter((c) => !excessUnpinnedIds.has(c.id))
  }
}

// ── Prisma engine ─────────────────────────────────────────────────────────

type PrismaTx = Prisma.TransactionClient

type ConversationRow = {
  id: string
  ownerKey: string
  title: string
  pinned: boolean
  archived: boolean
  createdAt: Date
  updatedAt: Date
}

type MessageRow = {
  id: string
  conversationId: string
  role: string
  content: string
  agentId: string | null
  collaborators: string[]
  routingInfo: string | null
  createdAt: Date
}

function rowToMessage(row: MessageRow): ChatHistoryMessage {
  const message: ChatHistoryMessage = {
    id: row.id,
    role: row.role as ChatHistoryRole,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  }
  if (row.agentId) message.agentId = row.agentId
  if (row.collaborators?.length) message.collaborators = row.collaborators
  if (row.routingInfo) message.routingInfo = row.routingInfo
  return message
}

function rowToConversation(
  conversation: ConversationRow,
  messages: MessageRow[]
): ChatConversation {
  return {
    id: conversation.id,
    ownerKey: conversation.ownerKey,
    title: conversation.title,
    pinned: conversation.pinned,
    archived: conversation.archived,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: messages.map(rowToMessage),
  }
}

async function enforcePrismaOwnerLimit(tx: PrismaTx, ownerKey: string): Promise<void> {
  const owned = await tx.chatConversationRecord.findMany({
    where: { ownerKey },
    orderBy: { updatedAt: "desc" },
    select: { id: true, pinned: true, updatedAt: true },
  })

  const pinned = owned.filter((c) => c.pinned)
  const unpinned = owned.filter((c) => !c.pinned)

  const excessPinnedIds = pinned.slice(MAX_PINNED_CONVERSATIONS_PER_OWNER).map((c) => c.id)
  if (excessPinnedIds.length > 0) {
    await tx.chatConversationRecord.updateMany({
      where: { id: { in: excessPinnedIds } },
      data: { pinned: false },
    })
  }

  const allowedUnpinned = Math.max(
    0,
    MAX_CONVERSATIONS_PER_OWNER - Math.min(pinned.length, MAX_PINNED_CONVERSATIONS_PER_OWNER)
  )
  const excessUnpinnedIds = unpinned.slice(allowedUnpinned).map((c) => c.id)
  if (excessUnpinnedIds.length > 0) {
    await tx.chatConversationRecord.deleteMany({
      where: { id: { in: excessUnpinnedIds } },
    })
  }
}

async function trimConversationMessages(tx: PrismaTx, conversationId: string): Promise<void> {
  const total = await tx.chatMessageRecord.count({ where: { conversationId } })
  if (total <= MAX_MESSAGES_PER_CONVERSATION) return
  const overflow = await tx.chatMessageRecord.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: total - MAX_MESSAGES_PER_CONVERSATION,
    select: { id: true },
  })
  if (overflow.length === 0) return
  await tx.chatMessageRecord.deleteMany({
    where: { id: { in: overflow.map((m) => m.id) } },
  })
}

async function loadPrismaConversation(
  tx: PrismaTx | typeof prisma,
  ownerKey: string,
  conversationId: string,
  options: { allowArchived?: boolean } = {}
): Promise<ChatConversation | null> {
  const where: Prisma.ChatConversationRecordWhereInput = { id: conversationId, ownerKey }
  if (!options.allowArchived) where.archived = false
  const row = await tx.chatConversationRecord.findFirst({ where })
  if (!row) return null
  const messages = await tx.chatMessageRecord.findMany({
    where: { conversationId: row.id },
    orderBy: { createdAt: "asc" },
  })
  return rowToConversation(row, messages)
}

// ── Public API ────────────────────────────────────────────────────────────

export async function listChatConversations(ownerKey: string): Promise<ChatConversationSummary[]> {
  if (isDatabaseEnabled()) {
    const rows = await prisma.chatConversationRecord.findMany({
      where: { ownerKey, archived: false },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: MAX_CONVERSATIONS_PER_OWNER * 2,
    })
    if (rows.length === 0) return []
    const conversationIds = rows.map((row) => row.id)
    const messages = await prisma.chatMessageRecord.findMany({
      where: { conversationId: { in: conversationIds } },
      orderBy: { createdAt: "asc" },
    })
    const messagesByConversation = new Map<string, MessageRow[]>()
    for (const message of messages) {
      const list = messagesByConversation.get(message.conversationId) || []
      list.push(message)
      messagesByConversation.set(message.conversationId, list)
    }
    return rows.map((row) => {
      const conversationMessages = messagesByConversation.get(row.id) || []
      return {
        id: row.id,
        title: row.title,
        pinned: row.pinned,
        archived: row.archived,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        messageCount: conversationMessages.length,
        lastMessagePreview: previewFromMessages(conversationMessages.map(rowToMessage)),
      }
    })
  }

  const store = await readFileStore()
  return store.conversations
    .filter((conversation) => conversation.ownerKey === ownerKey && !conversation.archived)
    .sort(sortConversations)
    .map(fileToSummary)
}

export async function getChatConversation(
  ownerKey: string,
  conversationId: string
): Promise<ChatConversation | null> {
  if (isDatabaseEnabled()) {
    return loadPrismaConversation(prisma, ownerKey, conversationId)
  }
  const store = await readFileStore()
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
  const title =
    params.title?.trim() ||
    (params.initialMessage
      ? generateConversationTitle(params.initialMessage.content)
      : "New clinical question")

  if (isDatabaseEnabled()) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.chatConversationRecord.create({
        data: {
          id: crypto.randomUUID(),
          ownerKey: params.ownerKey,
          title,
          pinned: false,
          archived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
      let messages: MessageRow[] = []
      if (params.initialMessage) {
        const message = await tx.chatMessageRecord.create({
          data: {
            id: params.initialMessage.id || crypto.randomUUID(),
            conversationId: created.id,
            role: params.initialMessage.role,
            content: cleanMessageContent(params.initialMessage.content),
            agentId: params.initialMessage.agentId,
            collaborators: params.initialMessage.collaborators?.filter(Boolean) ?? [],
            routingInfo: params.initialMessage.routingInfo,
            createdAt: new Date(params.initialMessage.createdAt || Date.now()),
          },
        })
        messages = [message]
      }
      await enforcePrismaOwnerLimit(tx, params.ownerKey)
      return rowToConversation(created, messages)
    })
  }

  return mutateFileStore((store) => {
    const createdAt = nowIso()
    const conversation: ChatConversation = {
      id: crypto.randomUUID(),
      ownerKey: params.ownerKey,
      title,
      pinned: false,
      archived: false,
      createdAt,
      updatedAt: createdAt,
      messages: params.initialMessage ? [params.initialMessage] : [],
    }
    store.conversations.push(conversation)
    enforceFileOwnerLimit(store, params.ownerKey)
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
  const userContent = cleanMessageContent(params.userContent)
  const agentContent = cleanMessageContent(params.agentContent)
  const collaborators = params.collaborators?.filter(Boolean) ?? []

  if (isDatabaseEnabled()) {
    return prisma.$transaction(async (tx) => {
      let conversation = params.conversationId
        ? await tx.chatConversationRecord.findFirst({
            where: { id: params.conversationId, ownerKey: params.ownerKey, archived: false },
          })
        : null

      const now = new Date()
      if (!conversation) {
        conversation = await tx.chatConversationRecord.create({
          data: {
            id: crypto.randomUUID(),
            ownerKey: params.ownerKey,
            title: generateConversationTitle(params.userContent),
            pinned: false,
            archived: false,
            createdAt: now,
            updatedAt: now,
          },
        })
      }

      await tx.chatMessageRecord.createMany({
        data: [
          {
            id: crypto.randomUUID(),
            conversationId: conversation.id,
            role: "user",
            content: userContent,
            createdAt: now,
            collaborators: [],
          },
          {
            id: crypto.randomUUID(),
            conversationId: conversation.id,
            role: "agent",
            content: agentContent,
            agentId: params.agentId,
            collaborators,
            routingInfo: params.routingInfo,
            createdAt: new Date(now.getTime() + 1),
          },
        ],
      })

      const titleStillDefault = !conversation.title || conversation.title === "New clinical question"
      conversation = await tx.chatConversationRecord.update({
        where: { id: conversation.id },
        data: {
          updatedAt: new Date(),
          ...(titleStillDefault ? { title: generateConversationTitle(params.userContent) } : {}),
        },
      })

      await trimConversationMessages(tx, conversation.id)
      await enforcePrismaOwnerLimit(tx, params.ownerKey)

      const messages = await tx.chatMessageRecord.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "asc" },
      })
      return rowToConversation(conversation, messages)
    })
  }

  return mutateFileStore((store) => {
    const timestamp = nowIso()
    let conversation = params.conversationId
      ? store.conversations.find(
          (item) =>
            item.ownerKey === params.ownerKey &&
            item.id === params.conversationId &&
            !item.archived
        )
      : undefined

    const userMessage: ChatHistoryMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userContent,
      createdAt: timestamp,
    }
    const agentMessage: ChatHistoryMessage = {
      id: crypto.randomUUID(),
      role: "agent",
      content: agentContent,
      agentId: params.agentId,
      collaborators,
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

    enforceFileOwnerLimit(store, params.ownerKey)
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
  if (isDatabaseEnabled()) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.chatConversationRecord.findFirst({
        where: { id: params.conversationId, ownerKey: params.ownerKey },
      })
      if (!current) return null

      const data: Prisma.ChatConversationRecordUpdateInput = { updatedAt: new Date() }
      if (typeof params.title === "string") {
        data.title = generateConversationTitle(params.title)
      }
      if (typeof params.pinned === "boolean") {
        if (params.pinned && !current.pinned) {
          const currentPinned = await tx.chatConversationRecord.count({
            where: { ownerKey: params.ownerKey, pinned: true },
          })
          if (currentPinned >= MAX_PINNED_CONVERSATIONS_PER_OWNER) {
            throw new Error(
              `Pin limit reached (${MAX_PINNED_CONVERSATIONS_PER_OWNER}). Unpin a chat first.`
            )
          }
        }
        data.pinned = params.pinned
      }
      if (typeof params.archived === "boolean") data.archived = params.archived

      await tx.chatConversationRecord.update({
        where: { id: current.id },
        data,
      })
      return loadPrismaConversation(tx, params.ownerKey, current.id, { allowArchived: true })
    })
  }

  return mutateFileStore((store) => {
    const conversation = store.conversations.find(
      (item) => item.ownerKey === params.ownerKey && item.id === params.conversationId
    )
    if (!conversation) return null

    if (typeof params.title === "string") {
      conversation.title = generateConversationTitle(params.title)
    }
    if (typeof params.pinned === "boolean") {
      if (params.pinned && !conversation.pinned) {
        const currentPinned = store.conversations.filter(
          (c) => c.ownerKey === params.ownerKey && c.pinned
        ).length
        if (currentPinned >= MAX_PINNED_CONVERSATIONS_PER_OWNER) {
          throw new Error(
            `Pin limit reached (${MAX_PINNED_CONVERSATIONS_PER_OWNER}). Unpin a chat first.`
          )
        }
      }
      conversation.pinned = params.pinned
    }
    if (typeof params.archived === "boolean") conversation.archived = params.archived
    conversation.updatedAt = nowIso()
    return conversation
  })
}

export async function deleteChatConversation(
  ownerKey: string,
  conversationId: string
): Promise<boolean> {
  if (isDatabaseEnabled()) {
    const result = await prisma.chatConversationRecord.deleteMany({
      where: { id: conversationId, ownerKey },
    })
    return result.count > 0
  }
  return mutateFileStore((store) => {
    const before = store.conversations.length
    store.conversations = store.conversations.filter(
      (conversation) => !(conversation.ownerKey === ownerKey && conversation.id === conversationId)
    )
    return store.conversations.length !== before
  })
}
