export type ChatMessageRole = "user" | "agent" | "system"

export interface ChatTranscriptMessage {
  id: string
  role: ChatMessageRole
  content: string
  agentId?: string
  createdAt: string
}

export interface ChatConversationSummary {
  id: string
  title: string
  pinned: boolean
  createdAt: string
  updatedAt: string
  messageCount: number
  preview: string
}

export interface ChatConversationDetail extends ChatConversationSummary {
  messages: ChatTranscriptMessage[]
}

export interface ChatHistoryPatch {
  title?: string
  pinned?: boolean
}

export interface ChatHistoryAppendInput {
  conversationId?: string
  message: ChatTranscriptMessage
  /** When the conversation is brand new, the first user message becomes the title. */
  derivedTitle?: string
}
