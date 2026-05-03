"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Bell, Bot, Circle, Loader2, MessageSquare, Send, ShieldCheck, Sparkles, Stethoscope, User } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { ChoiceChip, ClinicalField, ClinicalTextarea, FieldsetCard } from "@/components/ui/clinical-forms"
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
  const primaryPhysician = getPhysician(patient?.primary_physician_id)

  const allMessages = useMemo(() => [...snapshot.messages, ...optimisticMessages], [snapshot.messages, optimisticMessages])
  const channels = useMemo(() => Array.from(new Set(allMessages.map((message) => message.channel))), [allMessages])
  const unreadCount = snapshot.messages.filter((message) => !message.read).length
  const agentCount = snapshot.messages.filter((message) => message.sender_type === "agent").length
  const physicianLinkedCount = snapshot.messages.filter((message) => Boolean(message.physician_id)).length

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
                  setOptimisticMessages((prev) =>
                    prev.map((message) => (message.id === agentMsgId ? { ...message, content: accumulated } : message))
                  )
                }
              } catch {
                continue
              }
            }
          }
        }
      } else {
        const data = (await res.json()) as { message?: string; error?: string }
        const reply = data.message || data.error || "No response."
        setOptimisticMessages((prev) => prev.map((message) => (message.id === agentMsgId ? { ...message, content: reply } : message)))
      }
    } catch {
      setSendError("Failed to send. Try again in a moment.")
      setOptimisticMessages((prev) => prev.filter((message) => message.id !== userMsg.id && message.id !== agentMsgId))
    } finally {
      setIsSending(false)
      setStreamingId(null)
    }
  }

  const latestMessage = activeMessages[activeMessages.length - 1]
  const conversationSummary = unreadCount
    ? `${unreadCount} unread message${unreadCount === 1 ? "" : "s"} still need review.`
    : "Everything in this thread has been reviewed."

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Care communications"
        title="Messages"
        description="Read care-team messages with the medical and coverage context nearby, then draft a clear reply without losing the thread."
        meta={
          <>
            <span className="chip">{channels.length || 1} active channel{channels.length === 1 ? "" : "s"}</span>
            <span className="chip">{agentCount} drafted repl{agentCount === 1 ? "y" : "ies"}</span>
            <span className="chip">{physicianLinkedCount} physician-linked note{physicianLinkedCount === 1 ? "" : "s"}</span>
          </>
        }
        actions={
          <div className="surface-muted flex items-start gap-3 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 text-teal shadow-sm">
              <ShieldCheck size={16} />
            </div>
            <div className="max-w-xs">
              <div className="section-title">Communication guardrails</div>
              <p className="mt-2 text-sm leading-6 text-secondary">
                Drafts should stay patient-readable, keep important context visible, and leave the portal thread as the source of truth.
              </p>
            </div>
          </div>
        }
      />

      <section className="surface-card p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-hidden rounded-[28px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_60%,#173B83_100%)] p-4 text-white shadow-[0_18px_38px_rgba(47,107,255,0.14)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/58">Conversation brief</p>
                <h2 className="mt-3 font-serif text-[1.95rem] leading-[0.98] text-white">{conversationSummary}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
                  {latestMessage
                    ? `Last activity was ${formatDate(latestMessage.created_at)} through ${latestMessage.channel}. Use the thread below to respond, then keep the side rail open for care context.`
                    : "Once a patient message arrives, the thread will appear here with channel history and drafting support."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ChoiceChip active={unreadCount > 0} className="!border-white/12 !bg-white/10 !text-white">
                  <Bell size={12} />
                  {unreadCount} unread
                </ChoiceChip>
                <ChoiceChip className="!border-white/12 !bg-white/10 !text-white">
                  <Sparkles size={12} />
                  Portal first
                </ChoiceChip>
              </div>
            </div>
          </div>

          <div className="surface-muted p-4 sm:p-5">
            <div className="section-title">Thread outlook</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <BriefItem label="Patient" value={patient?.full_name || "No patient loaded"} detail={patient?.phone || patient?.email || "Connect or load a patient profile."} />
              <BriefItem label="Primary physician" value={primaryPhysician?.full_name || "Not linked"} detail={primaryPhysician?.specialty || "No physician attached to this record."} />
              <BriefItem label="Latest touch" value={latestMessage ? formatDate(latestMessage.created_at) : "No thread yet"} detail={latestMessage ? `via ${latestMessage.channel}` : "A reply will appear here once the thread starts."} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
        <section className="surface-card overflow-hidden">
          <div className="border-b border-[rgba(82,108,139,0.12)] px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(82,108,139,0.12)] bg-[rgba(47,107,255,0.08)] text-teal">
                  <User size={18} />
                </div>
                <div>
                  <div className="section-title">Patient thread</div>
                  <h2 className="mt-2 text-xl font-semibold text-primary">{patient?.full_name || "My conversation"}</h2>
                  <p className="mt-1 text-sm leading-6 text-secondary">
                    {patient?.phone || "No phone on file"}
                    {patient?.email ? ` · ${patient.email}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterButton active={!channelFilter} onClick={() => setChannelFilter("")}>All channels</FilterButton>
                {channels.map((channel) => (
                  <FilterButton key={channel} active={channelFilter === channel} onClick={() => setChannelFilter(channel)}>
                    {channel}
                  </FilterButton>
                ))}
              </div>
            </div>
          </div>

          <div
            className="max-h-[calc(100vh-24rem)] min-h-[30rem] space-y-4 overflow-y-auto px-5 py-5 sm:px-6"
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
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      {getSenderIcon(message.sender_type)}
                      {message.sender_type === "physician" && physician
                        ? physician.full_name
                        : message.sender_type === "agent"
                          ? "Draft"
                          : message.sender_type === "system"
                            ? "System"
                            : "You"}
                    </span>
                    <span className="text-[11px] normal-case tracking-normal text-secondary">{formatDate(message.created_at)}</span>
                    <span className="text-[11px] normal-case tracking-normal text-secondary">via {message.channel}</span>
                    {!message.read ? <Circle size={6} className="fill-coral text-coral" /> : null}
                  </div>
                  <p className="whitespace-pre-line text-sm leading-7 text-primary">
                    {message.content}
                    {streamingId === message.id ? <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-teal align-middle" /> : null}
                  </p>
                </article>
              )
            })}

            {isSending && !streamingId ? (
              <div className="flex items-center gap-2 pl-1 text-xs text-muted">
                <Loader2 size={12} className="animate-spin text-teal" />
                Drafting a response...
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-[rgba(82,108,139,0.12)] bg-[rgba(255,255,255,0.42)] px-5 py-4 sm:px-6">
            <ClinicalField
              label="Reply to care team"
              hint="Keep the message patient-friendly. Drafting can help, but the portal thread remains the source of truth."
            >
              {sendError ? <p className="mb-3 text-xs text-soft-red">{sendError}</p> : null}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <ClinicalTextarea
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      void sendMessage()
                    }
                  }}
                  placeholder="Summarize next steps, answer a question, or ask for help framing a reply."
                  disabled={isSending}
                  aria-label="Message patient care team"
                  rows={3}
                  className="min-h-[120px] flex-1 resize-none"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={isSending || !newMessage.trim()}
                  className="control-button-primary min-h-[52px] px-5"
                  aria-label="Send message"
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Send reply
                </button>
              </div>
            </ClinicalField>
          </div>
        </section>

        <div className="space-y-4">
          <section className="surface-card p-5">
            <div className="section-title">Clinical context</div>
            <h2 className="mt-3 text-xl font-semibold text-primary">Everything needed to answer well</h2>
            <div className="mt-4 space-y-3">
              <ContextRow icon={MessageSquare} label="Latest message" value={latestMessage?.content.slice(0, 110) || "No messages yet."} />
              <ContextRow icon={Stethoscope} label="Primary physician" value={primaryPhysician ? `${primaryPhysician.full_name} · ${primaryPhysician.specialty}` : "No physician linked yet."} />
              <ContextRow icon={ShieldCheck} label="Coverage" value={patient ? `${patient.insurance_provider} · ${patient.insurance_plan}` : "No insurance context loaded."} />
            </div>
          </section>

          <section className="surface-card p-5">
            <FieldsetCard
              legend="Drafting lane"
              description="Use these when you need a clean patient-facing message without losing the clinical thread."
              className="border-none bg-transparent p-0 shadow-none"
            >
              <div className="space-y-2">
                <AIAction
                  agentId="coordinator"
                  label="Draft reply"
                  prompt="Help me draft a reply to the most recent message in my conversation."
                  context={`Last message: "${allMessages[allMessages.length - 1]?.content.slice(0, 200)}"`}
                  variant="compact"
                />
                <AIAction
                  agentId="triage"
                  label="Summarize thread"
                  prompt="Summarize the key medical topics discussed in my messages and flag anything urgent."
                  context={`Recent messages: ${allMessages.slice(-3).map((message) => message.content.slice(0, 100)).join(" | ")}`}
                  variant="compact"
                />
              </div>
            </FieldsetCard>
          </section>
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
      return <Bot size={14} className="text-teal" />
    case "system":
      return <Bell size={14} className="text-amber-700" />
    default:
      return <MessageSquare size={14} className="text-muted" />
  }
}

function getSenderBg(type: string) {
  switch (type) {
    case "patient":
      return "border-[rgba(59,130,246,0.16)] bg-[rgba(59,130,246,0.07)]"
    case "physician":
      return "border-[rgba(37,99,235,0.16)] bg-[rgba(37,99,235,0.06)]"
    case "agent":
      return "border-[rgba(8,24,46,0.16)] bg-[rgba(47,107,255,0.06)]"
    case "system":
      return "border-amber-200 bg-amber-50/70"
    default:
      return "border-border bg-border/20"
  }
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
        active
          ? "border-teal bg-teal text-white"
          : "border-[rgba(82,108,139,0.12)] bg-white/86 text-secondary hover:border-teal/30 hover:text-primary"
      )}
    >
      {children}
    </button>
  )
}

function BriefItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-[rgba(82,108,139,0.12)] bg-white/86 px-4 py-3 shadow-sm">
      <div className="section-title">{label}</div>
      <div className="mt-2 text-sm font-semibold text-primary">{value}</div>
      <p className="mt-1 text-xs leading-5 text-secondary">{detail}</p>
    </div>
  )
}

function ContextRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="surface-muted flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[rgba(82,108,139,0.12)] bg-white/88 text-teal shadow-sm">
        <Icon size={15} />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">{label}</div>
        <div className="mt-1 text-sm leading-6 text-primary">{value}</div>
      </div>
    </div>
  )
}
