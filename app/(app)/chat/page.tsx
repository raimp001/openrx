"use client"

import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"
import { cn } from "@/lib/utils"
import { executeWorkflow } from "@/lib/openclaw/orchestrator"
import { useWalletIdentity } from "@/lib/wallet-context"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowRight,
  ArrowUp,
  Bot,
  Calendar,
  Receipt,
  ShieldCheck,
  Pill,
  Stethoscope,
  Heart,
  FlaskConical,
  Loader2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Sparkles,
  ShieldAlert,
  Clock3,
} from "lucide-react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  buildActionPlan,
  fallbackHrefForCareHandoff,
  resolveCareHandoff,
  safeSessionSetItem,
  type ActionPlanItem,
  type CareHandoffAction,
} from "@/lib/care-handoff"
import { ChatActionPlan } from "@/components/chat-action-plan"

type AgentId = typeof OPENCLAW_CONFIG.agents[number]["id"]

const QUICK_PROMPTS: Array<{ label: string; prompt: string; agentId: AgentId }> = [
  {
    label: "Cancer screening for a 50-year-old woman",
    prompt: "What cancer screening does a 50-year-old woman need?",
    agentId: "screening",
  },
  {
    label: "Colon screening with family history",
    prompt: "I am 46 with a father who had colon cancer at 52 — what screening do I need?",
    agentId: "screening",
  },
  {
    label: "Lung screening for a long-term smoker",
    prompt: "I am 63, smoked 1 pack/day for 30 years, quit 6 years ago. Do I need lung screening?",
    agentId: "screening",
  },
  {
    label: "Drug interaction check",
    prompt: "Can I take ibuprofen with lisinopril?",
    agentId: "rx",
  },
  {
    label: "Chest pain — what should I do?",
    prompt: "I have chest pain and shortness of breath. What should I do?",
    agentId: "triage",
  },
  {
    label: "Preventive care for a 55-year-old man",
    prompt: "What vaccines and preventive care should a 55-year-old man ask about?",
    agentId: "wellness",
  },
]

interface ChatMessage {
  id: string
  role: "user" | "agent" | "system"
  content: string
  agentId?: string
  collaborators?: string[]
  routingInfo?: string
  action?: CareHandoffAction
  actionPlan?: ActionPlanItem[]
  timestamp: Date
}

type StoredChatMessage = {
  id: string
  role: "user" | "agent" | "system"
  content: string
  agentId?: string
  collaborators?: string[]
  routingInfo?: string
  createdAt: string
}

type StoredConversationResponse = {
  conversation?: {
    id: string
    title: string
    messages: StoredChatMessage[]
  }
  error?: string
}

const agentMeta: Record<string, { label: string; icon: typeof Bot }> = {
  onboarding: { label: "Care setup", icon: Bot },
  coordinator: { label: "OpenRx", icon: Sparkles },
  triage: { label: "Symptom triage", icon: Stethoscope },
  scheduling: { label: "Appointments", icon: Calendar },
  billing: { label: "Coverage & bills", icon: Receipt },
  rx: { label: "Medications", icon: Pill },
  "prior-auth": { label: "Prior authorization", icon: ShieldCheck },
  wellness: { label: "Prevention", icon: Heart },
  screening: { label: "Screening", icon: Heart },
  "second-opinion": { label: "Second opinion", icon: ShieldCheck },
  trials: { label: "Clinical trials", icon: FlaskConical },
  devops: { label: "Status", icon: Bot },
}

const SECTION_LABELS: Record<string, { variant: "due" | "review" | "upcoming" | "current" | "info" | "safety" | "followup" | "next" | "answer" | "refs"; icon?: typeof CheckCircle2 }> = {
  "Direct answer": { variant: "answer" },
  "Due now": { variant: "due", icon: AlertTriangle },
  "Needs clinician review": { variant: "review", icon: ShieldAlert },
  "Upcoming or depends": { variant: "upcoming", icon: Clock3 },
  "Current / not indicated": { variant: "current", icon: CheckCircle2 },
  "Question to refine this": { variant: "followup" },
  "What to do now": { variant: "next" },
  References: { variant: "refs" },
  "Safety note": { variant: "safety", icon: ShieldAlert },
}

const sectionTone: Record<string, string> = {
  due: "text-danger bg-red-50 border-red-100",
  review: "text-warning bg-amber-50 border-amber-100",
  upcoming: "text-navy bg-slate-50 border-slate-200",
  current: "text-success bg-emerald-50 border-emerald-100",
  followup: "text-muted bg-surface-2 border-border",
  next: "text-navy bg-white border-border-strong",
  answer: "text-primary bg-white border-border-strong",
  refs: "text-muted bg-white border-border",
  safety: "text-muted bg-amber-50 border-amber-100",
  info: "text-muted bg-white border-border",
}

interface ParsedSection {
  heading: string | null
  variant: keyof typeof sectionTone
  icon?: typeof CheckCircle2
  lines: string[]
}

interface ParsedAnswer {
  sections: ParsedSection[]
  citations: Array<{ label: string; url: string }>
}

function parseAnswer(content: string): ParsedAnswer {
  const lines = content.split("\n")
  const sections: ParsedSection[] = []
  let current: ParsedSection = { heading: null, variant: "info", lines: [] }

  const flush = () => {
    if (current.lines.length || current.heading) sections.push(current)
  }

  for (const raw of lines) {
    const trimmed = raw.trim()
    const known = SECTION_LABELS[trimmed]
    if (known) {
      flush()
      current = { heading: trimmed, variant: known.variant, icon: known.icon, lines: [] }
      continue
    }
    // Recognise an inline "Direct answer: ..." opener as its own section so the
    // top of the answer stands out visually and is testable.
    const directAnswerMatch = trimmed.match(/^Direct answer:\s*(.*)$/i)
    if (directAnswerMatch && current.heading === null && current.lines.length === 0) {
      current = { heading: "Direct answer", variant: "answer", lines: [directAnswerMatch[1] || ""] }
      flush()
      current = { heading: null, variant: "info", lines: [] }
      continue
    }
    if (trimmed === "") {
      current.lines.push("")
      continue
    }
    current.lines.push(trimmed)
  }
  flush()

  // Pull all hyperlinks for the citation rail
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
  const citations: Array<{ label: string; url: string }> = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = linkPattern.exec(content)) !== null) {
    if (!seen.has(match[2])) {
      seen.add(match[2])
      citations.push({ label: match[1], url: match[2] })
    }
  }

  return { sections, citations }
}

function renderInlineLinks(text: string, keyPrefix: string) {
  const parts: Array<string | { label: string; url: string }> = []
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push({ label: match[1] || match[3], url: match[2] || match[3] })
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.map((part, index) => {
    if (typeof part === "string") return <span key={`${keyPrefix}-${index}`}>{part}</span>
    return (
      <a
        key={`${keyPrefix}-${index}`}
        href={part.url}
        target="_blank"
        rel="noreferrer"
        className="text-teal-dark underline decoration-teal/40 underline-offset-2 transition hover:decoration-teal-dark"
      >
        {part.label}
      </a>
    )
  })
}

function SectionBlock({ section, idx }: { section: ParsedSection; idx: number }) {
  const tone = sectionTone[section.variant] || sectionTone.info
  const Icon = section.icon

  if (section.variant === "refs") {
    // References are rendered as a citation rail below. Skip inline render.
    return null
  }

  // Render bullets / paragraphs
  const blocks = section.lines
    .map((line) => line.trim())
    .reduce<Array<{ kind: "p" | "bullet" | "blank"; text: string }>>((acc, line) => {
      if (!line) {
        acc.push({ kind: "blank", text: "" })
        return acc
      }
      if (line.startsWith("- ")) {
        acc.push({ kind: "bullet", text: line.slice(2) })
        return acc
      }
      acc.push({ kind: "p", text: line })
      return acc
    }, [])

  // Trim trailing blanks
  while (blocks.length && blocks[blocks.length - 1].kind === "blank") blocks.pop()

  if (!section.heading && blocks.length === 0) return null

  return (
    <div
      data-testid={section.heading ? `chat-section-${section.heading.toLowerCase().replace(/[^a-z]+/g, "-")}` : undefined}
      className={cn(
        "rounded-[12px] border px-4 py-3",
        tone,
        idx === 0 && !section.heading && "border-transparent bg-transparent p-0"
      )}
    >
      {section.heading ? (
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
          {Icon ? <Icon size={12} /> : null}
          {section.heading}
        </p>
      ) : null}
      <div className="space-y-1.5 text-[14px] leading-6 text-secondary">
        {blocks.map((block, i) => {
          if (block.kind === "blank") return <div key={`b-${i}`} className="h-1" />
          if (block.kind === "bullet") {
            return (
              <p
                key={`b-${i}`}
                className="pl-4 before:-ml-4 before:mr-2 before:text-teal before:content-['•']"
              >
                {renderInlineLinks(block.text, `b-${i}`)}
              </p>
            )
          }
          return (
            <p key={`b-${i}`} className="text-secondary">
              {renderInlineLinks(block.text, `b-${i}`)}
            </p>
          )
        })}
      </div>
    </div>
  )
}

function CitationRail({ citations }: { citations: ParsedAnswer["citations"] }) {
  if (!citations.length) return null
  return (
    <div data-testid="chat-citations" className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Sources</span>
      {citations.map((c, i) => (
        <a
          key={`${c.url}-${i}`}
          href={c.url}
          target="_blank"
          rel="noreferrer"
          data-testid="chat-citation"
          className="chat-citation-pill"
        >
          {c.label}
          <ExternalLink size={10} />
        </a>
      ))}
    </div>
  )
}

function ChatAnswer({ content }: { content: string }) {
  const parsed = useMemo(() => parseAnswer(content), [content])
  return (
    <div className="space-y-3">
      {parsed.sections.map((section, i) => (
        <SectionBlock key={`s-${i}`} section={section} idx={i} />
      ))}
      <CitationRail citations={parsed.citations} />
    </div>
  )
}

export default function ChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isConnected, walletAddress, getWalletAuthHeaders } = useWalletIdentity()

  const buildWelcome = useCallback((connected: boolean): ChatMessage => ({
    id: "welcome",
    role: "agent",
    agentId: "coordinator",
    content:
      "How can I help you today? Ask a clinical question and I'll answer here in chat — with guideline links and a clear next step.\n\n" +
      (connected ? "Your account is connected, so replies can use your saved profile.\n\n" : "") +
      "Try: \"What cancer screening does a 50-year-old woman need?\"",
    timestamp: new Date(),
  }), [])

  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcome(isConnected)])
  const [conversationId, setConversationId] = useState("")
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [activeAgent, setActiveAgent] = useState<AgentId>("coordinator")
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const seededPromptRef = useRef(false)
  const autoSubmittedPromptRef = useRef(false)

  const clearChat = useCallback(() => {
    setConversationId("")
    setMessages([buildWelcome(isConnected)])
    setErrorBanner(null)
    router.push("/chat")
    window.dispatchEvent(new CustomEvent("openrx:new-chat"))
    inputRef.current?.focus()
  }, [buildWelcome, isConnected, router])

  const sendQuickPrompt = useCallback((prompt: string, agentId: AgentId) => {
    setInput(prompt)
    setActiveAgent(agentId)
    inputRef.current?.focus()
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    setIsLoadingConversation(true)
    try {
      const headers = walletAddress ? await getWalletAuthHeaders() : {}
      const response = await fetch(`/api/chat/conversations/${encodeURIComponent(id)}`, {
        headers,
        credentials: "include",
      })
      const body = (await response.json().catch(() => ({}))) as StoredConversationResponse
      if (!response.ok || !body.conversation) {
        setErrorBanner("That saved chat could not be opened. Start a new question or choose another chat.")
        setMessages([buildWelcome(isConnected)])
        return
      }

      let lastUserPrompt = ""
      setConversationId(body.conversation.id)
      setMessages(
        body.conversation.messages.map((message) => {
          if (message.role === "user") lastUserPrompt = message.content
          const agentId = message.agentId || "coordinator"
          return {
            id: message.id,
            role: message.role,
            content: message.content,
            agentId: message.agentId,
            collaborators: message.collaborators,
            routingInfo: message.routingInfo,
            actionPlan: message.role === "agent" ? buildActionPlan(lastUserPrompt, agentId) : undefined,
            timestamp: new Date(message.createdAt),
          }
        })
      )
    } finally {
      setIsLoadingConversation(false)
    }
  }, [buildWelcome, getWalletAuthHeaders, isConnected, walletAddress])

  useEffect(() => {
    const handler = () => {
      setConversationId("")
      setInput("")
      setErrorBanner(null)
      setMessages([buildWelcome(isConnected)])
      inputRef.current?.focus()
    }
    window.addEventListener("openrx:new-chat", handler)
    return () => window.removeEventListener("openrx:new-chat", handler)
  }, [buildWelcome, isConnected])

  useEffect(() => {
    const id = searchParams.get("c") || searchParams.get("conversationId") || ""
    if (!id) {
      setConversationId("")
      if (!searchParams.get("prompt")) {
        setMessages([buildWelcome(isConnected)])
      }
      return
    }
    if (id !== conversationId) {
      void loadConversation(id)
    }
  }, [buildWelcome, conversationId, isConnected, loadConversation, searchParams])

  const openCareHandoff = useCallback((action: CareHandoffAction) => {
    if (typeof window === "undefined") return
    const stored = safeSessionSetItem(action.storageKey, JSON.stringify(action.payload))
    window.location.href = stored ? action.href : fallbackHrefForCareHandoff(action)
  }, [])

  // Preload questions from URL
  useEffect(() => {
    if (seededPromptRef.current || typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const prompt = params.get("prompt")
    const topic = params.get("topic")
    if (topic && OPENCLAW_CONFIG.agents.some((agent) => agent.id === topic)) {
      setActiveAgent(topic as AgentId)
    }
    if (prompt) {
      setInput(prompt)
      window.setTimeout(() => inputRef.current?.focus(), 60)
    }
    seededPromptRef.current = true
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const sendMessage = useCallback(
    async (messageOverride?: string, agentOverride?: AgentId) => {
      const nextInput = (messageOverride ?? input).trim()
      if (!nextInput || isLoading || isLoadingConversation) return

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: nextInput,
        timestamp: new Date(),
      }

      const savedInput = nextInput
      const currentAgent = agentOverride || activeAgent
      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setIsLoading(true)
      setErrorBanner(null)

      const workflow = executeWorkflow(userMsg.content)
      if (workflow.route.primaryAgent !== currentAgent) {
        setActiveAgent(workflow.route.primaryAgent)
      }

      try {
        const res = await fetch("/api/openclaw/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(walletAddress ? await getWalletAuthHeaders() : {}),
          },
          body: JSON.stringify({
            message: userMsg.content,
            agentId: workflow.route.primaryAgent,
            walletAddress,
            conversationId: conversationId || undefined,
            collaborators: workflow.route.collaborators,
            routingInfo: workflow.route.reasoning,
          }),
        })
        const data = await res.json()
        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: data.response || data.error || "I couldn't compose a response — try rephrasing.",
          agentId: workflow.route.primaryAgent,
          collaborators: workflow.route.collaborators,
          routingInfo: workflow.route.reasoning,
          action: resolveCareHandoff(userMsg.content, workflow.route.primaryAgent) || undefined,
          actionPlan: buildActionPlan(userMsg.content, workflow.route.primaryAgent),
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, agentMsg])
        if (data.conversationId && data.conversationId !== conversationId) {
          setConversationId(data.conversationId)
          router.replace(`/chat?c=${encodeURIComponent(data.conversationId)}`, { scroll: false })
        }
        window.dispatchEvent(new CustomEvent("openrx:chat-history-refresh"))
      } catch {
        setInput(savedInput)
        setErrorBanner("Connection error. Your message was restored — try sending again.")
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, isLoadingConversation, activeAgent, walletAddress, getWalletAuthHeaders, conversationId, router]
  )

  useEffect(() => {
    if (autoSubmittedPromptRef.current || typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const prompt = params.get("prompt")
    if (params.get("autorun") !== "1" || !prompt?.trim()) return
    const topic = params.get("topic")
    const agentOverride =
      topic && OPENCLAW_CONFIG.agents.some((agent) => agent.id === topic) ? (topic as AgentId) : undefined
    autoSubmittedPromptRef.current = true
    window.setTimeout(() => {
      void sendMessage(prompt, agentOverride)
    }, 80)
  }, [sendMessage])

  const showEmptyHero = messages.length <= 1 && !isLoadingConversation

  const composer = (
    <form
      className={cn(
        "rounded-[16px] border border-border-strong bg-white p-2 shadow-card transition focus-within:border-teal/60 focus-within:shadow-focus",
        showEmptyHero ? "shadow-[0_24px_60px_rgba(8,24,46,0.08)]" : "sticky bottom-2 mb-2"
      )}
      onSubmit={(event) => {
        event.preventDefault()
        void sendMessage()
      }}
    >
      <label htmlFor="chat-input" className="sr-only">
        Ask OpenRx a clinical question
      </label>
      <textarea
        ref={inputRef}
        id="chat-input"
        data-testid="chat-input"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            void sendMessage()
          }
        }}
        placeholder={
          showEmptyHero
            ? "Ask a clinical question…"
            : "Ask a clinical question — e.g., what screening is due for a 55-year-old?"
        }
        disabled={isLoading || isLoadingConversation}
        rows={showEmptyHero ? 3 : 2}
        className={cn(
          "block w-full resize-none border-0 bg-transparent px-3 py-2 text-primary outline-none placeholder:text-subtle disabled:opacity-60",
          showEmptyHero ? "max-h-[220px] min-h-[88px] text-[16px] leading-7" : "max-h-[160px] min-h-[56px] text-[15px] leading-6"
        )}
        autoFocus={showEmptyHero}
      />
      <div className="flex items-center justify-between gap-2 px-1 pb-0.5 pt-1">
        <p className="text-[11px] text-muted">
          Decision support — not a substitute for clinician judgment.
        </p>
        <button
          type="submit"
          data-testid="chat-send-button"
          disabled={isLoading || isLoadingConversation || !input.trim()}
          aria-label="Send"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-navy text-white transition hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} />}
        </button>
      </div>
    </form>
  )

  if (showEmptyHero) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-3xl animate-fade-in flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            <Sparkles size={11} className="text-teal-dark" />
            Ask OpenRx
          </span>
          <h1 className="mt-2 text-balance text-[clamp(1.9rem,4vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-primary">
            How can I help you today?
          </h1>
          <p className="max-w-xl text-[14px] leading-6 text-muted">
            Ask a clinical question and I&apos;ll answer here in chat — sourced from USPSTF, CDC, ACS, and NCCN guidelines.
            {isConnected ? " Your account is connected, so replies can use your saved profile." : ""}
          </p>
        </div>

        <div className="w-full max-w-2xl">
          {composer}
        </div>

        {errorBanner ? (
          <div
            role="alert"
            data-testid="chat-error"
            className="mt-4 flex w-full max-w-2xl items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-danger"
          >
            <AlertTriangle size={14} />
            {errorBanner}
          </div>
        ) : null}

        <div data-testid="chat-quick-prompts" className="mt-6 flex w-full max-w-2xl flex-wrap justify-center gap-2">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.label}
              type="button"
              onClick={() => sendQuickPrompt(qp.prompt, qp.agentId)}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-secondary transition hover:border-border-strong hover:bg-surface-2 hover:text-primary"
            >
              {qp.label}
            </button>
          ))}
        </div>

        <p className="mt-8 text-[11px] text-muted">
          Decision support sourced from USPSTF · CDC · ACS · NCCN guidelines.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl animate-fade-in flex-col px-1">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border pb-3 pt-1">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Ask OpenRx</p>
          <h1 className="text-[18px] font-semibold tracking-tight text-primary">
            Clinical answers, in chat
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            data-testid="chat-status-indicator"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-success"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            online
          </span>
          <span
            data-testid="chat-personalization-badge"
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
              isConnected
                ? "border-emerald-200 bg-emerald-50 text-success"
                : "border-border bg-white text-muted"
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "bg-success" : "bg-subtle")}
            />
            {isConnected ? "Personalized" : "General"}
          </span>
          <button
            type="button"
            onClick={clearChat}
            className="control-button-secondary px-3 py-1.5 text-xs"
            disabled={isLoading || messages.length <= 1}
            data-testid="chat-clear"
            aria-label="Clear"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </header>

      {/* Messages */}
      <div
        className="flex-1 space-y-6 overflow-y-auto py-6"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Chat conversation"
      >
        {isLoadingConversation ? (
          <div className="mx-auto max-w-sm rounded-[14px] border border-border bg-white px-4 py-3 text-center text-sm text-muted" data-testid="chat-loading-conversation">
            <Loader2 size={15} className="mx-auto mb-2 animate-spin text-teal-dark" />
            Restoring the clinical thread...
          </div>
        ) : null}

        {messages.map((msg) => {
          if (msg.role === "system") {
            return (
              <div key={msg.id} data-testid="chat-message-system" className="chat-bubble-system mx-auto max-w-2xl">
                {msg.content}
              </div>
            )
          }
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div
                  data-testid="chat-message-user"
                  className="chat-bubble-user max-w-[85%] whitespace-pre-wrap"
                >
                  {msg.content}
                </div>
              </div>
            )
          }
          const meta = msg.agentId ? agentMeta[msg.agentId] : null
          const Icon = meta?.icon || Sparkles
          return (
            <article key={msg.id} data-testid="chat-message-agent" className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-white text-teal-dark">
                  <Icon size={12} />
                </span>
                {meta?.label || "OpenRx"}
              </div>
              <ChatAnswer content={msg.content} />
              {msg.actionPlan && msg.actionPlan.length > 0 ? (
                <ChatActionPlan items={msg.actionPlan} />
              ) : null}
              {msg.action ? (
                <button
                  type="button"
                  onClick={() => openCareHandoff(msg.action!)}
                  data-testid="chat-action-button"
                  className="control-button-accent px-3.5 py-2 text-xs"
                >
                  {msg.action.label}
                  <ArrowRight size={12} />
                </button>
              ) : null}
            </article>
          )
        })}

        {isLoading ? (
          <div className="flex items-center gap-3 text-muted" data-testid="chat-loading">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-white">
              <Sparkles size={12} className="text-teal-dark" />
            </span>
            <span className="flex items-center gap-1 text-[14px]">
              Composing answer
              <span className="ml-1 inline-flex items-center gap-1">
                <span className="typing-dot h-1 w-1 rounded-full bg-muted" style={{ animationDelay: "0ms" }} />
                <span className="typing-dot h-1 w-1 rounded-full bg-muted" style={{ animationDelay: "120ms" }} />
                <span className="typing-dot h-1 w-1 rounded-full bg-muted" style={{ animationDelay: "240ms" }} />
              </span>
            </span>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {errorBanner ? (
        <div
          role="alert"
          data-testid="chat-error"
          className="mb-3 flex items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-danger"
        >
          <AlertTriangle size={14} />
          {errorBanner}
        </div>
      ) : null}

      {composer}
    </div>
  )
}
