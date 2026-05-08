"use client"

import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"
import { cn } from "@/lib/utils"
import { executeWorkflow } from "@/lib/openclaw/orchestrator"
import { useWalletIdentity } from "@/lib/wallet-context"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowUp,
  Bot,
  Calendar,
  Check,
  Copy,
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
  type ActionPlanItem,
} from "@/lib/care-handoff"
import { ChatActionPlan } from "@/components/chat-action-plan"

type AgentId = typeof OPENCLAW_CONFIG.agents[number]["id"]

const QUICK_PROMPTS: Array<{ label: string; prompt: string; agentId: AgentId }> = [
  {
    label: "Cancer screening · 50F",
    prompt: "What cancer screening does a 50-year-old woman need?",
    agentId: "screening",
  },
  {
    label: "Colon cancer family history",
    prompt: "I am 46 with a father who had colon cancer at 52 — what screening do I need?",
    agentId: "screening",
  },
  {
    label: "Lung screening · smoker",
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

const SERVICE_LINKS: Array<{ label: string; description: string; prompt: string; agentId: AgentId; icon: typeof Stethoscope }> = [
  {
    label: "Find physicians",
    description: "Primary care, GI, imaging, labs",
    prompt: "Help me find the right physician or service. Ask me for my ZIP code/location and what kind of care I need, one question at a time.",
    agentId: "scheduling",
    icon: Stethoscope,
  },
  {
    label: "Schedule follow-up",
    description: "Turn an answer into a visit",
    prompt: "Help me prepare a follow-up visit request. Ask me the minimum details needed, one question at a time.",
    agentId: "scheduling",
    icon: Calendar,
  },
  {
    label: "Coverage help",
    description: "Bills, estimates, prior auth",
    prompt: "Help me understand coverage, cost, or prior authorization. Ask me what service, plan, and bill/denial detail you need.",
    agentId: "billing",
    icon: Receipt,
  },
  {
    label: "Clinical trials",
    description: "Cancer studies by condition",
    prompt: "Help me understand whether a clinical trial search makes sense. Ask me diagnosis, stage, biomarkers, and location one question at a time.",
    agentId: "trials",
    icon: FlaskConical,
  },
]

interface ChatMessage {
  id: string
  role: "user" | "agent" | "system"
  content: string
  agentId?: string
  collaborators?: string[]
  routingInfo?: string
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
  due: "text-red-100 bg-red-950/30 border-red-500/20",
  review: "text-amber-100 bg-amber-950/30 border-amber-400/20",
  upcoming: "text-sky-100 bg-sky-950/24 border-sky-400/20",
  current: "text-emerald-100 bg-emerald-950/24 border-emerald-400/20",
  followup: "text-zinc-200 bg-white/[0.04] border-white/10",
  next: "text-zinc-100 bg-white/[0.05] border-white/12",
  answer: "text-white bg-white/[0.06] border-white/12",
  refs: "text-zinc-300 bg-white/[0.04] border-white/10",
  safety: "text-amber-100 bg-amber-950/30 border-amber-400/20",
  info: "text-zinc-300 bg-white/[0.04] border-white/10",
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
        className="font-medium text-cyan-200 underline decoration-cyan-200/40 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-100"
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
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-current">
          {Icon ? <Icon size={12} /> : null}
          {section.heading}
        </p>
      ) : null}
      <div className="space-y-1.5 text-[14px] leading-6 text-zinc-100">
        {blocks.map((block, i) => {
          if (block.kind === "blank") return <div key={`b-${i}`} className="h-1" />
          if (block.kind === "bullet") {
            return (
              <p
                key={`b-${i}`}
                className="pl-4 before:-ml-4 before:mr-2 before:text-cyan-300 before:content-['•']"
              >
                {renderInlineLinks(block.text, `b-${i}`)}
              </p>
            )
          }
          return (
            <p key={`b-${i}`} className="text-zinc-100">
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
    <div data-testid="chat-citations" className="mt-3 flex flex-wrap gap-2 border-t border-white/12 pt-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300">Sources</span>
      {citations.map((c, i) => (
        <a
          key={`${c.url}-${i}`}
          href={c.url}
          target="_blank"
          rel="noreferrer"
          data-testid="chat-citation"
          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-2.5 py-1 text-[11px] font-medium text-cyan-100 transition hover:border-cyan-200/45 hover:bg-cyan-200/[0.14]"
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard may be unavailable in some browsers/contexts.
    }
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      data-testid="chat-copy-button"
      aria-label={copied ? "Copied" : "Copy answer"}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

function StreamingCursor() {
  return (
    <span className="ml-0.5 inline-block h-[14px] w-[2px] translate-y-[2px] animate-pulse bg-cyan-300/80 align-middle" aria-hidden />
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
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [activeAgent, setActiveAgent] = useState<AgentId>("coordinator")
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
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

  // Auto-grow textarea (Claude-style — grows with content, capped at max).
  useEffect(() => {
    const node = inputRef.current
    if (!node) return
    node.style.height = "auto"
    const next = Math.min(node.scrollHeight, 220)
    node.style.height = `${next}px`
  }, [input])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsLoading(false)
    setStreamingId(null)
  }, [])

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
      const agentMsgId = `agent-${Date.now()}`

      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setIsLoading(true)
      setStreamingId(agentMsgId)
      setErrorBanner(null)

      const workflow = executeWorkflow(userMsg.content)
      const selectedAgent = agentOverride || workflow.route.primaryAgent || currentAgent
      if (selectedAgent !== currentAgent) setActiveAgent(selectedAgent)

      // Insert an empty agent message that will be filled in via streaming.
      const placeholder: ChatMessage = {
        id: agentMsgId,
        role: "agent",
        content: "",
        agentId: selectedAgent,
        collaborators: workflow.route.collaborators,
        routingInfo: workflow.route.reasoning,
        actionPlan: buildActionPlan(userMsg.content, selectedAgent),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, placeholder])

      const controller = new AbortController()
      abortRef.current = controller

      // Refocus the input so the user can keep typing while the model streams.
      window.setTimeout(() => inputRef.current?.focus(), 0)

      try {
        const res = await fetch("/api/openclaw/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...(walletAddress ? await getWalletAuthHeaders() : {}),
          },
          body: JSON.stringify({
            message: userMsg.content,
            agentId: selectedAgent,
            walletAddress,
            conversationId: conversationId || undefined,
            collaborators: workflow.route.collaborators,
            routingInfo: workflow.route.reasoning,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          // Streaming endpoint failed — fall back to the legacy non-streaming endpoint.
          const fallbackRes = await fetch("/api/openclaw/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(walletAddress ? await getWalletAuthHeaders() : {}),
            },
            body: JSON.stringify({
              message: userMsg.content,
              agentId: selectedAgent,
              walletAddress,
              conversationId: conversationId || undefined,
              collaborators: workflow.route.collaborators,
              routingInfo: workflow.route.reasoning,
            }),
            signal: controller.signal,
          })
          const data = await fallbackRes.json()
          const text = data.response || data.error || "I couldn't compose a response — try rephrasing."
          setMessages((prev) => prev.map((m) => (m.id === agentMsgId ? { ...m, content: text } : m)))
          if (data.conversationId && data.conversationId !== conversationId) {
            setConversationId(data.conversationId)
          }
          window.dispatchEvent(new CustomEvent("openrx:chat-history-refresh"))
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder("utf-8")
        let buffer = ""
        let accumulated = ""

        const handleEvent = (event: string, data: string) => {
          if (event === "delta") {
            try {
              const parsed = JSON.parse(data) as { text?: string }
              if (parsed.text) {
                accumulated += parsed.text
                setMessages((prev) =>
                  prev.map((m) => (m.id === agentMsgId ? { ...m, content: accumulated } : m))
                )
              }
            } catch {
              // Ignore malformed delta events
            }
          } else if (event === "done") {
            try {
              const parsed = JSON.parse(data) as {
                conversationId?: string
                conversationTitle?: string
                finalText?: string
              }
              if (parsed.finalText) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === agentMsgId ? { ...m, content: parsed.finalText! } : m))
                )
              }
              if (parsed.conversationId && parsed.conversationId !== conversationId) {
                setConversationId(parsed.conversationId)
              }
              window.dispatchEvent(new CustomEvent("openrx:chat-history-refresh"))
            } catch {
              // Ignore malformed done event
            }
          } else if (event === "error") {
            try {
              const parsed = JSON.parse(data) as { message?: string }
              if (accumulated.length === 0) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId
                      ? { ...m, content: parsed.message || "Stream interrupted. Please try again." }
                      : m
                  )
                )
              }
            } catch {
              // Ignore malformed error event
            }
          }
        }

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let boundary = buffer.indexOf("\n\n")
          while (boundary !== -1) {
            const block = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            const lines = block.split("\n")
            let event = "message"
            const dataLines: string[] = []
            for (const line of lines) {
              if (line.startsWith("event: ")) event = line.slice(7).trim()
              else if (line.startsWith("data: ")) dataLines.push(line.slice(6))
            }
            if (dataLines.length) handleEvent(event, dataLines.join("\n"))
            boundary = buffer.indexOf("\n\n")
          }
        }

        if (accumulated.length === 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentMsgId
                ? { ...m, content: "I couldn't compose a response — try rephrasing." }
                : m
            )
          )
        }
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError"
        if (aborted) {
          // User stopped — keep whatever streamed so far. If nothing arrived, drop the placeholder.
          setMessages((prev) => {
            const placeholderIndex = prev.findIndex((m) => m.id === agentMsgId)
            if (placeholderIndex === -1) return prev
            const placeholder = prev[placeholderIndex]
            if (!placeholder.content.trim()) return prev.filter((m) => m.id !== agentMsgId)
            return prev.map((m) =>
              m.id === agentMsgId ? { ...m, content: `${m.content}\n\n_Stopped._` } : m
            )
          })
        } else {
          setInput(savedInput)
          setErrorBanner("Connection error. Your message was restored — try sending again.")
          setMessages((prev) => prev.filter((m) => m.id !== agentMsgId))
        }
      } finally {
        abortRef.current = null
        setIsLoading(false)
        setStreamingId(null)
      }
    },
    [input, isLoading, isLoadingConversation, activeAgent, walletAddress, getWalletAuthHeaders, conversationId]
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

  const showEmptyState =
    messages.length <= 1 &&
    messages.every((message) => message.id === "welcome") &&
    !isLoading &&
    !isLoadingConversation
  const visibleMessages = showEmptyState ? [] : messages.filter((message) => message.id !== "welcome")

  const renderComposer = (placement: "hero" | "thread") => (
    <form
      className={cn(
        "rounded-[18px] border border-white/16 bg-[#101010] shadow-[0_22px_80px_rgba(0,0,0,0.44)] transition focus-within:border-cyan-200/55 focus-within:shadow-[0_0_0_3px_rgba(165,243,252,0.14),0_22px_80px_rgba(0,0,0,0.48)]",
        placement === "hero"
          ? "mx-auto w-full max-w-3xl p-3"
          : "sticky bottom-2 mb-2 p-2"
      )}
      onSubmit={(event) => {
        event.preventDefault()
        void sendMessage()
      }}
      data-testid={placement === "hero" ? "chat-empty-composer" : "chat-composer"}
    >
      <label htmlFor="chat-input" className="sr-only">
        Message OpenRx
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
          } else if (event.key === "Escape" && isLoading) {
            event.preventDefault()
            stopGeneration()
          }
        }}
        placeholder="Ask what is due, what it means, or where to go next..."
        disabled={isLoadingConversation}
        rows={1}
        className={cn(
          "block w-full resize-none overflow-hidden border-0 bg-transparent px-2 py-2 text-zinc-50 outline-none placeholder:text-zinc-400",
          placement === "hero" ? "min-h-[64px] text-[16px] leading-7" : "min-h-[44px] text-[15px] leading-6"
        )}
      />
      <div className="flex items-center justify-between gap-2 px-1 pb-0.5 pt-1">
        <p className={cn("text-left text-[11px] text-zinc-400", placement === "hero" && "hidden sm:block")}>
          {isLoading
            ? "Press Esc to stop. Streaming the answer…"
            : "Direct answers, sources, and explicit links. Not a substitute for clinician judgment."}
        </p>
        {isLoading ? (
          <button
            type="button"
            onClick={stopGeneration}
            data-testid="chat-stop-button"
            aria-label="Stop generating"
            className={cn(
              "inline-flex items-center justify-center rounded-[12px] border border-white/20 bg-white/[0.06] text-zinc-100 transition hover:border-white/40 hover:bg-white/[0.12]",
              placement === "hero" ? "h-11 w-11" : "h-9 w-9"
            )}
          >
            <span className={cn("rounded-[2px] bg-zinc-100", placement === "hero" ? "h-3 w-3" : "h-2.5 w-2.5")} />
          </button>
        ) : (
          <button
            type="submit"
            data-testid="chat-send-button"
            disabled={isLoadingConversation || !input.trim()}
            aria-label="Send"
            className={cn(
              "inline-flex items-center justify-center rounded-[12px] bg-white text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40",
              placement === "hero" ? "h-11 w-11" : "h-9 w-9"
            )}
          >
            <ArrowUp size={placement === "hero" ? 16 : 14} />
          </button>
        )}
      </div>
    </form>
  )

  return (
    <div
      data-openrx-chat-workspace
      className={cn(
        "mx-auto flex min-h-screen animate-fade-in flex-col bg-[#050505] px-4 text-zinc-100 sm:px-6",
        showEmptyState ? "max-w-5xl justify-center" : "max-w-3xl"
      )}
    >
      {showEmptyState ? (
        <main
          data-testid="chat-empty-state"
          className="flex min-h-screen flex-1 flex-col items-center justify-center px-3 py-12 text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-zinc-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {isConnected ? "Personalized workspace" : "General clinical search"}
          </div>
          <h1 className="max-w-3xl text-[clamp(2.7rem,8vw,6.25rem)] font-semibold leading-[0.92] tracking-[-0.07em] text-white">
            Ask OpenRx.
          </h1>
          <p className="mt-5 max-w-2xl text-balance text-[16px] leading-7 text-zinc-200 sm:text-[18px]">
            Clinical answers, guideline links, and care-service actions in one black-box-simple chat.
            Nothing moves you to another page unless you choose a link.
          </p>

          <div className="mt-9 w-full">{renderComposer("hero")}</div>

          {errorBanner ? (
            <div
              role="alert"
              data-testid="chat-error"
              className="mt-3 flex max-w-3xl items-center gap-2 rounded-[10px] border border-red-400/25 bg-red-950/30 px-3 py-2 text-left text-[13px] text-red-100"
            >
              <AlertTriangle size={14} />
              {errorBanner}
            </div>
          ) : null}

          <div data-testid="chat-quick-prompts" className="mt-5 flex w-full max-w-3xl flex-wrap justify-center gap-2">
            {QUICK_PROMPTS.slice(0, 4).map((qp) => (
              <button
                key={qp.label}
                type="button"
                onClick={() => {
                  void sendMessage(qp.prompt, qp.agentId)
                }}
                className="group rounded-full border border-white/14 bg-white/[0.055] px-4 py-2.5 text-left text-[13px] font-medium text-zinc-100 transition hover:-translate-y-0.5 hover:border-cyan-200/35 hover:bg-white/[0.09] hover:text-white"
              >
                {qp.label}
              </button>
            ))}
          </div>

          <nav
            aria-label="Care service links"
            className="mt-8 grid w-full max-w-3xl gap-2 sm:grid-cols-2 lg:grid-cols-4"
          >
            {SERVICE_LINKS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    void sendMessage(item.prompt, item.agentId)
                  }}
                  className="group rounded-[16px] border border-white/12 bg-white/[0.045] p-3 text-left transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08]"
                >
                  <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-white/[0.07] text-cyan-200">
                    <Icon size={15} />
                  </span>
                  <span className="block text-[13px] font-semibold text-white">{item.label}</span>
                  <span className="mt-1 block text-[12px] leading-5 text-zinc-400 group-hover:text-zinc-200">
                    {item.description}
                  </span>
                </button>
              )
            })}
          </nav>

          <p className="mt-6 max-w-2xl text-[12px] leading-5 text-zinc-400">
            For emergencies or severe symptoms, seek urgent medical care. OpenRx supports decisions; it does not replace your clinician.
          </p>
        </main>
      ) : (
        <>
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Ask OpenRx</p>
          <h1 className="text-[18px] font-semibold tracking-tight text-white">
            Clinical answers and care links
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            data-testid="chat-status-indicator"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            online
          </span>
          <span
            data-testid="chat-personalization-badge"
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
              isConnected
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                : "border-white/12 bg-white/[0.05] text-zinc-300"
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "bg-emerald-400" : "bg-zinc-600")}
            />
            {isConnected ? "Personalized" : "General"}
          </span>
          <button
            type="button"
            onClick={clearChat}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="mx-auto max-w-sm rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm text-zinc-400" data-testid="chat-loading-conversation">
            <Loader2 size={15} className="mx-auto mb-2 animate-spin text-cyan-300" />
            Restoring the clinical thread...
          </div>
        ) : null}

        {visibleMessages.map((msg) => {
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
                  className="max-w-[85%] whitespace-pre-wrap rounded-[16px] bg-white px-4 py-3 text-[15px] leading-7 text-black"
                >
                  {msg.content}
                </div>
              </div>
            )
          }
          const meta = msg.agentId ? agentMeta[msg.agentId] : null
          const Icon = meta?.icon || Sparkles
          const isStreamingThis = streamingId === msg.id
          const showEmptyStreamingIndicator = isStreamingThis && !msg.content.trim()
          return (
            <article key={msg.id} data-testid="chat-message-agent" className="animate-fade-in space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-cyan-300">
                  <Icon size={12} />
                </span>
                {meta?.label || "OpenRx"}
                {isStreamingThis ? (
                  <span className="ml-1 text-[10px] font-medium normal-case tracking-normal text-zinc-500">
                    streaming…
                  </span>
                ) : null}
              </div>
              {showEmptyStreamingIndicator ? (
                <div className="flex items-center gap-1 text-[14px] text-zinc-400" data-testid="chat-loading">
                  Thinking
                  <span className="ml-1 inline-flex items-center gap-1">
                    <span className="typing-dot h-1 w-1 rounded-full bg-zinc-500" style={{ animationDelay: "0ms" }} />
                    <span className="typing-dot h-1 w-1 rounded-full bg-zinc-500" style={{ animationDelay: "120ms" }} />
                    <span className="typing-dot h-1 w-1 rounded-full bg-zinc-500" style={{ animationDelay: "240ms" }} />
                  </span>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <ChatAnswer content={msg.content} />
                    {isStreamingThis ? <StreamingCursor /> : null}
                  </div>
                  {msg.actionPlan && msg.actionPlan.length > 0 && !isStreamingThis ? (
                    <ChatActionPlan
                      items={msg.actionPlan}
                      onPrompt={(prompt) => {
                        void sendMessage(prompt)
                      }}
                    />
                  ) : null}
                  <div className="flex items-center gap-2">
                    {!isStreamingThis && msg.content.trim() ? <CopyButton text={msg.content} /> : null}
                  </div>
                </>
              )}
            </article>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {errorBanner ? (
        <div
          role="alert"
          data-testid="chat-error"
          className="mb-3 flex items-center gap-2 rounded-[10px] border border-red-400/25 bg-red-950/30 px-3 py-2 text-[13px] text-red-100"
        >
          <AlertTriangle size={14} />
          {errorBanner}
        </div>
      ) : null}

      {/* Composer */}
      {renderComposer("thread")}
        </>
      )}
    </div>
  )
}
