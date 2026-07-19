"use client"

import { ArrowUp, FileCheck2, Search, ShieldCheck, Stethoscope } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"

const commandModes = [
  {
    id: "screening",
    label: "Screening",
    topic: "screening",
    icon: FileCheck2,
    placeholder: "Tell us your age, screening history, and what you want to check...",
  },
  {
    id: "care",
    label: "Find care",
    topic: "scheduling",
    icon: Stethoscope,
    placeholder: "What kind of care do you need, and where are you located?",
  },
  {
    id: "coverage",
    label: "Coverage",
    topic: "prior-auth",
    icon: ShieldCheck,
    placeholder: "What treatment, test, or medication needs approval?",
  },
] as const

const examples = [
  {
    label: "Screening",
    prompt: "45 male. What cancer screening is due, and what history could change the answer?",
    mode: "screening",
  },
  {
    label: "Care",
    prompt: "Find primary care near 97123 and tell me what to confirm before booking.",
    mode: "care",
  },
  {
    label: "Coverage",
    prompt: "Help me understand what is needed after a prior-authorization denial.",
    mode: "coverage",
  },
] as const

type CommandModeId = (typeof commandModes)[number]["id"]

export function ClinicalCommand() {
  const [modeId, setModeId] = useState<CommandModeId>("screening")
  const [prompt, setPrompt] = useState("")
  const activeMode = commandModes.find((mode) => mode.id === modeId) || commandModes[0]

  return (
    <div className="w-full">
      <form action="/chat" method="get" onSubmit={(event) => {
        if (!prompt.trim()) event.preventDefault()
      }}>
        <input type="hidden" name="topic" value={activeMode.topic} />
        <input type="hidden" name="autorun" value="1" />
        <div className="overflow-hidden rounded-[16px] border border-white/14 bg-[#0d0f0f] shadow-[0_20px_70px_rgba(0,0,0,0.38)] transition focus-within:border-cyan-200/48 focus-within:shadow-[0_0_0_3px_rgba(165,243,252,0.09),0_24px_76px_rgba(0,0,0,0.44)]">
          <label htmlFor="home-clinical-command" className="sr-only">
            Ask OpenRx
          </label>
          <div className="flex items-start gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
            <Search size={18} className="mt-1 shrink-0 text-zinc-400" aria-hidden />
            <textarea
              id="home-clinical-command"
              name="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={2}
              placeholder={activeMode.placeholder}
              className="min-h-[72px] w-full resize-none bg-transparent text-[16px] leading-7 text-white outline-none placeholder:text-zinc-500"
            />
          </div>
          <div className="flex flex-col gap-3 border-t border-white/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-1 overflow-x-auto" role="radiogroup" aria-label="Workflow type">
              {commandModes.map((mode) => {
                const Icon = mode.icon
                const active = mode.id === modeId
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setModeId(mode.id)}
                    className={cn(
                      "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[8px] px-3 text-[12px] font-semibold transition",
                      active
                        ? "bg-white/[0.11] text-white"
                        : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                    )}
                  >
                    <Icon size={14} aria-hidden />
                    {mode.label}
                  </button>
                )
              })}
            </div>
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-cyan-200 px-4 text-sm font-semibold text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Submit question"
            >
              Ask OpenRx
              <ArrowUp size={15} aria-hidden />
            </button>
          </div>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2" aria-label="Example questions">
        {examples.map((example, index) => (
          <button
            key={example.label}
            type="button"
            onClick={() => {
              setModeId(example.mode)
              setPrompt(example.prompt)
            }}
            className={cn(
              "text-left text-[12px] leading-5 text-zinc-400 transition hover:text-cyan-100",
              index > 0 && "hidden sm:block"
            )}
          >
            <span className="font-semibold text-zinc-300">{example.label}:</span>{" "}
            {example.prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
