"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Calendar, ClipboardCheck, FlaskConical, MessageSquare, PhoneCall, Pill, Search, Stethoscope } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface CommandSuggestion {
  id: string
  label: string
  description: string
  href: string
  icon: LucideIcon
  // Keywords used for fuzzy matching beyond label/description.
  keywords: string[]
}

const SUGGESTIONS: CommandSuggestion[] = [
  {
    id: "call-patient",
    label: "Call a patient (private number)",
    description: "Place a private call from an OpenRx caller ID — your number stays hidden.",
    href: "/outreach",
    icon: PhoneCall,
    keywords: ["call", "phone", "outreach", "private", "patient"],
  },
  {
    id: "screening-recs",
    label: "Screening recommendations",
    description: "Run the screening engine for a patient context.",
    href: "/screening",
    icon: ClipboardCheck,
    keywords: ["screening", "uspstf", "colon", "mammogram", "pap", "lung"],
  },
  {
    id: "schedule-appointment",
    label: "Schedule an appointment",
    description: "Open the scheduling workspace.",
    href: "/scheduling",
    icon: Calendar,
    keywords: ["schedule", "appointment", "book", "visit"],
  },
  {
    id: "find-pharmacy",
    label: "Find a pharmacy",
    description: "Search nearby pharmacies and check stock.",
    href: "/pharmacy",
    icon: Pill,
    keywords: ["pharmacy", "rx", "medication", "fill"],
  },
  {
    id: "prior-auth",
    label: "Start a prior authorization",
    description: "Open the prior auth workspace and draft a submission.",
    href: "/prior-auth",
    icon: ClipboardCheck,
    keywords: ["prior auth", "pa", "denial", "appeal"],
  },
  {
    id: "referrals",
    label: "Refer to a specialist",
    description: "Open the referral builder.",
    href: "/referrals",
    icon: Stethoscope,
    keywords: ["referral", "specialist", "consult"],
  },
  {
    id: "lab-results",
    label: "Review lab results",
    description: "Open the labs workspace.",
    href: "/lab-results",
    icon: FlaskConical,
    keywords: ["lab", "labs", "results"],
  },
  {
    id: "messages",
    label: "Send a message",
    description: "Open secure patient messaging.",
    href: "/messages",
    icon: MessageSquare,
    keywords: ["message", "send", "secure"],
  },
  {
    id: "ask-openrx",
    label: "Ask OpenRx (clinical chat)",
    description: "Open the answer-first clinical chat.",
    href: "/chat",
    icon: Search,
    keywords: ["ask", "chat", "answer", "clinical", "perplexity", "evidence"],
  },
]

function score(query: string, suggestion: CommandSuggestion): number {
  if (!query) return 0
  const q = query.toLowerCase()
  let s = 0
  if (suggestion.label.toLowerCase().includes(q)) s += 4
  if (suggestion.description.toLowerCase().includes(q)) s += 2
  for (const kw of suggestion.keywords) {
    if (kw.includes(q)) s += 1
  }
  return s
}

interface ClinicianCommandBarProps {
  placeholder?: string
  testIdPrefix?: string
}

export function ClinicianCommandBar({
  placeholder = "Search clinician actions — call patient, screening, schedule…",
  testIdPrefix = "clinician-command",
}: ClinicianCommandBarProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return SUGGESTIONS
    return [...SUGGESTIONS]
      .map((s) => ({ s, score: score(query, s) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.s)
  }, [query])

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor="clinician-command-input" className="sr-only">
        Clinician command search
      </label>
      <div className="flex items-center gap-2 rounded-[12px] border border-border-strong bg-white px-3 py-2 shadow-card focus-within:border-teal/60 focus-within:shadow-focus">
        <Search size={14} className="text-muted" />
        <input
          id="clinician-command-input"
          data-testid={`${testIdPrefix}-input`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 border-0 bg-transparent text-[14px] text-primary outline-none placeholder:text-subtle"
        />
        <span className="hidden rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted sm:inline">
          Clinician mode
        </span>
      </div>
      {open && filtered.length > 0 ? (
        <ul
          data-testid={`${testIdPrefix}-suggestions`}
          className="absolute left-0 right-0 z-30 mt-2 max-h-[320px] overflow-y-auto rounded-[12px] border border-border-strong bg-white p-2 shadow-card"
        >
          {filtered.map((s) => {
            const Icon = s.icon
            return (
              <li key={s.id}>
                <a
                  href={s.href}
                  data-testid={`${testIdPrefix}-item`}
                  className="flex items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] transition hover:bg-surface-2"
                >
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-teal-dark">
                    <Icon size={13} />
                  </span>
                  <span>
                    <span className="block font-medium text-primary">{s.label}</span>
                    <span className="block text-[12px] text-muted">{s.description}</span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
