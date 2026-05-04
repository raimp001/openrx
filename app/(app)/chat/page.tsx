"use client"

import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"
import { cn } from "@/lib/utils"
import {
  executeWorkflow,
} from "@/lib/openclaw/orchestrator"
import { useWalletIdentity } from "@/lib/wallet-context"
import {
  ArrowRight,
  Bot,
  Calendar,
  Receipt,
  ShieldCheck,
  Pill,
  Send,
  User,
  Stethoscope,
  Heart,
  FlaskConical,
  Loader2,
  Wifi,
  WifiOff,
  Users,
  CheckCircle2,
  AlertCircle,
  GitBranch,
  Trash2,
} from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge } from "@/components/ui/ops-primitives"
import { resolveCareHandoff, type CareHandoffAction } from "@/lib/care-handoff"

type AgentId = typeof OPENCLAW_CONFIG.agents[number]["id"]

const QUICK_PROMPTS = [
  { label: "Next appointment", prompt: "When is my next appointment and what should I bring?", agentId: "scheduling" as AgentId },
  { label: "Medication refills", prompt: "Which of my medications need refills soon?", agentId: "rx" as AgentId },
  { label: "Bill questions", prompt: "Do I have any unpaid bills or denied claims I should address?", agentId: "billing" as AgentId },
  { label: "Prior auth status", prompt: "What is the status of my pending prior authorizations?", agentId: "prior-auth" as AgentId },
  { label: "Lab results", prompt: "Can you summarize my recent lab results and flag anything abnormal?", agentId: "coordinator" as AgentId },
  { label: "Wellness tips", prompt: "Based on my health history, what preventive care steps should I take this year?", agentId: "wellness" as AgentId },
  { label: "Screening risk", prompt: "Run my preventive risk screening and prioritize top actions for this month.", agentId: "screening" as AgentId },
  { label: "Second opinion", prompt: "Review my diabetes care plan and give me key clinician questions for a second opinion.", agentId: "second-opinion" as AgentId },
  { label: "Find trials", prompt: "Find recruiting clinical trials relevant to my health profile and explain likely fit.", agentId: "trials" as AgentId },
]

interface ChatMessage {
  id: string
  role: "user" | "agent" | "system"
  content: string
  agentId?: string
  collaborators?: string[]
  routingInfo?: string
  action?: CareHandoffAction
  timestamp: Date
}

const agentMeta: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  onboarding: { label: "Care setup", icon: Bot, color: "text-teal" },
  coordinator: { label: "General help", icon: Bot, color: "text-teal" },
  triage: { label: "Symptoms and urgency", icon: Stethoscope, color: "text-soft-red" },
  scheduling: { label: "Appointments", icon: Calendar, color: "text-soft-blue" },
  billing: { label: "Coverage and bills", icon: Receipt, color: "text-accent" },
  rx: { label: "Medications", icon: Pill, color: "text-yellow-600" },
  "prior-auth": { label: "Coverage approvals", icon: ShieldCheck, color: "text-teal" },
  wellness: { label: "Prevention", icon: Stethoscope, color: "text-accent" },
  screening: { label: "Screening review", icon: Heart, color: "text-teal" },
  "second-opinion": { label: "Second opinion", icon: ShieldCheck, color: "text-soft-blue" },
  trials: { label: "Clinical trials", icon: FlaskConical, color: "text-accent" },
  devops: { label: "Product status", icon: Bot, color: "text-secondary" },
}

export default function ChatPage() {
  const { isConnected, walletAddress, getWalletAuthHeaders } = useWalletIdentity()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      content:
        "Welcome to OpenRx. Ask about referrals, coverage, medications, appointments, screenings, or confusing results.\n\n" +
        (isConnected
          ? "Your account is connected, so replies can use your saved profile.\n\n"
          : "") +
        "How can I help you today?",
      agentId: "coordinator",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [gatewayStatus, setGatewayStatus] = useState<"checking" | "online" | "offline">("checking")
  const [activeAgent, setActiveAgent] = useState<AgentId>("coordinator")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const seededPromptRef = useRef(false)

  const welcomeMessage: ChatMessage = {
    id: "welcome",
    role: "agent",
    content:
      "Welcome to OpenRx. Ask about referrals, coverage, medications, appointments, screenings, or confusing results.\n\n" +
      (isConnected
        ? "Your account is connected, so replies can use your saved profile.\n\n"
        : "") +
      "How can I help you today?",
    agentId: "coordinator",
    timestamp: new Date(),
  }

  const clearChat = useCallback(() => {
    setMessages([welcomeMessage])
    inputRef.current?.focus()
  }, [isConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendQuickPrompt = useCallback((prompt: string, agentId: AgentId) => {
    setInput(prompt)
    setActiveAgent(agentId)
    inputRef.current?.focus()
  }, [])

  const openCareHandoff = useCallback((action: CareHandoffAction) => {
    if (typeof window === "undefined") return
    window.sessionStorage.setItem(action.storageKey, JSON.stringify(action.payload))
    window.location.href = action.href
  }, [])

  // Preload questions from the homepage/dashboard ask panels without sending on the patient's behalf.
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

  // Check gateway status
  useEffect(() => {
    fetch("/api/openclaw/status")
      .then((r) => r.json())
      .then((d) => setGatewayStatus(d.connected ? "online" : "offline"))
      .catch(() => setGatewayStatus("offline"))
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }

    const savedInput = input.trim()
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)

    // Execute orchestrator workflow — route to best agent with collaborators
    const workflow = executeWorkflow(userMsg.content)

    // If the orchestrator routes to a different agent, auto-switch
    if (workflow.route.primaryAgent !== activeAgent) {
      setActiveAgent(workflow.route.primaryAgent)
    }

    // Show routing info as a system message if collaborators are involved
    if (workflow.route.collaborators.length > 0) {
      const collaboratorNames = workflow.route.collaborators
        .map((id) => {
          return agentMeta[id]?.label || id
        })
        .join(", ")
      const primaryAgent = agentMeta[workflow.route.primaryAgent]

      setMessages((prev) => [
        ...prev,
        {
          id: `routing-${Date.now()}`,
          role: "system",
          content: `I’m routing this to ${primaryAgent?.label || "the right care area"} and checking ${collaboratorNames} in the background.`,
          timestamp: new Date(),
        },
      ])
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
          walletAddress: walletAddress,
        }),
      })

      const data = await res.json()

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        content: data.response || data.error || "No response received.",
        agentId: workflow.route.primaryAgent,
        collaborators: workflow.route.collaborators,
        routingInfo: workflow.route.reasoning,
        action: resolveCareHandoff(userMsg.content, workflow.route.primaryAgent) || undefined,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, agentMsg])
    } catch {
      setInput(savedInput)
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "system",
          content: "Connection error. Your message has been restored — try sending again.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, activeAgent, walletAddress, getWalletAuthHeaders])

  const activeMeta = agentMeta[activeAgent] ?? agentMeta.coordinator

  return (
    <div className="mx-auto max-w-4xl animate-slide-up space-y-4">
      <AppPageHeader
        eyebrow="Ask"
        title="Ask OpenRx."
        description="One question at a time. OpenRx will route the care work quietly."
        meta={
          <>
            {gatewayStatus === "checking" ? (
              <OpsBadge tone="blue"><Loader2 size={10} className="animate-spin" /> connecting</OpsBadge>
            ) : gatewayStatus === "online" ? (
              <OpsBadge tone="accent"><Wifi size={10} /> online</OpsBadge>
            ) : (
              <OpsBadge tone="red"><WifiOff size={10} /> offline</OpsBadge>
            )}
            <OpsBadge tone={isConnected ? "accent" : "gold"}>
              {isConnected ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
              {isConnected ? "personalized" : "general"}
            </OpsBadge>
            <OpsBadge tone="terra">{activeMeta.label}</OpsBadge>
          </>
        }
        actions={messages.length > 1 ? (
          <button type="button" onClick={clearChat} className="control-button-secondary px-3 py-2" disabled={isLoading}>
            <Trash2 size={12} />
            Clear
          </button>
        ) : null}
      />

      <section className="surface-card flex min-h-[min(680px,calc(100vh-10rem))] flex-col overflow-hidden p-0">
        <div className="border-b border-[rgba(82,108,139,0.12)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-primary">{activeMeta.label}</p>
            <p className="text-xs text-muted">Ask. Review. Move.</p>
          </div>
          {messages.length <= 1 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_PROMPTS.slice(0, 6).map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => sendQuickPrompt(qp.prompt, qp.agentId)}
                  className="rounded-full border border-[rgba(82,108,139,0.12)] bg-white/62 px-3 py-1.5 text-[12px] font-medium text-secondary transition hover:bg-white hover:text-primary"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Chat messages"
        >
          {messages.map((msg) => {
            const meta = msg.agentId ? agentMeta[msg.agentId] : null
            const Icon = meta?.icon || Bot

            return (
              <div key={msg.id}>
                {msg.role === "system" ? (
                  <div className="rounded-[16px] bg-amber-50/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-800">
                      <GitBranch size={11} />
                      Routing
                    </div>
                    <p className="mt-1 text-xs leading-6 text-secondary">{msg.content}</p>
                  </div>
                ) : (
                  <div className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        msg.role === "agent" ? "bg-teal/10" : "bg-soft-blue/10"
                      )}
                    >
                      {msg.role === "user" ? (
                        <User size={14} className="text-soft-blue" />
                      ) : (
                        <Icon size={14} className={meta?.color || "text-teal"} />
                      )}
                    </div>
                    <div
                      className={cn(
                        "max-w-[86%] rounded-[20px] px-4 py-3",
                        msg.role === "user" ? "bg-white text-primary" : "bg-[rgba(245,249,255,0.78)] text-primary"
                      )}
                    >
                      {msg.role === "agent" && meta ? (
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={cn("text-[10px] font-semibold uppercase tracking-[0.12em]", meta.color)}>
                            {meta.label}
                          </span>
                          {msg.collaborators?.length ? (
                            <OpsBadge tone="gold" className="px-2 py-0">
                              <Users size={10} />
                              +{msg.collaborators.length}
                            </OpsBadge>
                          ) : null}
                        </div>
                      ) : null}
                      <p className="whitespace-pre-line text-sm leading-7">{msg.content}</p>
                      {msg.routingInfo ? <p className="mt-2 text-[10px] italic text-muted">{msg.routingInfo}</p> : null}
                      {msg.action ? (
                        <button
                          type="button"
                          onClick={() => openCareHandoff(msg.action!)}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-midnight px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#12211d]"
                        >
                          {msg.action.label}
                          <ArrowRight size={12} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {isLoading ? (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal/10">
                <Bot size={14} className="text-teal" />
              </div>
              <div className="rounded-[20px] bg-[rgba(245,249,255,0.78)] px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <Loader2 size={14} className="animate-spin text-teal" />
                  Checking context...
                </div>
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-[rgba(82,108,139,0.12)] bg-white/56 px-3 py-3 sm:px-4">
          <div className="flex items-end gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask OpenRx what to do next..."
              disabled={isLoading}
              aria-label="Message OpenRx help"
              className="min-h-11 flex-1 rounded-full border border-[rgba(82,108,139,0.14)] bg-white px-4 py-2.5 text-sm text-primary placeholder:text-muted transition focus:border-teal/25 focus:outline-none focus:ring-1 focus:ring-teal/10 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
              className="control-button-primary min-w-[4.5rem] justify-center px-4"
            >
              <Send size={15} />
              Send
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
