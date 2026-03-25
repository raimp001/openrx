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
} from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { AppPageHeader } from "@/components/layout/app-page"

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
  timestamp: Date
}

const agentMeta: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  onboarding: { label: "Sage (Onboarding)", icon: Bot, color: "text-teal" },
  coordinator: { label: "Atlas (Coordinator)", icon: Bot, color: "text-teal" },
  triage: { label: "Nova (Triage)", icon: Stethoscope, color: "text-soft-red" },
  scheduling: { label: "Cal (Scheduler)", icon: Calendar, color: "text-soft-blue" },
  billing: { label: "Vera (Billing)", icon: Receipt, color: "text-accent" },
  rx: { label: "Maya (Rx)", icon: Pill, color: "text-yellow-600" },
  "prior-auth": { label: "Rex (PA)", icon: ShieldCheck, color: "text-teal" },
  wellness: { label: "Ivy (Wellness)", icon: Stethoscope, color: "text-accent" },
  screening: { label: "Quinn (Screening)", icon: Heart, color: "text-teal" },
  "second-opinion": { label: "Orion (Second Opinion)", icon: ShieldCheck, color: "text-soft-blue" },
  trials: { label: "Lyra (Trials)", icon: FlaskConical, color: "text-accent" },
  devops: { label: "Bolt (DevOps)", icon: Bot, color: "text-secondary" },
}

export default function ChatPage() {
  const { isConnected, walletAddress } = useWalletIdentity()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      content:
        "Welcome to OpenRx AI. I'm Atlas, your healthcare coordination agent powered by OpenClaw.\n\nI orchestrate a team of 9 specialist agents who collaborate to help you:\n\n" +
        (isConnected
          ? "Your wallet is connected. I can see your profile and personalize my responses.\n\n"
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
  const [showImprovements, setShowImprovements] = useState(false)
  const [improvementData, setImprovementData] = useState<{
    metrics: { totalSuggested: number; totalDeployed: number; totalInProgress: number; totalApproved: number }
    improvements: Array<{ id: string; title: string; status: string; category: string; suggestedBy: string; votes: number }>
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const welcomeMessage: ChatMessage = {
    id: "welcome",
    role: "agent",
    content:
      "Welcome to OpenRx AI. I'm Atlas, your healthcare coordination agent powered by OpenClaw.\n\nI orchestrate a team of 9 specialist agents who collaborate to help you:\n\n" +
      (isConnected
        ? "Your wallet is connected. I can see your profile and personalize my responses.\n\n"
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

  // Fetch improvement pipeline data
  useEffect(() => {
    fetch("/api/openclaw/improvements?refresh=1")
      .then((r) => r.json())
      .then((d) => setImprovementData(d))
      .catch(() => {})
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
          const agent = OPENCLAW_CONFIG.agents.find((a) => a.id === id)
          return agent ? agent.name : id
        })
        .join(", ")
      const primaryAgent = OPENCLAW_CONFIG.agents.find((a) => a.id === workflow.route.primaryAgent)

      setMessages((prev) => [
        ...prev,
        {
          id: `routing-${Date.now()}`,
          role: "system",
          content: `${primaryAgent?.name || "Agent"} is handling this with support from ${collaboratorNames}`,
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

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        content: data.response || data.error || "No response received.",
        agentId: workflow.route.primaryAgent,
        collaborators: workflow.route.collaborators,
        routingInfo: workflow.route.reasoning,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, agentMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "system",
          content: "Connection error. Please try again.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, activeAgent, walletAddress])

  const improvementMetrics = improvementData?.metrics ?? { totalSuggested: 0, totalDeployed: 0, totalInProgress: 0, totalApproved: 0 }
  const recentImprovements = improvementData?.improvements.slice(0, 5) ?? []

  return (
    <div className="animate-slide-up space-y-4">
      <AppPageHeader
        leading={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal to-teal-dark">
            <Bot size={20} className="text-white" />
          </div>
        }
        title="AI Concierge"
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {gatewayStatus === "checking" ? (
              <span className="flex items-center gap-1 text-[10px] text-muted">
                <Loader2 size={10} className="animate-spin" /> Connecting...
              </span>
            ) : gatewayStatus === "online" ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-accent">
                <Wifi size={10} /> OpenClaw gateway connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-teal">
                <WifiOff size={10} /> Gateway offline
              </span>
            )}
            {isConnected ? (
              <span className="flex items-center gap-1 text-[10px] text-accent">
                <CheckCircle2 size={8} /> Wallet identity active
              </span>
            ) : null}
          </div>
        }
        actions={
          <button
            type="button"
            onClick={() => setShowImprovements(!showImprovements)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
              showImprovements
                ? "border-accent bg-accent text-white"
                : "border-border text-secondary hover:border-accent/30"
            )}
          >
            <TrendingUp size={12} className="mr-1 inline" />
            Improvements ({improvementMetrics.totalSuggested})
          </button>
        }
      />

      {/* Self-Improvement Panel */}
      {showImprovements && (
        <div className="bg-surface rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-accent" />
            <span className="text-xs font-bold text-primary">
              Self-Improvement Pipeline
            </span>
            <span className="text-[10px] text-muted ml-auto">
              Agents recursively suggest and vote on improvements
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="bg-surface/50 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-primary">{improvementMetrics.totalSuggested}</div>
              <div className="text-[9px] text-muted">Suggested</div>
            </div>
            <div className="bg-surface/50 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-accent">{improvementMetrics.totalDeployed}</div>
              <div className="text-[9px] text-muted">Deployed</div>
            </div>
            <div className="bg-surface/50 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-yellow-600">
                {improvementMetrics.totalInProgress}
              </div>
              <div className="text-[9px] text-muted">In Progress</div>
            </div>
            <div className="bg-surface/50 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-soft-blue">
                {improvementMetrics.totalApproved}
              </div>
              <div className="text-[9px] text-muted">Approved</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {recentImprovements.map((imp) => {
              const agent = OPENCLAW_CONFIG.agents.find((a) => a.id === imp.suggestedBy)
              return (
                <div
                  key={imp.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface/30 border border-border/50"
                >
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      imp.status === "deployed" ? "bg-accent" :
                      imp.status === "in_progress" ? "bg-yellow-400" :
                      imp.status === "approved" ? "bg-soft-blue" :
                      "bg-warm-300"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-primary truncate">{imp.title}</p>
                    <p className="text-[9px] text-muted">
                      {agent?.name} &middot; {imp.category} &middot; {imp.votes} votes
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                      imp.status === "deployed" ? "bg-accent/10 text-accent" :
                      imp.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                      imp.status === "approved" ? "bg-blue-100 text-blue-700" :
                      "bg-warm-100 text-secondary"
                    )}
                  >
                    {imp.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Agent Selector */}
      <div className="flex gap-1.5 flex-wrap">
        {OPENCLAW_CONFIG.agents.map((agent) => {
          const meta = agentMeta[agent.id]
          const Icon = meta?.icon || Bot
          return (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent.id as AgentId)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border",
                activeAgent === agent.id
                  ? "bg-teal/10 text-teal border-teal/20"
                  : "text-muted border-transparent hover:text-primary hover:bg-surface"
              )}
            >
              <Icon size={12} className={activeAgent === agent.id ? meta?.color : ""} />
              {agent.name}
            </button>
          )
        })}
      </div>

      {/* Chat Window — input stays at bottom; messages scroll (mobile keyboard friendly) */}
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
                <div
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "flex-row-reverse" : ""
                  )}
                >
                  {msg.role !== "system" && (
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        msg.role === "agent"
                          ? "bg-teal/10"
                          : "bg-soft-blue/10"
                      )}
                    >
                      {msg.role === "user" ? (
                        <User size={14} className="text-soft-blue" />
                      ) : (
                        <Icon size={14} className={meta?.color || "text-teal"} />
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-xl border px-4 py-3 max-w-[80%]",
                      msg.role === "user"
                        ? "bg-soft-blue/5 border-soft-blue/10"
                        : msg.role === "system"
                        ? "bg-yellow-50 border-yellow-200/50 w-full text-center"
                        : "bg-teal/5 border-teal/10"
                    )}
                  >
                    {msg.role === "system" && (
                      <div className="flex items-center justify-center gap-1.5">
                        <GitBranch size={10} className="text-yellow-600" />
                        <span className="text-[10px] text-yellow-700 font-semibold">{msg.content}</span>
                      </div>
                    )}
                    {msg.role === "agent" && meta && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider", meta.color)}>
                          {meta.label}
                        </span>
                        {gatewayStatus === "online" && (
                          <Zap size={8} className="text-accent" />
                        )}
                        {msg.collaborators && msg.collaborators.length > 0 && (
                          <span className="flex items-center gap-0.5 text-[9px] text-muted ml-1">
                            <Users size={8} />
                            +{msg.collaborators.length} agents
                          </span>
                        )}
                      </div>
                    )}
                    {msg.role !== "system" && (
                      <p className="text-sm text-primary leading-relaxed whitespace-pre-line">
                        {msg.content}
                      </p>
                    )}
                    {msg.role !== "system" && (
                      <span className="text-[9px] text-muted mt-1 block">
                        {msg.timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Routing info */}
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
              <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
                <Bot size={14} className="text-teal" />
              </div>
              <div className="rounded-xl border bg-teal/5 border-teal/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="text-teal animate-spin" />
                  <span className="text-xs text-muted">
                    Agents collaborating...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.label}
                onClick={() => sendQuickPrompt(qp.prompt, qp.agentId)}
                className="px-2.5 py-1 text-[10px] font-semibold text-secondary bg-border/30 hover:bg-teal/10 hover:text-teal border border-border/60 hover:border-teal/20 rounded-lg transition"
              >
                {qp.label}
              </button>
            ))}
          </div>
        )}

        {/* Input — sticky within card; safe-area for notched phones */}
        <div className="sticky bottom-0 z-10 border-t border-border/80 bg-surface/95 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur-sm supports-[backdrop-filter]:bg-surface/85">
          <div className="flex items-end gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={`Message ${agentMeta[activeAgent]?.label || "AI Agent"}...`}
              disabled={isLoading}
              aria-label="Message to AI concierge"
              className="min-h-11 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm placeholder:text-muted transition focus:border-teal/40 focus:outline-none focus:ring-1 focus:ring-teal/20 disabled:opacity-50"
            />
            {messages.length > 1 && (
              <button
                type="button"
                onClick={clearChat}
                disabled={isLoading}
                title="Clear conversation"
                aria-label="Clear conversation"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-border/30 hover:text-secondary disabled:opacity-50"
              >
                <Trash2 size={18} className="shrink-0" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-teal text-white transition hover:bg-teal-dark disabled:opacity-50 sm:min-w-[4.5rem] sm:gap-2 sm:px-4"
            >
              <Send size={18} className="shrink-0 sm:hidden" aria-hidden />
              <span className="hidden text-sm font-semibold sm:inline">Send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Automation Status & Agent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cron Jobs */}
        <div className="bg-surface rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-teal" />
            <span className="text-xs font-bold text-primary">Active Automations</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {OPENCLAW_CONFIG.cronJobs.slice(0, 6).map((job) => {
              const agent = OPENCLAW_CONFIG.agents.find((a) => a.id === job.agentId)
              const meta = agentMeta[job.agentId]
              const Icon = meta?.icon || Bot
              return (
                <div
                  key={job.id}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-surface/50 border border-border/50"
                >
                  <Icon size={12} className={cn("mt-0.5 shrink-0", meta?.color || "text-teal")} />
                  <div>
                    <p className="text-[11px] font-semibold text-primary">{job.description}</p>
                    <p className="text-[9px] text-muted mt-0.5">
                      <Clock size={8} className="inline mr-0.5" />
                      {job.schedule} &middot; {agent?.name}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Inter-Agent Activity */}
        <div className="bg-surface rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch size={14} className="text-teal" />
            <span className="text-xs font-bold text-primary">Agent Collaboration Log</span>
          </div>
          <div className="text-center py-6">
              <Users size={20} className="text-sand mx-auto mb-2" />
              <p className="text-[11px] text-muted">Send a message to see agents collaborate</p>
            </div>
        </div>
      </div>
    </div>
  )
}
