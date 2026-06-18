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
  ShieldCheck,
  Pill,
  Receipt,
  Stethoscope,
  FlaskConical,
  Heart,
  Loader2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Sparkles,
  ShieldAlert,
  Clock3,
  Phone,
} from "lucide-react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  buildActionPlan,
  type ActionPlanItem,
} from "@/lib/care-handoff"
import { ChatActionPlan } from "@/components/chat-action-plan"
import { CarePlanPreview } from "@/components/care-plan-preview"
import { RedFlagAlert } from "@/components/red-flag-alert"
import { SupportOpenRx } from "@/components/support-openrx"
import { TrustDrawer } from "@/components/trust-drawer"
import { carePlanFromScreeningRecommendations, createCarePlan, type CarePlan } from "@/lib/care-plan"
import { trackWorkflowEvent } from "@/lib/product-analytics"
import { detectRedFlagText, type RedFlagResult } from "@/lib/red-flag"
import { parseScreeningIntakeNarrative, summarizeScreeningIntake } from "@/lib/screening-intake"
import { recommendScreenings, screeningIntakeFromLegacy } from "@/lib/screening/recommend"
import { CLEAN_MODEL_BUSY_MESSAGE } from "@/lib/openclaw/model-boundary"
import { usePrefetchLinks } from "@/lib/hooks/use-prefetch-links"

type AgentId = typeof OPENCLAW_CONFIG.agents[number]["id"]

const SERVICE_LINKS: Array<{ label: string; description: string; prompt: string; agentId: AgentId; icon: typeof Stethoscope }> = [
  {
    label: "Check my screening",
    description: "Get sourced next steps",
    prompt: "What screening may be due for me?",
    agentId: "screening",
    icon: ShieldCheck,
  },
  {
    label: "Find care near me",
    description: "Get clinic phone numbers",
    prompt: "Find primary care near me.",
    agentId: "scheduling",
    icon: Stethoscope,
  },
  {
    label: "Draft a clinician message",
    description: "Prepare one clear request",
    prompt: "Help me draft a short message to my clinician.",
    agentId: "coordinator",
    icon: Calendar,
  },
]

const TRUST_MARKERS = [
  "Guideline-linked answers",
  "Sources shown inline",
  "Action links, not dead-end advice",
  "Clinician judgment stays central",
]

const CARE_PATH_PREVIEW: Array<{ label: string; description: string; icon: typeof ShieldCheck }> = [
  {
    label: "Answer",
    description: "Plain-language response with the clinical safety boundary visible.",
    icon: Bot,
  },
  {
    label: "Evidence",
    description: "Guideline source, grade, and citation links stay attached.",
    icon: ShieldCheck,
  },
  {
    label: "Action",
    description: "Open providers, labs, imaging, trials, pharmacy, or a call script.",
    icon: Stethoscope,
  },
]

const EXAMPLE_QUESTIONS = [
  "45 male. What cancer screening is due?",
  "Find a GI or colonoscopy center near 97123.",
  "Help me message my PCP about mammogram options.",
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

function isClarifyingScreeningMessage(message: ChatMessage) {
  return (
    message.agentId === "screening" &&
    message.content.includes("I need one missing detail before giving screening guidance safely")
  )
}

function isCleanModelBusyMessage(message: ChatMessage) {
  return message.content.trim() === CLEAN_MODEL_BUSY_MESSAGE
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

function isCompactScreeningFollowUp(message: string): boolean {
  return /^(?:\s*\d{1,3}\b)|\b(?:yes|no|none|never|hx|history|family|father|mother|dad|mom|parent|sibling|male|female|man|woman|smoker|smoking|pack[- ]?years?|quit|brca\d?|lynch|mutation|colonoscopy|mammogram|pap|hpv|psa|lymphoma|leukemia|cancer|symptom)\b/i.test(message)
}

const SECTION_LABELS: Record<string, { variant: "due" | "review" | "upcoming" | "current" | "info" | "safety" | "followup" | "next" | "answer" | "refs" | "care"; icon?: typeof CheckCircle2 }> = {
  "Answer": { variant: "answer" },
  "Due now": { variant: "due", icon: AlertTriangle },
  "Needs clinician review": { variant: "review", icon: ShieldAlert },
  "Upcoming or depends": { variant: "upcoming", icon: Clock3 },
  "Current / not indicated": { variant: "current", icon: CheckCircle2 },
  "Care options": { variant: "care", icon: Stethoscope },
  "Question to refine this": { variant: "followup" },
  "What to do now": { variant: "next" },
  "What to ask when calling": { variant: "next", icon: Phone },
  References: { variant: "refs" },
  "Safety note": { variant: "safety", icon: ShieldAlert },
}

const sectionTone: Record<string, string> = {
  due: "text-cyan-50 bg-cyan-950/30 border-cyan-300/20",
  review: "text-amber-100 bg-amber-950/30 border-amber-400/20",
  upcoming: "text-sky-100 bg-sky-950/24 border-sky-400/20",
  current: "text-emerald-100 bg-emerald-950/24 border-emerald-400/20",
  followup: "text-zinc-200 bg-white/[0.04] border-white/10",
  next: "text-zinc-100 bg-white/[0.05] border-white/12",
  answer: "text-white bg-white/[0.06] border-white/12",
  refs: "text-zinc-300 bg-white/[0.04] border-white/10",
  safety: "text-amber-100 bg-amber-950/30 border-amber-400/20",
  care: "text-cyan-50 bg-cyan-950/18 border-cyan-200/14",
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
    if (/^Direct answer$/i.test(trimmed)) {
      flush()
      current = { heading: "Answer", variant: "answer", lines: [] }
      continue
    }
    // Legacy saved chats may contain this opener. Normalize it to the patient-safe
    // "Answer" section so the phrase is never rendered back to the user.
    const directAnswerMatch = trimmed.match(/^Direct answer:\s*(.*)$/i)
    if (directAnswerMatch && current.heading === null && current.lines.length === 0) {
      current = { heading: "Answer", variant: "answer", lines: [directAnswerMatch[1] || ""] }
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

  // Pull all hyperlinks for the citation rail. Deterministic guideline outputs
  // often use "Source: ... · URL" lines instead of Markdown links.
  const labelForBareUrl = (url: string, matchIndex: number) => {
    const lineStart = content.lastIndexOf("\n", matchIndex) + 1
    const lineEndIndex = content.indexOf("\n", matchIndex)
    const lineEnd = lineEndIndex === -1 ? content.length : lineEndIndex
    const line = content.slice(lineStart, lineEnd)
    const beforeUrl = line.slice(0, Math.max(0, line.indexOf(url))).trim()
    const sourceLabel = beforeUrl
      .replace(/^[-\d.\s]*/, "")
      .replace(/^Source:\s*/i, "")
      .replace(/[·\s]+$/, "")
      .trim()
    return sourceLabel || url
  }
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g
  const citations: Array<{ label: string; url: string }> = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = linkPattern.exec(content)) !== null) {
    const url = match[2] || match[3]
    if (url && !seen.has(url)) {
      seen.add(url)
      citations.push({ label: match[1] || labelForBareUrl(url, match.index), url })
    }
  }

  return { sections, citations }
}

function renderInlineLinks(text: string, keyPrefix: string) {
  const parts: Array<string | { label: string; url: string }> = []
  const pattern = /\[([^\]]+)\]\(((?:https?:\/\/|tel:)[^)\s]+)\)|((?:https?:\/\/|tel:)[^\s)]+)/g
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
        target={part.url.startsWith("tel:") ? undefined : "_blank"}
        rel={part.url.startsWith("tel:") ? undefined : "noreferrer"}
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

  if (section.variant === "care") {
    const items = blocks.filter((block) => block.kind !== "blank")
    return (
      <div
        data-testid="chat-section-care-options"
        className={cn("rounded-[16px] border px-4 py-3", tone)}
      >
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-current">
          {Icon ? <Icon size={12} /> : null}
          {section.heading}
        </p>
        <div className="grid gap-2">
          {items.map((block, i) => (
            <div
              key={`care-${i}`}
              className="rounded-[14px] border border-white/10 bg-black/20 px-3 py-2.5 text-[14px] leading-6 text-zinc-100"
            >
              {renderInlineLinks(block.text, `care-${i}`)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Only safety-relevant sections keep a tinted box; everything else flows as
  // plain text so an answer reads as one piece instead of stacked panels.
  const boxed = ["due", "review", "safety"].includes(section.variant)

  return (
    <div
      data-testid={section.heading ? `chat-section-${section.heading.toLowerCase().replace(/[^a-z]+/g, "-")}` : undefined}
      className={cn(
        boxed ? cn("rounded-[14px] border px-4 py-3.5", tone) : "px-0.5 py-1.5",
        idx === 0 && !section.heading && "p-0"
      )}
    >
      {section.heading ? (
        <p
          className={cn(
            "mb-2.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase",
            boxed ? "tracking-[0.12em] text-current" : "tracking-[0.16em] text-zinc-500"
          )}
        >
          {Icon ? <Icon size={12} /> : null}
          {section.heading}
        </p>
      ) : null}
      <div className={cn("space-y-2", section.variant === "answer" ? "text-[17px] leading-8" : "text-[15px] leading-7", "text-zinc-100")}>
        {blocks.map((block, i) => {
          if (block.kind === "blank") return <div key={`b-${i}`} className="h-1.5" />
          // Audit stamps (rule ids, engine versions) read as fine print, never
          // as part of the clinical sentence.
          if (/\bRule: |openrx-screening-engine-\d|openrx-hotfix-prevention-rules-\d/.test(block.text)) {
            return (
              <p key={`b-${i}`} className={cn("font-mono text-[10.5px] tracking-wide text-zinc-500", block.kind === "bullet" && "pl-5")}>
                {block.text}
              </p>
            )
          }
          if (block.kind === "bullet") {
            return (
              <p
                key={`b-${i}`}
                className="pl-5 before:-ml-5 before:mr-2.5 before:text-cyan-300/70 before:content-['•']"
              >
                {renderInlineLinks(block.text, `b-${i}`)}
              </p>
            )
          }
          return (
            <p key={`b-${i}`} className={cn(section.variant === "answer" && "font-serif text-zinc-50")}>
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
          onClick={() => trackWorkflowEvent("source_opened", { surface: "chat" })}
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
  usePrefetchLinks(parsed.citations.map((citation) => citation.url), "chat-guideline-citations")
  return (
    <div className="space-y-3">
      {parsed.sections.map((section, i) => (
        <SectionBlock key={`s-${i}`} section={section} idx={i} />
      ))}
      <CitationRail citations={parsed.citations} />
    </div>
  )
}

function carePlanFromChatPrompt(prompt: string, agentId?: string, answer = ""): CarePlan | null {
  if (agentId === "scheduling") {
    // Do not offer a call task until a directory response includes a usable public contact.
    if (!answer.includes("tel:")) return null
    return createCarePlan({
      origin: "chat",
      patientContextSummary: "Care directory options shown in chat. Confirm access details directly with the office.",
      recommendations: [{
        id: "chat_directory_follow_up",
        title: "Call a care option shown above",
        rationale: "Public directory candidates may help you start a call, but they do not confirm licensure, coverage, ordering authority, or appointment availability.",
        urgency: "routine",
        sourceLabel: "CMS NPI directory candidate",
        sourceUrl: "https://npiregistry.cms.hhs.gov/",
        confidence: "context_dependent",
        status: "new",
        nextAction: "Call the office and confirm they provide the needed service, accept your plan, and are taking patients.",
      }],
    })
  }
  if (agentId !== "screening") return null
  const parsed = parseScreeningIntakeNarrative(prompt)
  if (!parsed.ready) return null
  const result = recommendScreenings(screeningIntakeFromLegacy({
    age: parsed.extracted.age,
    gender: parsed.extracted.gender,
    familyHistory: parsed.extracted.familyHistory,
    conditions: parsed.extracted.conditions,
    smoker: parsed.extracted.smoker,
    symptoms: parsed.extracted.symptoms,
  }))
  if (!result.recommendations.length) return null
  return carePlanFromScreeningRecommendations(result.recommendations, summarizeScreeningIntake(parsed.extracted), "chat")
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

function SmartCareActions({
  items,
  onPrompt,
  variant,
}: {
  items: ActionPlanItem[]
  onPrompt: (prompt: string, targetAgentId?: ActionPlanItem["targetAgentId"]) => void
  variant: "rail" | "dock"
}) {
  if (!items.length) return null

  if (variant === "dock") {
    return (
      <div className="sticky bottom-[86px] z-20 mx-auto mb-2 w-full 2xl:hidden">
        <ChatActionPlan items={items} title="Care actions" layout="dock" onPrompt={onPrompt} />
      </div>
    )
  }

  return (
    <aside
      data-testid="chat-smart-actions-rail"
      aria-label="Care actions"
      className="fixed right-5 top-24 z-20 hidden w-[330px] 2xl:right-[calc((100vw-1440px)/2+24px)] 2xl:block"
    >
      <div className="rounded-[24px] border border-white/12 bg-black/50 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <ChatActionPlan items={items} title="Care actions" layout="rail" testIdPrefix="chat-rail-action" onPrompt={onPrompt} />
        <p className="px-3 pb-2 pt-3 text-[11px] leading-5 text-zinc-300">
          These actions search public directories or prepare the next message. They do not place orders or confirm provider availability.
        </p>
      </div>
    </aside>
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
  const [safetyHold, setSafetyHold] = useState<{ messageId: string; finding: RedFlagResult; acknowledged: boolean } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const seededPromptRef = useRef(false)
  const autoSubmittedPromptRef = useRef(false)
  const renderedConversationIdRef = useRef("")
  const localSessionIdRef = useRef(`chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  const clearChat = useCallback(() => {
    setConversationId("")
    localSessionIdRef.current = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setMessages([buildWelcome(isConnected)])
    setSafetyHold(null)
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
      localSessionIdRef.current = body.conversation.id
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
      localSessionIdRef.current = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setInput("")
      setErrorBanner(null)
      setMessages([buildWelcome(isConnected)])
      setSafetyHold(null)
      inputRef.current?.focus()
    }
    window.addEventListener("openrx:new-chat", handler)
    return () => window.removeEventListener("openrx:new-chat", handler)
  }, [buildWelcome, isConnected])

  useEffect(() => {
    const id = searchParams.get("c") || searchParams.get("conversationId") || ""
    if (!id) {
      // Keep renderedConversationIdRef: this effect re-runs on the state
      // commit before the ?c= navigation lands, and clearing the ref here
      // forced a redundant "Restoring the clinical thread" reload of the
      // exact messages already on screen.
      setConversationId("")
      if (!searchParams.get("prompt") && !renderedConversationIdRef.current) {
        setMessages([buildWelcome(isConnected)])
      }
      return
    }
    if (id !== conversationId) {
      if (renderedConversationIdRef.current === id) {
        renderedConversationIdRef.current = ""
        setConversationId(id)
        return
      }
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
      const nextInput = (messageOverride ?? inputRef.current?.value ?? input).trim()
      if (!nextInput || isLoading || isLoadingConversation) return
      if (safetyHold && !safetyHold.acknowledged && !detectRedFlagText(nextInput)) {
        setErrorBanner("Please acknowledge the urgent safety guidance before starting a different care request.")
        return
      }

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: nextInput,
        timestamp: new Date(),
      }

      const savedInput = nextInput
      const currentAgent = activeAgent
      const agentMsgId = `agent-${Date.now()}`
      const redFlag = detectRedFlagText(nextInput)

      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setIsLoading(true)
      setStreamingId(agentMsgId)
      setErrorBanner(null)
      if (redFlag) {
        setSafetyHold({ messageId: agentMsgId, finding: redFlag, acknowledged: false })
        trackWorkflowEvent("red_flag_triggered", { surface: "chat", category: redFlag.category })
      } else if (messages.length <= 1) {
        trackWorkflowEvent("chat_started", { surface: "chat" })
      }

      const workflow = executeWorkflow(userMsg.content)
      const continuesLocationSearch =
        !agentOverride &&
        activeAgent === "scheduling" &&
        /^\d{5}(?:-\d{4})?$/.test(nextInput)
      const continuesScreeningIntake =
        !agentOverride &&
        activeAgent === "screening" &&
        workflow.route.primaryAgent === "coordinator" &&
        isCompactScreeningFollowUp(nextInput)
      const selectedAgent =
        agentOverride ||
        (continuesLocationSearch || continuesScreeningIntake ? activeAgent : workflow.route.primaryAgent) ||
        currentAgent
      // Serverless instances share no memory, so the client carries the
      // conversation: send recent user turns for any screening-eligible agent.
      const screeningContext = ["screening", "coordinator", "wellness"].includes(selectedAgent)
        ? [
            ...messages
              .filter((message) => message.role === "user")
              .slice(-2)
              .map((message) => message.content),
            nextInput,
          ].join("\n").slice(0, 5000)
        : undefined
      const effectiveSessionId = localSessionIdRef.current
      if (selectedAgent !== activeAgent) setActiveAgent(selectedAgent)

      // Insert an empty agent message that will be filled in via streaming.
      const placeholder: ChatMessage = {
        id: agentMsgId,
        role: "agent",
        content: "",
        agentId: selectedAgent,
        collaborators: workflow.route.collaborators,
        routingInfo: workflow.route.reasoning,
        actionPlan: redFlag ? [] : buildActionPlan(userMsg.content, selectedAgent),
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
            screeningContext,
            sessionId: effectiveSessionId,
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
              screeningContext,
              sessionId: effectiveSessionId,
              walletAddress,
              conversationId: conversationId || undefined,
              collaborators: workflow.route.collaborators,
              routingInfo: workflow.route.reasoning,
            }),
            signal: controller.signal,
          })
          const data = await fallbackRes.json()
          const text = data.response || CLEAN_MODEL_BUSY_MESSAGE
          setMessages((prev) => prev.map((m) => (m.id === agentMsgId ? { ...m, content: text } : m)))
          trackWorkflowEvent("answer_generated", { surface: "chat", has_sources: text.includes("http") })
          if (data.conversationId && data.conversationId !== conversationId) {
            renderedConversationIdRef.current = data.conversationId
            setConversationId(data.conversationId)
            router.replace(`/chat?c=${encodeURIComponent(data.conversationId)}`, { scroll: false })
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
              trackWorkflowEvent("answer_generated", { surface: "chat", has_sources: Boolean(parsed.finalText?.includes("http")) })
              if (parsed.conversationId && parsed.conversationId !== conversationId) {
                renderedConversationIdRef.current = parsed.conversationId
                setConversationId(parsed.conversationId)
                router.replace(`/chat?c=${encodeURIComponent(parsed.conversationId)}`, { scroll: false })
              }
              window.dispatchEvent(new CustomEvent("openrx:chat-history-refresh"))
            } catch {
              // Ignore malformed done event
            }
          } else if (event === "error") {
            try {
              if (accumulated.length === 0) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId
                      ? { ...m, content: CLEAN_MODEL_BUSY_MESSAGE }
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
                ? { ...m, content: CLEAN_MODEL_BUSY_MESSAGE }
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
    [input, isLoading, isLoadingConversation, activeAgent, walletAddress, getWalletAuthHeaders, conversationId, messages, router, safetyHold]
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
  const visibleMessages = useMemo(
    () => showEmptyState ? [] : messages.filter((message) => message.id !== "welcome"),
    [messages, showEmptyState]
  )
  const latestActionItems = useMemo(() => {
    if (isLoading) return []
    const latest = [...visibleMessages]
      .reverse()
      .find((message) =>
        message.role === "agent" &&
        message.content.trim() &&
        message.actionPlan?.length &&
        streamingId !== message.id &&
        !isClarifyingScreeningMessage(message) &&
        !isCleanModelBusyMessage(message)
      )
    return latest?.actionPlan || []
  }, [isLoading, streamingId, visibleMessages])

  const handleActionPrompt = useCallback((prompt: string, targetAgentId?: ActionPlanItem["targetAgentId"]) => {
    void sendMessage(prompt, targetAgentId)
  }, [sendMessage])

  // One clean field — input and send button in a single container, with the
  // disclaimer as quiet text underneath rather than boxed inside.
  const renderComposer = (placement: "hero" | "thread") => (
    <div className={cn(placement === "hero" ? "w-full" : "sticky bottom-2 mb-2")}>
      <form
        className={cn(
          "group flex items-end gap-2 border border-white/12 bg-[#0d0f0f]/95 px-4 shadow-[0_26px_90px_rgba(0,0,0,0.50)] backdrop-blur-xl transition focus-within:border-cyan-200/45 focus-within:shadow-[0_0_0_3px_rgba(165,243,252,0.10),0_28px_92px_rgba(0,0,0,0.58)]",
          placement === "hero" ? "rounded-[30px] py-3" : "rounded-[26px] py-2.5"
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
          onInput={(event) => setInput(event.currentTarget.value)}
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
          placeholder="Ask what is due, what it means, or who to call next..."
          disabled={isLoadingConversation}
          rows={1}
          className={cn(
            "block w-full flex-1 resize-none overflow-hidden border-0 bg-transparent py-1.5 text-zinc-50 outline-none placeholder:text-zinc-400",
            placement === "hero" ? "min-h-[56px] text-[17px] leading-7" : "min-h-[36px] text-[15px] leading-6"
          )}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={stopGeneration}
            data-testid="chat-stop-button"
            aria-label="Stop generating"
            className={cn(
              "mb-0.5 inline-flex shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] text-zinc-100 transition hover:border-white/40 hover:bg-white/[0.12]",
              placement === "hero" ? "h-10 w-10" : "h-9 w-9"
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
              "mb-0.5 inline-flex shrink-0 items-center justify-center rounded-full bg-cyan-200 text-black shadow-[0_10px_28px_rgba(103,232,249,0.16)] transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40",
              placement === "hero" ? "h-10 w-10" : "h-9 w-9"
            )}
          >
            <ArrowUp size={placement === "hero" ? 16 : 14} />
          </button>
        )}
      </form>
      <p className={cn("mt-2 px-3 text-center text-[11px] text-zinc-300", placement === "hero" && "hidden sm:block")}>
        {isLoading
          ? "Press Esc to stop. Streaming the answer…"
          : "Guideline-linked answers, sources, and explicit links. Not a substitute for clinician judgment."}
      </p>
    </div>
  )

  return (
    <div
      data-openrx-chat-workspace
      className={cn(
        "relative isolate mx-auto flex min-h-screen animate-fade-in flex-col overflow-hidden bg-[#030303] px-4 text-zinc-100 sm:px-6",
        showEmptyState ? "max-w-7xl justify-center" : "max-w-3xl"
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_10%,rgba(103,232,249,0.10),transparent_32%),radial-gradient(circle_at_78%_68%,rgba(20,184,166,0.075),transparent_28%),linear-gradient(180deg,#030303_0%,#050505_58%,#070707_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:44px_44px]" />
      {showEmptyState ? (
        <main
          data-testid="chat-empty-state"
          className="grid min-h-screen flex-1 items-center gap-8 px-2 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6"
        >
          <section className="mx-auto w-full max-w-3xl lg:mx-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-[12px] font-medium text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {isConnected ? "Personalized workspace" : "Clinical answers + phone-number handoffs"}
            </div>
            <h1 className="mt-7 max-w-3xl font-serif text-[clamp(2.8rem,7.4vw,5.7rem)] font-medium leading-[0.94] tracking-[-0.018em] text-white text-balance">
              Ask a clinical question.
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-[16px] leading-8 text-zinc-300 sm:text-[18px]">
              OpenRx turns a plain-language question into a sourced answer, then gives you the next useful link: screening plan, provider, lab, pharmacy, clinical trial, or clinician message.
            </p>

            <div className="mt-9">{renderComposer("hero")}</div>

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

            <div className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="Example questions">
              {EXAMPLE_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => setInput(question)}
                  className="min-h-[68px] rounded-[16px] border border-white/10 bg-white/[0.035] px-3 py-3 text-left text-[13px] font-medium leading-5 text-zinc-200 transition hover:border-cyan-200/28 hover:bg-cyan-200/[0.07] hover:text-cyan-50"
                >
                  {question}
                </button>
              ))}
            </div>

            <nav
              aria-label="Care service links"
              className="mt-5 grid w-full gap-2 sm:grid-cols-3"
            >
              {SERVICE_LINKS.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.label}
                    type="button"
                    title={item.description}
                    onClick={() => {
                      void sendMessage(item.prompt, item.agentId)
                    }}
                    className="group flex min-h-[78px] items-start gap-3 rounded-[18px] border border-white/12 bg-white/[0.045] px-3.5 py-3 text-left transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.075]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-200/16 bg-cyan-200/[0.08] text-cyan-100">
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-zinc-50">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-5 text-zinc-400 group-hover:text-zinc-300">{item.description}</span>
                    </span>
                  </button>
                )
              })}
            </nav>

            <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-zinc-400">
              {TRUST_MARKERS.map((marker) => (
                <span key={marker} className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-cyan-200/70" />
                  {marker}
                </span>
              ))}
            </div>
          </section>

          <aside className="mx-auto w-full max-w-[380px] lg:mx-0" aria-label="OpenRx answer workflow">
            <div className="overflow-hidden rounded-[28px] border border-white/12 bg-[#0b0d0d]/78 shadow-[0_30px_90px_rgba(0,0,0,0.46)] backdrop-blur-2xl">
              <div className="border-b border-white/10 bg-white/[0.035] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">What happens next</p>
                <p className="mt-2 text-[17px] font-semibold tracking-tight text-white">Answer, evidence, action.</p>
              </div>
              <div className="grid gap-3 p-4">
                {CARE_PATH_PREVIEW.map((step, index) => {
                  const Icon = step.icon
                  return (
                    <div key={step.label} className="relative rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5">
                      {index < CARE_PATH_PREVIEW.length - 1 ? (
                        <span aria-hidden className="absolute left-[29px] top-[56px] h-6 w-px bg-white/12" />
                      ) : null}
                      <div className="flex gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-200 text-black">
                          <Icon size={14} />
                        </span>
                        <span>
                          <span className="block text-[13px] font-semibold text-zinc-50">{step.label}</span>
                          <span className="mt-1 block text-[12px] leading-5 text-zinc-300">{step.description}</span>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-white/10 p-4">
                <div className="rounded-[18px] border border-cyan-200/18 bg-cyan-200/[0.07] p-3.5">
                  <p className="text-[12px] font-semibold text-cyan-50">Example output</p>
                  <p className="mt-2 text-[13px] leading-6 text-zinc-200">Colorectal screening may be due. Source: USPSTF 2021, Grade B.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-cyan-200/18 bg-black/24 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">Find care</span>
                    <span className="rounded-full border border-cyan-200/18 bg-black/24 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">Open source</span>
                    <span className="rounded-full border border-cyan-200/18 bg-black/24 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">Call script</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </main>
      ) : (
        <>
      <SmartCareActions items={latestActionItems} onPrompt={handleActionPrompt} variant="rail" />
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300">Ask OpenRx</p>
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

        {visibleMessages.map((msg, index) => {
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
                  className="max-w-[85%] whitespace-pre-wrap rounded-[16px] border border-cyan-200/14 bg-cyan-200/[0.10] px-4 py-3 text-[15px] leading-7 text-cyan-50"
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
          const previousUserMessage = [...visibleMessages.slice(0, index)].reverse().find((entry) => entry.role === "user")
          const carePlanDraft = previousUserMessage ? carePlanFromChatPrompt(previousUserMessage.content, msg.agentId, msg.content) : null
          const trustSources = parseAnswer(msg.content).citations.map((citation) => ({ label: citation.label, url: citation.url }))
          const recentUserContext = visibleMessages
            .slice(0, index)
            .filter((entry) => entry.role === "user")
            .slice(-3)
            .map((entry) => entry.content)
            .join("\n")
          const screeningInputSummary = msg.agentId === "screening" && recentUserContext
            ? summarizeScreeningIntake(parseScreeningIntakeNarrative(recentUserContext).extracted)
            : null
          const hasScreeningInputs = Boolean(screeningInputSummary && !screeningInputSummary.startsWith("Limited context"))
          const isClarifyingScreeningIntake = isClarifyingScreeningMessage(msg)
          return (
            <article key={msg.id} data-testid="chat-message-agent" className="animate-fade-in space-y-3">
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-cyan-200/15 bg-cyan-200/[0.06] text-cyan-300/80">
                  <Icon size={10} />
                </span>
                {meta?.label || "OpenRx"}
                {isStreamingThis ? (
                  <span className="ml-1 text-[10px] font-medium normal-case tracking-normal text-zinc-300">
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
                  {safetyHold?.messageId === msg.id ? (
                    <RedFlagAlert
                      finding={safetyHold.finding}
                      acknowledged={safetyHold.acknowledged}
                      onAcknowledge={() => setSafetyHold((current) => current ? { ...current, acknowledged: true } : current)}
                    />
                  ) : null}
                  {carePlanDraft && !isStreamingThis && !isClarifyingScreeningIntake ? <CarePlanPreview draft={carePlanDraft} compact /> : null}
                  {!isStreamingThis && msg.content.trim() ? (
                    <TrustDrawer
                      sources={trustSources}
                      inputsUsed={carePlanDraft ? [carePlanDraft.patientContextSummary] : hasScreeningInputs ? [screeningInputSummary!] : []}
                      inputsNotUsed={carePlanDraft || hasScreeningInputs ? ["Insurance and payer network", "Full medical record"] : ["No saved patient profile required"]}
                      phiSentToModel={msg.agentId !== "screening" && msg.agentId !== "scheduling" && msg.agentId !== "triage"}
                      emergencyWarning={safetyHold?.messageId === msg.id ? safetyHold.finding.emergencyMessage : undefined}
                      clinicianQuestions={carePlanDraft ? ["What screening interval applies to my history?", "Who can coordinate the next step?"] : []}
                    />
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    {!isStreamingThis && msg.content.trim() ? <CopyButton text={msg.content} /> : null}
                    {!isStreamingThis && msg.content.trim() && !isClarifyingScreeningIntake ? <SupportOpenRx /> : null}
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

      <SmartCareActions items={latestActionItems} onPrompt={handleActionPrompt} variant="dock" />

      {/* Composer */}
      {renderComposer("thread")}
        </>
      )}
    </div>
  )
}
