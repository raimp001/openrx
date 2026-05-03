"use client"

import { cn } from "@/lib/utils"
import { Bot, Loader2, X, Zap, Cpu, Copy, Check } from "lucide-react"
import { useState, useCallback } from "react"
import type { AgentId } from "@/lib/openclaw/config"

interface AIActionProps {
  agentId: AgentId
  label: string
  prompt: string
  context?: string
  variant?: "button" | "inline" | "compact"
  className?: string
}

const AGENT_NAMES: Record<string, string> = {
  coordinator: "Atlas",
  triage: "Nova",
  scheduling: "Cal",
  billing: "Vera",
  rx: "Maya",
  "prior-auth": "Rex",
  wellness: "Ivy",
  onboarding: "Sage",
  devops: "Bolt",
  general: "Atlas",
}

export default function AIAction({
  agentId,
  label,
  prompt,
  context,
  variant = "button",
  className,
}: AIActionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState("")
  const [model, setModel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const runAction = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setResponse("")
    setModel(null)
    setIsOpen(true)

    const fullPrompt = context ? `${prompt}\n\nContext: ${context}` : prompt

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: fullPrompt }],
          agentType: agentId,
          stream: true,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" })) as { error?: string }
        setError(err.error ?? "Request failed")
        return
      }

      // SSE streaming response
      if (res.headers.get("Content-Type")?.includes("text/event-stream")) {
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
                  setResponse(accumulated)
                } else if (data.type === "done") {
                  if (data.model) setModel(data.model)
                }
              } catch { /* malformed SSE line */ }
            }
          }
        }
      } else {
        // JSON fallback
        const data = await res.json() as { message?: string; model?: string; error?: string }
        if (data.error) {
          setError(data.error)
        } else {
          setResponse(data.message ?? "No response.")
          if (data.model) setModel(data.model)
        }
      }
    } catch {
      setError("Connection error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }, [agentId, prompt, context])

  const handleCopy = useCallback(async () => {
    if (!response) return
    await navigator.clipboard.writeText(response)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [response])

  if (variant === "compact") {
    return (
      <>
        <button
          onClick={runAction}
          disabled={isLoading}
          aria-label={label}
          className={cn(
            "flex items-center gap-1 text-[10px] font-bold text-teal hover:text-teal-dark transition disabled:opacity-50",
            className
          )}
        >
          {isLoading ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
          {label}
        </button>

        {isOpen && (
          <AIResponsePanel
            agentId={agentId}
            response={response}
            error={error}
            isLoading={isLoading}
            model={model}
            copied={copied}
            onCopy={handleCopy}
            onClose={() => setIsOpen(false)}
          />
        )}
      </>
    )
  }

  if (variant === "inline") {
    return (
      <div className={className}>
        <button
          onClick={runAction}
          disabled={isLoading}
          aria-label={label}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent/15 bg-accent/7 px-3 py-1.5 text-[10px] font-bold text-accent transition hover:bg-accent/10 disabled:opacity-50"
        >
          {isLoading ? <Loader2 size={10} className="animate-spin" /> : <Bot size={10} />}
          {label}
        </button>

        {isOpen && (response || error) && (
          <div className="mt-2 animate-fade-in rounded-[18px] border border-[rgba(82,108,139,0.14)] bg-white/78 p-3 shadow-[0_14px_34px_rgba(8,24,46,0.06)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-accent">
                {AGENT_NAMES[agentId] ?? "AI"} · {model?.includes("claude") ? "Claude" : "AI"}
              </span>
              <button onClick={() => setIsOpen(false)} className="text-muted hover:text-secondary transition">
                <X size={10} />
              </button>
            </div>
            {response && (
              <p className="text-xs text-primary leading-relaxed whitespace-pre-line">
                {response}
                {isLoading && <span className="inline-block w-0.5 h-3 bg-teal ml-0.5 animate-pulse align-middle" />}
              </p>
            )}
            {error && <p className="text-[10px] text-soft-red">{error}</p>}
          </div>
        )}
      </div>
    )
  }

  // Default "button" variant
  return (
    <>
      <button
        onClick={runAction}
        disabled={isLoading}
        aria-label={label}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-accent/15 bg-accent/7 px-3.5 py-2 text-xs font-semibold text-accent transition hover:bg-accent/10 disabled:opacity-50",
          className
        )}
      >
        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
        {label}
      </button>

      {isOpen && (
        <AIResponsePanel
          agentId={agentId}
          response={response}
          error={error}
          isLoading={isLoading}
          model={model}
          copied={copied}
          onCopy={handleCopy}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

function AIResponsePanel({
  agentId,
  response,
  error,
  isLoading,
  model,
  copied,
  onCopy,
  onClose,
}: {
  agentId: string
  response: string
  error: string | null
  isLoading: boolean
  model: string | null
  copied: boolean
  onCopy: () => void
  onClose: () => void
}) {
  const agentName = AGENT_NAMES[agentId] ?? "AI"
  const modelLabel = model
    ? model.includes("claude-opus") ? "Claude Opus 4.6"
    : model.includes("claude-sonnet") ? "Claude Sonnet 4.6"
    : model.includes("gpt") ? "GPT-4o"
    : model
    : null

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-primary/24 p-4 backdrop-blur-sm">
      <div className="surface-card flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-[30px] bg-[rgba(255,255,255,0.94)]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[rgba(82,108,139,0.12)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-accent" />
            <span className="text-sm font-bold text-primary">{agentName}</span>
            {modelLabel ? (
              <span className="flex items-center gap-0.5 rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-bold text-accent">
                <Cpu size={7} /> {modelLabel}
              </span>
            ) : (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-bold text-accent">
                AI AGENT
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {response && !isLoading && (
              <button
                onClick={onCopy}
                className="flex items-center gap-1 rounded-full bg-white/74 px-2.5 py-1 text-[10px] font-semibold text-muted transition hover:text-primary"
              >
                {copied ? <Check size={10} className="text-accent" /> : <Copy size={10} />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close AI response"
              className="rounded-full p-1.5 transition hover:bg-white"
            >
              <X size={16} className="text-muted" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {isLoading && !response && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <Loader2 size={20} className="text-teal animate-spin" />
              <span className="text-sm text-muted">
                {agentName} is thinking...
              </span>
            </div>
          )}
          {response && (
            <p className="text-sm text-primary leading-relaxed whitespace-pre-line">
              {response}
              {isLoading && (
                <span className="inline-block w-1 h-3.5 bg-teal ml-0.5 animate-pulse align-middle" />
              )}
            </p>
          )}
          {error && (
            <div className="p-3 bg-soft-red/5 rounded-xl border border-soft-red/10">
              <p className="text-sm text-soft-red">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (response || error) && (
          <div className="flex shrink-0 items-center justify-between border-t border-[rgba(82,108,139,0.12)] px-5 py-3">
            <p className="text-[10px] text-muted">
              {modelLabel ? `Powered by ${modelLabel}` : "Powered by OpenRx AI"}
            </p>
            <button
              onClick={onClose}
              className="rounded-full bg-white/74 px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-white hover:text-primary"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
