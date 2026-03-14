"use client"

import { CHAT_DEMOS } from "@/lib/seed-data"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"
import { cn } from "@/lib/utils"
import {
  getRecentMessages as getOrchestratorMessages,
  getActiveTasks,
} from "@/lib/openclaw/orchestrator"
import {
  getImprovements,
  getImprovementMetrics,
  runImprovementCycle,
} from "@/lib/openclaw/self-improve"
import { useWalletIdentity } from "@/lib/wallet-context"
import {
  Bot,
  Calendar,
  Receipt,
  ShieldCheck,
  Moon,
  Pill,
  Send,
  Sparkles,
  User,
  Stethoscope,
  Loader2,
  Zap,
  Clock,
  ArrowRight,
  Users,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  GitBranch,
  Trash2,
  Cpu,
} from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"

type AgentId = typeof OPENCLAW_CONFIG.agents[number]["id"]

const QUICK_PROMPTS = [
  { label: "Next appointment", prompt: "When is my next appointment and what should I bring?", agentId: "scheduling" as AgentId },
  { label: "Medication refills", prompt: "Which of my medications need refills soon?", agentId: "rx" as AgentId },
  { label: "Bill questions", prompt: "Do I have any unpaid bills or denied claims I should address?", agentId: "billing" as AgentId },
  { label: "Prior auth status", prompt: "What is the status of my pending prior authorizations?", agentId: "prior-auth" as AgentId },
  { label: "Lab results", prompt: "Can you summarize my recent lab results and flag anything abnormal?", agentId: "coordinator" as AgentId },
  { label: "Wellness tips", prompt: "Based on my health history, what preventive care steps should I take this year?", agentId: "wellness" as AgentId },
]

interface ChatMessage {
  id: string
  role: "user" | "agent" | "system"
  content: string
  agentId?: string
  collaborators?: string[]
  routingInfo?: string
  timestamp: Date
  streaming?: boolean
  model?: string
}

const agentMeta: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  onboarding: { label: "Sage (Onboarding)", icon: Bot, color: "text-terra" },
  coordinator: { label: "Atlas (Coordinator)", icon: Bot, color: "text-terra" },
  triage: { label: "Nova (Triage)", icon: Stethoscope, color: "text-soft-red" },
  scheduling: { label: "Cal (Scheduler)", icon: Calendar, color: "text-soft-blue" },
  billing: { label: "Vera (Billing)", icon: Receipt, color: "text-accent" },
  rx: { label: "Maya (Rx)", icon: Pill, color: "text-yellow-600" },
  "prior-auth": { label: "Rex (PA)", icon: ShieldCheck, color: "text-terra" },
  wellness: { label: "Ivy (Wellness)", icon: Stethoscope, color: "text-accent" },
  devops: { label: "Bolt (DevOps)", icon: Bot, color: "text-warm-600" },
}

const iconMap: Record<string, typeof Calendar> = {
  Calendar,
  Receipt,
  Shield: ShieldCheck,
  Moon,
  Pill,
}

const WELCOME_CONTENT =
  "Welcome to OpenRx AI — I'm Atlas, your healthcare coordination agent powered by Claude.\n\nI orchestrate a team of specialist agents who can help with prior authorizations, medications, billing, scheduling, and more.\n\nHow can I help you today?"

export default function ChatPage() {
  const { isConnected, walletAddress } = useWalletIdentity()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      content: WELCOME_CONTENT,
      agentId: "coordinator",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [usingClaude, setUsingClaude] = useState(false)
  const [activeAgent, setActiveAgent] = useState<AgentId>("coordinator")
  const [showDemos, setShowDemos] = useState(false)
  const [activeDemo, setActiveDemo] = useState<string | null>(null)
  const [showImprovements, setShowImprovements] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const clearChat = useCallback(() => {
    setMessages([{
      id: "welcome",
      role: "agent",
      content: WELCOME_CONTENT,
      agentId: "coordinator",
      timestamp: new Date(),
    }])
    setActiveDemo(null)
    inputRef.current?.focus()
  }, [])

  const sendQuickPrompt = useCallback((prompt: string, agentId: AgentId) => {
    setInput(prompt)
    setActiveAgent(agentId)
    inputRef.current?.focus()
  }, [])

  useEffect(() => { runImprovementCycle() }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

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

    // Placeholder for streaming response
    const agentMsgId = `agent-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: agentMsgId,
        role: "agent",
        content: "",
        agentId: activeAgent,
        timestamp: new Date(),
        streaming: true,
      },
    ])

    try {
      const conversationHistory = messages
        .filter((m) => m.role !== "system" && m.id !== "welcome")
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }))

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...conversationHistory, { role: "user", content: userMsg.content }],
          agentType: activeAgent,
          patientContext: { walletAddress: walletAddress ?? undefined },
          stream: true,
        }),
      })

      // Handle SSE streaming
      if (res.headers.get("Content-Type")?.includes("text/event-stream")) {
        setUsingClaude(true)
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let accumulated = ""

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value)
            const lines = chunk.split("\n")
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue
              try {
                const data = JSON.parse(line.slice(6)) as { type: string; delta?: string; model?: string }
                if (data.type === "text_delta" && data.delta) {
                  accumulated += data.delta
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? { ...m, content: accumulated, streaming: true }
                        : m
                    )
                  )
                } else if (data.type === "done") {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? { ...m, content: accumulated, streaming: false, model: data.model }
                        : m
                    )
                  )
                }
              } catch { /* malformed SSE line */ }
            }
          }
        }
      } else {
        // Non-streaming JSON fallback
        const data = await res.json() as { message: string; model?: string }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? { ...m, content: data.message || "No response.", streaming: false, model: data.model }
              : m
          )
        )
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? { ...m, content: "Connection error. Please try again.", streaming: false }
            : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, activeAgent, walletAddress, messages])

  const loadDemo = (demoId: string) => {
    const demo = CHAT_DEMOS.find((d) => d.id === demoId)
    if (!demo) return
    setActiveDemo(demoId)
    setMessages(demo.messages.map((m, i) => ({
      id: `demo-${demoId}-${i}`,
      role: m.role === "agent" ? ("agent" as const) : ("user" as const),
      content: m.content,
      agentId: m.role === "agent" ? "coordinator" : undefined,
      timestamp: new Date(Date.now() - (demo.messages.length - i) * 60000),
    })))
    setShowDemos(false)
  }

  const improvementMetrics = getImprovementMetrics()
  const recentImprovements = getImprovements().slice(0, 5)
  const orchestratorMessages = getOrchestratorMessages(10)
  const activeTasks = getActiveTasks()

  return (
    <div className="animate-slide-up space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-terra to-terra-dark flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-serif text-warm-800">AI Agent</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {usingClaude ? (
                <span className="flex items-center gap-1 text-[10px] text-accent font-semibold">
                  <Cpu size={9} /> Claude Sonnet 4.6
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-terra font-semibold">
                  <Zap size={9} /> Demo Mode
                </span>
              )}
              {isConnected && (
                <span className="flex items-center gap-1 text-[10px] text-accent">
                  <CheckCircle2 size={8} /> Wallet Identity Active
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImprovements(!showImprovements)}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg border transition",
              showImprovements
                ? "bg-accent text-white border-accent"
                : "text-warm-600 border-sand hover:border-accent/30"
            )}
          >
            <TrendingUp size={12} className="inline mr-1" />
            Improvements ({improvementMetrics.totalSuggested})
          </button>
          <button
            onClick={() => setShowDemos(!showDemos)}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg border transition",
              showDemos
                ? "bg-terra text-white border-terra"
                : "text-warm-600 border-sand hover:border-terra/30"
            )}
          >
            <Sparkles size={12} className="inline mr-1" />
            Demo Scenarios
          </button>
        </div>
      </div>

      {/* Self-Improvement Panel */}
      {showImprovements && (
        <div className="bg-pampas rounded-2xl border border-sand p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-accent" />
            <span className="text-xs font-bold text-warm-800">Self-Improvement Pipeline</span>
            <span className="text-[10px] text-warm-500 ml-auto">Agents recursively suggest and vote on improvements</span>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-3">
            {[
              { label: "Suggested", value: improvementMetrics.totalSuggested, color: "text-warm-800" },
              { label: "Deployed", value: improvementMetrics.totalDeployed, color: "text-accent" },
              { label: "In Progress", value: getImprovements({ status: "in_progress" }).length, color: "text-yellow-600" },
              { label: "Approved", value: getImprovements({ status: "approved" }).length, color: "text-soft-blue" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-cream/50 rounded-lg p-2.5 text-center">
                <div className={cn("text-lg font-bold", color)}>{value}</div>
                <div className="text-[9px] text-warm-500">{label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {recentImprovements.map((imp) => {
              const agent = OPENCLAW_CONFIG.agents.find((a) => a.id === imp.suggestedBy)
              return (
                <div key={imp.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-cream/30 border border-sand/50">
                  <div className={cn("w-1.5 h-1.5 rounded-full",
                    imp.status === "deployed" ? "bg-accent" :
                    imp.status === "in_progress" ? "bg-yellow-400" :
                    imp.status === "approved" ? "bg-soft-blue" : "bg-warm-300"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-warm-800 truncate">{imp.title}</p>
                    <p className="text-[9px] text-cloudy">{agent?.name} &middot; {imp.category} &middot; {imp.votes.length} votes</p>
                  </div>
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                    imp.status === "deployed" ? "bg-accent/10 text-accent" :
                    imp.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                    imp.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-warm-100 text-warm-600"
                  )}>{imp.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Demo Scenarios */}
      {showDemos && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {CHAT_DEMOS.map((d) => {
            const Icon = iconMap[d.icon] || Bot
            return (
              <button key={d.id} onClick={() => loadDemo(d.id)}
                className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border",
                  activeDemo === d.id ? "bg-terra text-white border-terra" : "bg-pampas text-warm-600 border-sand hover:border-terra/30"
                )}
              >
                <Icon size={14} /> {d.title}
              </button>
            )
          })}
        </div>
      )}

      {/* Agent Selector */}
      <div className="flex gap-1.5 flex-wrap">
        {OPENCLAW_CONFIG.agents.map((agent) => {
          const meta = agentMeta[agent.id]
          const Icon = meta?.icon || Bot
          return (
            <button key={agent.id} onClick={() => setActiveAgent(agent.id as AgentId)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border",
                activeAgent === agent.id
                  ? "bg-terra/10 text-terra border-terra/20"
                  : "text-warm-500 border-transparent hover:text-warm-700 hover:bg-cream"
              )}
            >
              <Icon size={12} className={activeAgent === agent.id ? meta?.color : ""} />
              {agent.name}
            </button>
          )
        })}
      </div>

      {/* Chat Window */}
      <div className="bg-pampas rounded-2xl border border-sand overflow-hidden flex flex-col h-[calc(100vh-420px)] min-h-[400px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => {
            const meta = msg.agentId ? agentMeta[msg.agentId] : null
            const Icon = meta?.icon || Bot

            return (
              <div key={msg.id}>
                <div className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
                  {msg.role !== "system" && (
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      msg.role === "agent" ? "bg-terra/10" : "bg-soft-blue/10"
                    )}>
                      {msg.role === "user" ? (
                        <User size={14} className="text-soft-blue" />
                      ) : (
                        <Icon size={14} className={meta?.color || "text-terra"} />
                      )}
                    </div>
                  )}
                  <div className={cn(
                    "rounded-xl border px-4 py-3 max-w-[80%]",
                    msg.role === "user" ? "bg-soft-blue/5 border-soft-blue/10" :
                    msg.role === "system" ? "bg-yellow-50 border-yellow-200/50 w-full text-center" :
                    "bg-terra/5 border-terra/10"
                  )}>
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
                        {msg.model && (
                          <span className="flex items-center gap-0.5 text-[9px] text-accent font-semibold">
                            <Cpu size={7} /> {msg.model.includes("claude") ? "Claude" : msg.model}
                          </span>
                        )}
                        {msg.collaborators && msg.collaborators.length > 0 && (
                          <span className="flex items-center gap-0.5 text-[9px] text-warm-400 ml-1">
                            <Users size={8} /> +{msg.collaborators.length} agents
                          </span>
                        )}
                      </div>
                    )}
                    {msg.role !== "system" && (
                      <p className="text-sm text-warm-700 leading-relaxed whitespace-pre-line">
                        {msg.content}
                        {msg.streaming && (
                          <span className="inline-block w-1 h-3.5 bg-terra ml-0.5 animate-pulse align-middle" />
                        )}
                      </p>
                    )}
                    {msg.role !== "system" && !msg.streaming && (
                      <span className="text-[9px] text-cloudy mt-1 block">
                        {msg.timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>

                {msg.routingInfo && (
                  <div className="ml-11 mt-1 flex items-center gap-1.5">
                    <AlertCircle size={8} className="text-warm-400" />
                    <span className="text-[9px] text-warm-400 italic">{msg.routingInfo}</span>
                  </div>
                )}
              </div>
            )
          })}

          {isLoading && messages[messages.length - 1]?.content === "" && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-terra/10 flex items-center justify-center">
                <Bot size={14} className="text-terra" />
              </div>
              <div className="rounded-xl border bg-terra/5 border-terra/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="text-terra animate-spin" />
                  <span className="text-xs text-warm-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <div className="px-5 py-3 border-t border-sand/50 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((qp) => (
              <button key={qp.label} onClick={() => sendQuickPrompt(qp.prompt, qp.agentId)}
                className="px-2.5 py-1 text-[10px] font-semibold text-warm-600 bg-sand/30 hover:bg-terra/10 hover:text-terra border border-sand/60 hover:border-terra/20 rounded-lg transition"
              >
                {qp.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-5 py-3.5 border-t border-sand bg-cream/30">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={`Message ${agentMeta[activeAgent]?.label || "AI Agent"}...`}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-sand bg-pampas text-sm placeholder:text-cloudy focus:outline-none focus:border-terra/40 focus:ring-1 focus:ring-terra/20 transition disabled:opacity-50"
            />
            {messages.length > 1 && (
              <button onClick={clearChat} disabled={isLoading} title="Clear conversation"
                className="px-3 py-2.5 text-cloudy hover:text-warm-600 rounded-xl hover:bg-sand/30 transition disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button onClick={sendMessage} disabled={isLoading || !input.trim()}
              className="px-4 py-2.5 bg-terra text-white rounded-xl hover:bg-terra-dark transition flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </div>
          <p className="text-[10px] text-cloudy mt-1.5 text-center">
            Powered by Claude Sonnet 4.6 &middot; Set <span className="font-mono">ANTHROPIC_API_KEY</span> to enable
          </p>
        </div>
      </div>

      {/* Automation Status & Agent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cron Jobs */}
        <div className="bg-pampas rounded-2xl border border-sand p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-terra" />
            <span className="text-xs font-bold text-warm-800">Active Automations</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {OPENCLAW_CONFIG.cronJobs.slice(0, 6).map((job) => {
              const agent = OPENCLAW_CONFIG.agents.find((a) => a.id === job.agentId)
              const meta = agentMeta[job.agentId]
              const Icon = meta?.icon || Bot
              return (
                <div key={job.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-cream/50 border border-sand/50">
                  <Icon size={12} className={cn("mt-0.5 shrink-0", meta?.color || "text-terra")} />
                  <div>
                    <p className="text-[11px] font-semibold text-warm-800">{job.description}</p>
                    <p className="text-[9px] text-cloudy mt-0.5">
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
        <div className="bg-pampas rounded-2xl border border-sand p-4">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch size={14} className="text-terra" />
            <span className="text-xs font-bold text-warm-800">Agent Collaboration Log</span>
          </div>
          {orchestratorMessages.length > 0 ? (
            <div className="space-y-1.5">
              {orchestratorMessages.slice(0, 6).map((msg) => {
                const fromAgent = OPENCLAW_CONFIG.agents.find((a) => a.id === msg.fromAgent)
                const toAgent = msg.toAgent === "*" ? "All" : OPENCLAW_CONFIG.agents.find((a) => a.id === msg.toAgent)?.name || msg.toAgent
                return (
                  <div key={msg.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-cream/50 border border-sand/50">
                    <ArrowRight size={10} className="text-terra shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-warm-800 truncate">
                        <span className="font-semibold">{fromAgent?.name}</span> → <span className="font-semibold">{toAgent}</span>
                      </p>
                      <p className="text-[9px] text-cloudy truncate">{msg.content}</p>
                    </div>
                    <span className={cn("text-[8px] font-bold px-1 py-0.5 rounded",
                      msg.status === "delivered" ? "bg-accent/10 text-accent" : "bg-warm-100 text-warm-500"
                    )}>{msg.status}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <Users size={20} className="text-sand mx-auto mb-2" />
              <p className="text-[11px] text-warm-500">Send a message to see agents collaborate</p>
            </div>
          )}
          {activeTasks.length > 0 && (
            <div className="mt-2 pt-2 border-t border-sand/50">
              <p className="text-[9px] font-bold text-warm-500 uppercase tracking-wider mb-1">Active Tasks</p>
              {activeTasks.slice(0, 3).map((task) => {
                const agent = OPENCLAW_CONFIG.agents.find((a) => a.id === task.assignedTo)
                return (
                  <div key={task.id} className="flex items-center gap-2 text-[10px] text-warm-600 py-0.5">
                    <Loader2 size={8} className="text-terra animate-spin" />
                    <span className="font-semibold">{agent?.name}</span>: {task.description.slice(0, 60)}...
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
