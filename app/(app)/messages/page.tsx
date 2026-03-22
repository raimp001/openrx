"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Bell, Bot, Circle, Cpu, Loader2, MessageSquare, Send, Stethoscope, User } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsMetricCard, OpsPanel, OpsTabButton } from "@/components/ui/ops-primitives"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn, formatDate } from "@/lib/utils"

type OptimisticMessage = {
  id: string
  patient_id: string
  physician_id: null
  sender_type: "patient" | "agent"
  content: string
  channel: "portal"
  read: boolean
  created_at: string
}

export default function MessagesPage() {
  const [channelFilter, setChannelFilter] = useState("")
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([])
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { snapshot, getPhysician } = useLiveSnapshot()
  const patient = snapshot.patient

  const allMessages = useMemo(() => [...snapshot.messages, ...optimisticMessages], [snapshot.messages, optimisticMessages])
  const channels = useMemo(() => Array.from(new Set(allMessages.map((message) => message.channel))), [allMessages])
  const unreadCount = snapshot.messages.filter((message) => !message.read).length
  const agentCount = snapshot.messages.filter((message) => message.sender_type === "agent").length

  const activeMessages = useMemo(() => {
    let messages = [...allMessages]
    if (channelFilter) messages = messages.filter((message) => message.channel === channelFilter)
    return messages.sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
  }, [allMessages, channelFilter])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeMessages.length])

  const sendMessage = async () => {
    const text = newMessage.trim()
    if (!text || isSending) return

    setSendError("")
    setIsSending(true)
    setNewMessage("")

    const userMsg: OptimisticMessage = {
      id: `local-user-${Date.now()}`,
      patient_id: patient?.id ?? "",
      physician_id: null,
      sender_type: "patient",
      content: text,
      channel: "portal",
      read: true,
      created_at: new Date().toISOString(),
    }

    const agentMsgId = `local-agent-${Date.now()}`
    const agentMsg: OptimisticMessage = {
      id: agentMsgId,
      patient_id: patient?.id ?? "",
      physician_id: null,
      sender_type: "agent",
      content: "",
      channel: "portal",
      read: true,
      created_at: new Date().toISOString(),
    }

    setOptimisticMessages((prev) => [...prev, userMsg, agentMsg])
    setStreamingId(agentMsgId)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          agentType: "coordinator",
          stream: true,
        }),
      })

      if (res.headers.get("Content-Type")?.includes("text/event-stream")) {
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let accumulated = ""
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const lines = decoder.decode(value).split("\n")
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue
              try {
                const data = JSON.parse(line.slice(6)) as { type: string; delta?: string }
                if (data.type === "text_delta" && data.delta) {
                  accumulated += data.delta
                  setOptimisticMessages((prev) => prev.map((message) => message.id === agentMsgId ? { ...message, content: accumulated } : message))
                }
              } catch {
                continue
              }
            }
          }
        }
      } else {
        const data = await res.json() as { message?: string; error?: string }
        const reply = data.message || data.error || "No response."
        setOptimisticMessages((prev) => prev.map((message) => message.id === agentMsgId ? { ...message, content: reply } : message))
      }
    } catch {
      setSendError("Failed to send — please try again.")
      setOptimisticMessages((prev) => prev.filter((message) => message.id !== userMsg.id && message.id !== agentMsgId))
    } finally {
      setIsSending(false)
      setStreamingId(null)
    }
  }

  const latestMessage = activeMessages[activeMessages.length - 1]

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Patient communications"
        title="Messaging hub"
        description="Every portal thread, AI reply, and channel handoff in one place. The main pane stays focused on conversation, while the side rail keeps triage context visible."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <OpsBadge tone={unreadCount ? "gold" : "accent"}>{unreadCount} unread</OpsBadge>
            <OpsBadge tone="blue">{channels.length || 1} channel{channels.length === 1 ? "" : "s"}</OpsBadge>
            <OpsBadge tone="terra">{allMessages.length} total messages</OpsBadge>
          </div>
        }
        actions={
          <div className="flex items-center gap-2 rounded-2xl border border-terra/10 bg-terra/5 px-3 py-2">
            <Cpu size={12} className="text-terra" />
            <span className="text-[11px] font-bold text-terra">Claude multi-channel</span>
            <span className="text-[10px] text-warm-500">WhatsApp · SMS · Telegram · Portal</span>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsMetricCard label="Unread" value={`${unreadCount}`} detail="Threads the patient has not opened yet." icon={Bell} tone={unreadCount ? "gold" : "accent"} />
        <OpsMetricCard label="AI replies" value={`${agentCount}`} detail="Messages authored by Atlas or specialist agents." icon={Bot} tone="terra" />
        <OpsMetricCard label="Channels" value={`${channels.length || 1}`} detail="Where the conversation is currently active." icon={MessageSquare} tone="blue" />
        <OpsMetricCard label="Latest touch" value={latestMessage ? formatDate(latestMessage.created_at) : "No messages"} detail={latestMessage ? `Last via ${latestMessage.channel}` : "A new thread starts once a message arrives."} icon={User} tone="accent" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
        <OpsPanel
          eyebrow="Conversation"
          title="Patient thread"
          description="Filters stay visible at the top, the message stream scrolls independently, and the composer remains anchored for mobile keyboards."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <OpsTabButton active={!channelFilter} onClick={() => setChannelFilter("")}>All</OpsTabButton>
              {channels.map((channel) => (
                <OpsTabButton key={channel} active={channelFilter === channel} onClick={() => setChannelFilter(channel)}>
                  {channel}
                </OpsTabButton>
              ))}
            </div>
          }
          className="overflow-hidden"
        >
          <div className="surface-muted overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand/70 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-terra/10 to-accent/10 text-terra">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-warm-800">My conversation</h3>
                  <p className="text-[11px] text-cloudy">{patient?.phone || "No phone"} · {patient?.email || "No email"}</p>
                </div>
              </div>
              <OpsBadge tone={channelFilter ? "terra" : "blue"}>{channelFilter || "all channels"}</OpsBadge>
            </div>

            <div
              className="max-h-[calc(100vh-22rem)] min-h-[26rem] space-y-3 overflow-y-auto px-4 py-4"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-label="Patient messages"
            >
              {activeMessages.map((message) => {
                const physician = message.physician_id ? getPhysician(message.physician_id) : null
                const isPatient = message.sender_type === "patient"
                return (
                  <article
                    key={message.id}
                    className={cn(
                      "max-w-[88%] rounded-[24px] border px-4 py-3 shadow-sm",
                      getSenderBg(message.sender_type),
                      isPatient ? "ml-auto" : ""
                    )}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-warm-500">
                      <span className="inline-flex items-center gap-1.5">
                        {getSenderIcon(message.sender_type)}
                        {message.sender_type === "physician" && physician
                          ? physician.full_name
                          : message.sender_type === "agent"
                          ? "Atlas"
                          : message.sender_type === "system"
                          ? "System"
                          : "Me"}
                      </span>
                      <span className="text-cloudy normal-case tracking-normal">{formatDate(message.created_at)}</span>
                      <span className="text-cloudy normal-case tracking-normal">via {message.channel}</span>
                      {!message.read ? <Circle size={6} className="fill-terra text-terra" /> : null}
                    </div>
                    <p className="whitespace-pre-line text-sm leading-6 text-warm-700">
                      {message.content}
                      {streamingId === message.id ? <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-terra align-middle" /> : null}
                    </p>
                  </article>
                )
              })}

              {isSending && !streamingId ? (
                <div className="flex items-center gap-2 pl-1 text-xs text-warm-500">
                  <Loader2 size={12} className="animate-spin text-terra" />
                  Atlas is drafting a response...
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <div className="sticky bottom-0 border-t border-sand/70 bg-cream/95 px-4 py-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
              {sendError ? <p className="mb-2 text-xs text-soft-red">{sendError}</p> : null}
              <div className="flex items-end gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && sendMessage()}
                  placeholder="Type a message..."
                  disabled={isSending}
                  aria-label="Message patient care team"
                  className="min-h-11 flex-1 rounded-xl border border-sand bg-white/85 px-4 py-2.5 text-sm text-warm-800 placeholder:text-cloudy focus:border-terra/40 focus:outline-none focus:ring-1 focus:ring-terra/20 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={isSending || !newMessage.trim()}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-terra px-4 text-white transition hover:bg-terra-dark disabled:opacity-50"
                  aria-label="Send message"
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </div>
        </OpsPanel>

        <div className="space-y-4">
          <OpsPanel eyebrow="Quick actions" title="AI drafting lane" description="Shortcuts for the most common help requests without leaving the conversation.">
            <div className="space-y-2">
              <AIAction
                agentId="coordinator"
                label="AI Draft Reply"
                prompt="Help me draft a reply to the most recent message in my conversation."
                context={`Last message: "${allMessages[allMessages.length - 1]?.content.slice(0, 200)}"`}
                variant="compact"
              />
              <AIAction
                agentId="triage"
                label="Triage Summary"
                prompt="Summarize the key medical topics discussed in my messages and flag anything urgent."
                context={`Recent messages: ${allMessages.slice(-3).map((message) => message.content.slice(0, 100)).join(" | ")}`}
                variant="compact"
              />
            </div>
          </OpsPanel>

          <OpsPanel eyebrow="Context" title="Thread health" description="A compact read on who is talking, where they are talking, and what to expect next.">
            <div className="space-y-3">
              <ContextRow icon={User} label="Latest message" value={latestMessage?.content.slice(0, 96) || "No messages yet."} />
              <ContextRow icon={Stethoscope} label="Physician-linked notes" value={`${snapshot.messages.filter((message) => Boolean(message.physician_id)).length} message${snapshot.messages.filter((message) => Boolean(message.physician_id)).length === 1 ? "" : "s"}`} />
              <ContextRow icon={MessageSquare} label="Channels in use" value={channels.length ? channels.join(", ") : "Portal"} />
            </div>
          </OpsPanel>
        </div>
      </div>
    </div>
  )
}

function getSenderIcon(type: string) {
  switch (type) {
    case "patient":
      return <User size={14} className="text-soft-blue" />
    case "physician":
      return <Stethoscope size={14} className="text-accent" />
    case "agent":
      return <Bot size={14} className="text-terra" />
    case "system":
      return <Bell size={14} className="text-yellow-600" />
    default:
      return <MessageSquare size={14} className="text-cloudy" />
  }
}

function getSenderBg(type: string) {
  switch (type) {
    case "patient":
      return "border-soft-blue/10 bg-soft-blue/5"
    case "physician":
      return "border-accent/10 bg-accent/5"
    case "agent":
      return "border-terra/10 bg-terra/5"
    case "system":
      return "border-yellow-700/30 bg-yellow-900/20"
    default:
      return "border-sand bg-sand/20"
  }
}

function ContextRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="surface-muted flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-terra shadow-sm">
        <Icon size={15} />
      </div>
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-cloudy/80">{label}</div>
        <div className="mt-1 text-sm leading-6 text-warm-700">{value}</div>
      </div>
    </div>
  )
}
