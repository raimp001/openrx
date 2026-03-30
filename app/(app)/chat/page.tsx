"use client"

import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"
import { cn } from "@/lib/utils"
import {
  executeWorkflow,
} from "@/lib/openclaw/orchestrator"
import { useWalletIdentity } from "@/lib/wallet-context"
import {
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
  Zap,
  Clock,
  Users,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  GitBranch,
  Trash2,
  Activity,
  Eye,
  Search,
  MessageSquare,
  Sparkles,
} from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { AppPageHeader } from "@/components/layout/app-page"
import { ShrinkwrapBubble } from "@/components/shrinkwrap-bubble"

type AgentId = typeof OPENCLAW_CONFIG.agents[number]["id"]

const QUICK_PROMPTS = [
  { label: "What should I do next?", prompt: "Based on my health profile, what are the most important things I should do this week?", agentId: "coordinator" as AgentId, icon: CircleDot },
  { label: "Screening due?", prompt: "Which preventive screenings am I due or overdue for, based on my age and risk factors?", agentId: "screening" as AgentId, icon: Eye },
  { label: "Refill status", prompt: "Which of my medications need refills soon and are there any adherence issues?", agentId: "rx" as AgentId, icon: Pill },
  { label: "Explain a bill", prompt: "Do I have any unpaid bills or denied claims? Explain them in plain English.", agentId: "billing" as AgentId, icon: Receipt },
  { label: "Prior auth status", prompt: "What is the status of my pending prior authorizations?", agentId: "prior-auth" as AgentId, icon: ShieldCheck },
  { label: "Find a provider", prompt: "Help me find a specialist near me. I need recommendations based on my insurance.", agentId: "coordinator" as AgentId, icon: Search },
  { label: "Questions for my doctor", prompt: "Based on my recent labs and health history, what questions should I ask at my next appointment?", agentId: "second-opinion" as AgentId, icon: MessageSquare },
  { label: "Clinical trials", prompt: "Find recruiting clinical trials relevant to my health profile and explain likely fit.", agentId: "trials" as AgentId, icon: FlaskConical },
]

// We need CircleDot imported
import { CircleDot } from "lucide-react"

interface ChatMessage {
  id: string
  role: "user" | "agent" | "system"
  content: string
  agentId?: string
  collaborators?: string[]
  routingInfo?: string
  timestamp: Date
}

const agentMeta: Record<string, { label: string; shortName: string; icon: typeof Bot; color: string }> = {
  onboarding: { label: "Sage", shortName: "Sage", icon: Heart, color: "text-teal" },
  coordinator: { label: "Atlas", shortName: "Atlas", icon: Bot, color: "text-teal" },
  triage: { label: "Nova", shortName: "Nova", icon: Stethoscope, color: "text-red-500" },
  scheduling: { label: "Cal", shortName: "Cal", icon: Calendar, color: "text-violet" },
  billing: { label: "Vera", shortName: "Vera", icon: Receipt, color: "text-emerald-600" },
  rx: { label: "Maya", shortName: "Maya", icon: Pill, color: "text-amber-600" },
  "prior-auth": { label: "Rex", shortName: "Rex", icon: ShieldCheck, color: "text-teal-dark" },
  wellness: { label: "Ivy", shortName: "Ivy", icon: Activity, color: "text-emerald-600" },
  screening: { label: "Quinn", shortName: "Quinn", icon: Eye, color: "text-teal" },
  "second-opinion": { label: "Orion", shortName: "Orion", icon: Stethoscope, color: "text-violet" },
  trials: { label: "Lyra", shortName: "Lyra", icon: FlaskConical, color: "text-amber" },
  devops: { label: "Bolt", shortName: "Bolt", icon: Zap, color: "text-secondary" },
}

export default function ChatPage() {
  const { isConnected, walletAddress } = useWalletIdentity()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      content:
        "Hi, I'm Atlas — your care coordination assistant.\n\n" +
        "I work with a team of specialist agents to help you navigate appointments, medications, billing, screenings, and more.\n\n" +
        (isConnected ? "Your wallet is connected. I can see your profile.\n\n" : "") +
        "What can I help with?",
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

  const clearChat = useCallback(() => {
    setMessages([{
      id: "welcome",
      role: "agent",
      content: "Hi, I'm Atlas — your care coordination assistant.\n\nWhat can I help with?",
      agentId: "coordinator",
      timestamp: new Date(),
    }])
    inputRef.current?.focus()
  }, [])

  const sendQuickPrompt = useCallback((prompt: string, agentId: AgentId) => {
    setInput(prompt)
    setActiveAgent(agentId)
    setTimeout(() => inputRef.current?.focus(), 0)
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

    const workflow = executeWorkflow(userMsg.content)

    if (workflow.route.primaryAgent !== activeAgent) {
      setActiveAgent(workflow.route.primaryAgent)
    }

    if (workflow.route.collaborators.length > 0) {
      const names = workflow.route.collaborators
        .map((id) => agentMeta[id]?.shortName || id)
        .join(", ")
      const primary = agentMeta[workflow.route.primaryAgent]?.shortName || "Agent"

      setMessages((prev) => [
        ...prev,
        {
          id: `routing-${Date.now()}`,
          role: "system",
          content: `${primary} is handling this with ${names}`,
          timestamp: new Date(),
        },
      ])
    }

    try {
      const res = await fetch("/api/openclaw/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          agentId: workflow.route.primaryAgent,
          walletAddress: walletAddress,
        }),
      })

      const data = await res.json()

      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: data.response || data.error || "No response received.",
          agentId: workflow.route.primaryAgent,
          collaborators: workflow.route.collaborators,
          routingInfo: workflow.route.reasoning,
          timestamp: new Date(),
        },
      ])
    } catch {
      setInput(savedInput)
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "system",
          content: "Connection error. Your message has been restored — try again.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, activeAgent, walletAddress])

  const currentAgentMeta = agentMeta[activeAgent]

  return (
    <div className="animate-slide-up space-y-4">
      {/* Header */}
      <AppPageHeader
        leading={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-teal">
            <Bot size={18} className="text-white" />
          </div>
        }
        title="AI Concierge"
        meta={
          <div className="flex items-center gap-3">
            {gatewayStatus === "online" ? (
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                Connected
              </span>
            ) : gatewayStatus === "offline" ? (
              <span className="flex items-center gap-1 text-[10px] font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                Offline
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-muted">
                <Loader2 size={9} className="animate-spin" /> Connecting
              </span>
            )}
            {currentAgentMeta && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-secondary">
                <currentAgentMeta.icon size={10} className={currentAgentMeta.color} />
                {currentAgentMeta.label}
              </span>
            )}
          </div>
        }
      />

      {/* Agent selector — compact pill row */}
      <div className="flex gap-1 flex-wrap">
        {OPENCLAW_CONFIG.agents.map((agent) => {
          const meta = agentMeta[agent.id]
          const Icon = meta?.icon || Bot
          const isActive = activeAgent === agent.id
          return (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent.id as AgentId)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all border",
                isActive
                  ? "bg-teal-50/60 text-teal-700 border-teal/10"
                  : "text-muted border-transparent hover:text-secondary hover:bg-zinc-50"
              )}
            >
              <Icon size={11} className={isActive ? meta?.color : ""} />
              {agent.name}
            </button>
          )
        })}
      </div>

      {/* Chat window */}
      <div className="surface-card flex min-h-[min(520px,calc(100vh-13rem))] max-h-[calc(100vh-12rem)] flex-col overflow-hidden">
        {/* Messages */}
        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
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
                <div className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
                  {msg.role !== "system" && (
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                      msg.role === "agent" ? "bg-teal-50/60" : "bg-blue-50/60"
                    )}>
                      {msg.role === "user" ? (
                        <User size={13} className="text-blue-500" />
                      ) : (
                        <Icon size={13} className={meta?.color || "text-teal"} />
                      )}
                    </div>
                  )}
                  <ShrinkwrapBubble
                    text={msg.content}
                    role={msg.role}
                    className={cn(
                      msg.role === "user"
                        ? "chat-bubble-user"
                        : msg.role === "system"
                        ? "chat-bubble-system !w-full"
                        : "chat-bubble-agent"
                    )}
                  >
                    {msg.role === "system" ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <GitBranch size={10} className="text-amber-500" />
                        <span className="text-[11px] text-amber-700 font-medium">{msg.content}</span>
                      </div>
                    ) : (
                      <>
                        {msg.role === "agent" && meta && (
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider", meta.color)}>
                              {meta.label}
                            </span>
                            {msg.collaborators && msg.collaborators.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[9px] text-muted">
                                <Users size={8} />
                                +{msg.collaborators.length}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-[14px] text-primary leading-relaxed whitespace-pre-line">
                          {msg.content}
                        </p>
                        <span className="text-[10px] text-muted mt-1.5 block">
                          {msg.timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </>
                    )}
                  </ShrinkwrapBubble>
                </div>

                {msg.routingInfo && (
                  <div className="ml-11 mt-1 flex items-center gap-1.5">
                    <AlertCircle size={8} className="text-muted" />
                    <span className="text-[9px] text-muted italic">{msg.routingInfo}</span>
                  </div>
                )}
              </div>
            )
          })}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-50/60 flex items-center justify-center">
                <Bot size={13} className="text-teal" />
              </div>
              <div className="chat-bubble-agent">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-teal/40 animate-pulse-soft"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-[12px] text-muted">
                    {currentAgentMeta?.label || "Agent"} is thinking...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts — show when only welcome message */}
        {messages.length <= 1 && (
          <div className="px-5 py-3 border-t border-border/30">
            <p className="text-[10px] font-medium text-muted uppercase tracking-wider mb-2">Try asking</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => sendQuickPrompt(qp.prompt, qp.agentId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-secondary bg-surface hover:bg-teal-50/40 hover:text-teal border border-border/40 hover:border-teal/10 rounded-full transition"
                >
                  <qp.icon size={10} />
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="sticky bottom-0 z-10 border-t border-border/40 bg-white/95 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
          <div className="flex items-end gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={`Ask ${currentAgentMeta?.label || "your care team"} anything...`}
              disabled={isLoading}
              aria-label="Message to AI concierge"
              className="min-h-11 flex-1 rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-sm placeholder:text-muted transition focus:border-teal/20 focus:outline-none focus:ring-2 focus:ring-teal/10 disabled:opacity-50"
            />
            {messages.length > 1 && (
              <button
                type="button"
                onClick={clearChat}
                disabled={isLoading}
                title="Clear conversation"
                aria-label="Clear conversation"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-zinc-50 hover:text-secondary disabled:opacity-50"
              >
                <Trash2 size={16} className="shrink-0" />
              </button>
            )}
            <button
              type="button"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-teal text-white transition hover:shadow-glow-sm disabled:opacity-50 sm:min-w-[4.5rem] sm:gap-2 sm:px-4"
            >
              <Send size={16} className="shrink-0 sm:hidden" />
              <span className="hidden text-[13px] font-semibold sm:inline">Send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Agent activity footer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="surface-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/30">
            <Zap size={12} className="text-teal" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Active Automations</span>
          </div>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-2">
            {OPENCLAW_CONFIG.cronJobs.slice(0, 6).map((job) => {
              const agent = OPENCLAW_CONFIG.agents.find((a) => a.id === job.agentId)
              const meta = agentMeta[job.agentId]
              const Icon = meta?.icon || Bot
              return (
                <div key={job.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-surface/50 transition">
                  <Icon size={12} className={cn("mt-0.5 shrink-0", meta?.color || "text-teal")} />
                  <div>
                    <p className="text-[11px] font-medium text-primary">{job.description}</p>
                    <p className="text-[10px] text-muted mt-0.5">
                      {job.schedule} · {agent?.name}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/30">
            <GitBranch size={12} className="text-teal" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Agent Activity</span>
          </div>
          <div className="p-8 text-center">
            <Users size={18} className="text-muted mx-auto mb-2" />
            <p className="text-[12px] text-muted">Send a message to see agents collaborate</p>
          </div>
        </div>
      </div>
    </div>
  )
}
