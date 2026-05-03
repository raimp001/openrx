"use client"

import { cn } from "@/lib/utils"
import { useWalletIdentity } from "@/lib/wallet-context"
import { AppPageHeader } from "@/components/layout/app-page"
import {
  Bot, User, Heart, Pill, Stethoscope,
  CheckCircle2,
  Activity, ArrowRight, ArrowLeft,
} from "lucide-react"
import { useState, useRef, useEffect, useCallback } from "react"

interface Message {
  id: string
  role: "agent" | "user" | "system"
  agent?: string
  content: string
  options?: { label: string; value: string }[]
  searchable?: boolean
  ts: Date
}

interface PatientData {
  fullName?: string
  dob?: string
  gender?: string
  phone?: string
  email?: string
  address?: string
  insuranceProvider?: string
  insurancePlan?: string
  insuranceId?: string
  hasPcp?: boolean
  pcpName?: string
  pcpNpi?: string
  pcpPhone?: string
  pcpAddress?: string
  hasDentist?: boolean
  dentistName?: string
  pharmacy?: string
  pharmacyNpi?: string
  medications?: { name: string; dose: string; frequency: string }[]
  devices?: string[]
  riskFactors?: string[]
  screenings?: { name: string; frequency: string; due: boolean; reason: string }[]
}

type Step =
  | "welcome"
  | "has-pcp" | "pcp-search" | "pcp-confirm"
  | "has-dentist" | "dentist-search"
  | "pharmacy-search"
  | "medications" | "med-more"
  | "devices"
  | "screenings"
  | "summary" | "complete"

const STEP_LABELS: Partial<Record<Step, string>> = {
  "has-pcp": "Primary Care",
  "pcp-search": "Primary Care",
  "pcp-confirm": "Primary Care",
  "has-dentist": "Dentist",
  "dentist-search": "Dentist",
  "pharmacy-search": "Pharmacy",
  "medications": "Medications",
  "med-more": "Medications",
  "devices": "Devices",
  "screenings": "Screenings",
  "summary": "Summary",
  "complete": "Complete",
}

const JOURNEY_MILESTONES = ["Primary Care", "Dentist", "Pharmacy", "Medications", "Devices", "Screenings", "Complete"]

function getStepProgress(step: Step): { current: number; total: number; label: string } {
  // Group steps into user-facing milestones
  const label = STEP_LABELS[step] || "Getting Started"
  const idx = JOURNEY_MILESTONES.indexOf(label)
  return { current: Math.max(1, idx + 1), total: JOURNEY_MILESTONES.length, label }
}

const AGENT_NAMES: Record<string, { name: string; icon: typeof Bot; color: string }> = {
  sage: { name: "OpenRx", icon: Heart, color: "text-teal" },
  maya: { name: "Medication setup", icon: Pill, color: "text-yellow-600" },
  cal: { name: "Scheduling help", icon: Stethoscope, color: "text-soft-blue" },
  ivy: { name: "Prevention setup", icon: Activity, color: "text-accent" },
}

function normalizeSelectionText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function resolveOrdinalChoice(value: string): number | null {
  const normalized = normalizeSelectionText(value)
  if (!normalized) return null

  const direct = Number.parseInt(normalized, 10)
  if (Number.isFinite(direct)) return direct - 1

  const ordinalMap: Record<string, number> = {
    first: 0,
    "option one": 0,
    "number one": 0,
    second: 1,
    "option two": 1,
    "number two": 1,
    third: 2,
    "option three": 2,
    "number three": 2,
  }

  return ordinalMap[normalized] ?? null
}

function wantsSearchAgain(value: string): boolean {
  const normalized = normalizeSelectionText(value)
  return (
    normalized.includes("search again") ||
    normalized.includes("show more") ||
    normalized.includes("different one") ||
    normalized.includes("another one") ||
    normalized === "different" ||
    normalized === "another"
  )
}

function findSelectedProvider(
  value: string,
  options: Array<{ name: string; npi: string; specialty?: string; fullAddress?: string; phone?: string }>
) {
  const ordinalChoice = resolveOrdinalChoice(value)
  if (ordinalChoice !== null && ordinalChoice >= 0 && ordinalChoice < options.length) {
    return options[ordinalChoice]
  }

  const normalized = normalizeSelectionText(value)
  if (!normalized) return null

  const exact = options.find((option) => normalizeSelectionText(option.name) === normalized)
  if (exact) return exact

  const fuzzy = options.find((option) => {
    const candidate = normalizeSelectionText(option.name)
    return candidate.includes(normalized) || normalized.includes(candidate)
  })
  return fuzzy || null
}

export default function OnboardingPage() {
  const { isConnected, walletAddress, updateProfile, completeOnboarding } = useWalletIdentity()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [step, setStep] = useState<Step>("welcome")
  const [stepHistory, setStepHistory] = useState<Step[]>([])
  const [patient, setPatient] = useState<PatientData>({})
  const [isTyping, setIsTyping] = useState(false)
  const [searchResults, setSearchResults] = useState<{ name: string; npi: string; credential?: string; specialty?: string; fullAddress?: string; phone?: string }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const advanceStep = useCallback((next: Step) => {
    setStepHistory(prev => [...prev, step])
    setStep(next)
  }, [step])

  const goBack = useCallback(() => {
    if (stepHistory.length === 0) return
    const prev = stepHistory[stepHistory.length - 1]
    setStepHistory(h => h.slice(0, -1))
    setStep(prev)
    // Remove messages added after the last user message for this step
    setMessages(msgs => {
      const lastUserIdx = msgs.findLastIndex(m => m.role === "user")
      return lastUserIdx > 0 ? msgs.slice(0, lastUserIdx) : msgs
    })
  }, [stepHistory])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])
  useEffect(() => { inputRef.current?.focus() }, [step])

  const addAgent = useCallback((content: string, agent = "sage", options?: Message["options"]) => {
    setIsTyping(true)
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: "agent",
        agent,
        content,
        options,
        ts: new Date(),
      }])
      setIsTyping(false)
    }, 600 + Math.random() * 400)
  }, [])

  const addUser = useCallback((content: string) => {
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      ts: new Date(),
    }])
  }, [])

  const addSystem = useCallback((content: string) => {
    setMessages(prev => [...prev, {
      id: `s-${Date.now()}`,
      role: "system",
      content,
      ts: new Date(),
    }])
  }, [])

  // Start onboarding
  useEffect(() => {
    if (step === "welcome" && messages.length === 0) {
      addAgent(
        `Let’s set up your care team. This usually takes 5-7 minutes, and you can skip anything you do not know yet.\n\nDo you have a primary care physician?`,
        "sage",
        [
          { label: "Yes, I have one", value: "yes" },
          { label: "No, I need one", value: "no" },
        ]
      )
      setStep("has-pcp")
    }
  }, [step, messages.length, addAgent, isConnected])

  // Save to the connected account when onboarding completes.
  const saveToWallet = useCallback(() => {
    if (!isConnected || !walletAddress) return

    updateProfile({
      fullName: patient.fullName || "",
      dateOfBirth: patient.dob || "",
      gender: patient.gender || "",
      phone: patient.phone || "",
      email: patient.email || "",
      address: patient.address || "",
      insuranceProvider: patient.insuranceProvider || "",
      insurancePlan: patient.insurancePlan || "",
      insuranceId: patient.insuranceId || "",
      primaryPhysicianId: patient.pcpNpi || "",
      preferredPharmacy: patient.pharmacy || "",
      pharmacyNpi: patient.pharmacyNpi || "",
      devices: patient.devices || [],
    })
    completeOnboarding()
  }, [isConnected, walletAddress, patient, updateProfile, completeOnboarding])

  const handleSubmit = useCallback(async (directValue?: string) => {
    const val = (directValue !== undefined ? directValue : input).trim()
    if (!val && step !== "med-more") return
    if (directValue === undefined) setInput("")

    switch (step) {
      case "has-pcp":
        addUser(val)
        if (val.toLowerCase().includes("yes")) {
          setPatient(p => ({ ...p, hasPcp: true }))
          addAgent("Who's your PCP? I'll verify they're in-network.")
          advanceStep("pcp-search")
        } else {
          setPatient(p => ({ ...p, hasPcp: false }))
          addAgent("No problem. What city or ZIP? I'll find in-network PCPs near you.")
          advanceStep("pcp-search")
        }
        break

      case "pcp-search":
        addUser(val)
        setIsSearching(true)
        addSystem("Searching NPI Registry...")
        try {
          const res = await fetch(`/api/providers/search?q=${encodeURIComponent(`${val} internal medicine provider`)}&limit=5`)
          const data = (await res.json()) as {
            ready?: boolean
            clarificationQuestion?: string
            matches?: Array<{
              kind: "provider" | "caregiver" | "lab" | "radiology"
              name: string
              specialty?: string
              fullAddress?: string
              phone?: string
              npi: string
            }>
          }
          const providerMatches = (data.matches || []).filter((item) => item.kind === "provider")
          const mapped = providerMatches.map((item) => ({
            name: item.name,
            npi: item.npi,
            specialty: item.specialty,
            fullAddress: item.fullAddress,
            phone: item.phone,
          }))

          if (data.ready === false) {
            addAgent(data.clarificationQuestion || "Tell me the city/state or ZIP so I can find PCP options.")
            setStep("pcp-search")
            break
          }

          setSearchResults(mapped)
          if (mapped.length > 0) {
            const list = mapped.slice(0, 3).map((p, i) =>
              `${i + 1}. **${p.name}** — ${p.specialty}\n   ${p.fullAddress}${p.phone ? `\n   ${p.phone}` : ""}\n   NPI: ${p.npi}`
            ).join("\n\n")
            addAgent(`Found some options for you!\n\n${list}\n\nWhich one would you like? (Just say the number, or tell me to search again)`)
            advanceStep("pcp-confirm")
          } else {
            addAgent("I couldn't find anyone matching that. Try a different name, city, or ZIP code?")
            setStep("pcp-search")
          }
        } catch {
          addAgent("Had trouble searching — can you try again with a city and state?")
          setStep("pcp-search")
        }
        setIsSearching(false)
        break

      case "pcp-confirm":
        addUser(val)
        if (wantsSearchAgain(val)) {
          addAgent("No problem. Give me a different name, city, or ZIP code and I'll search again.")
          setStep("pcp-search")
          break
        }

        const chosen = findSelectedProvider(val, searchResults)
        if (chosen) {
          setPatient(p => ({
            ...p,
            pcpName: chosen.name,
            pcpNpi: chosen.npi,
            pcpPhone: chosen.phone,
            pcpAddress: chosen.fullAddress,
          }))
          const phoneLine = chosen.phone ? `Phone: ${chosen.phone}` : "Phone: Not listed in NPI Registry"
          const addressLine = chosen.fullAddress ? `Address: ${chosen.fullAddress}` : "Address: Not listed in NPI Registry"
          addAgent(
            `Locked in **${chosen.name}** as your PCP.\n\nHere’s the contact information I found:\n${phoneLine}\n${addressLine}\n\nThe NPI registry usually does not publish email, so phone and office address are the reliable contact methods here.\n\nDo you have a dentist?`,
            "sage",
            [
            { label: "Yes", value: "yes" },
            { label: "No, find me one", value: "no" },
            { label: "Skip for now", value: "skip" },
            ]
          )
          advanceStep("has-dentist")
        } else {
          addAgent("I didn’t recognize which PCP you meant. Reply with the number, paste the doctor’s name, or say ‘search again’.")
          advanceStep("pcp-confirm")
        }
        break

      case "has-dentist":
        addUser(val)
        if (val.toLowerCase().includes("skip")) {
          addAgent("No worries, we can set that up later.\n\nWhat pharmacy do you use? (Name and city)")
          advanceStep("pharmacy-search")
        } else if (val.toLowerCase().includes("yes")) {
          addAgent("Noted. What pharmacy do you use?")
          advanceStep("pharmacy-search")
        } else {
          addAgent("Let me find dentists near you. What city or ZIP?")
          advanceStep("dentist-search")
        }
        break

      case "dentist-search":
        addUser(val)
          addAgent("Noted. What pharmacy do you use?")
        advanceStep("pharmacy-search")
        break

      case "pharmacy-search":
        addUser(val)
        setIsSearching(true)
        addSystem("Searching pharmacies...")
        try {
          const res = await fetch(`/api/pharmacy/search?q=${encodeURIComponent(val)}&limit=3`)
          const data = (await res.json()) as {
            ready?: boolean
            clarificationQuestion?: string
            pharmacies?: Array<{ name: string; npi: string; fullAddress?: string }>
          }
          if (data.ready === false) {
            addAgent(data.clarificationQuestion || "What city/state or ZIP should I use for pharmacy search?")
            setStep("pharmacy-search")
            setIsSearching(false)
            break
          }
          const pharmacies = data.pharmacies || []
          if (pharmacies.length > 0) {
            const p = pharmacies[0]
            setPatient(prev => ({ ...prev, pharmacy: p.name, pharmacyNpi: p.npi }))
            addAgent(`Found it! **${p.name}**\n${p.fullAddress}\nNPI: ${p.npi}\n\nI've set this as your default pharmacy.\n\nNow the important part — let's go through your medications. I'm handing you to Maya, our Rx specialist.`)
            setTimeout(() => {
              addAgent("I'm Maya. What medications are you currently taking? (Name, dose, frequency — one at a time)", "maya")
              advanceStep("medications")
            }, 1000)
          } else {
            addAgent("Couldn't find that pharmacy. Try the full name and city (e.g., 'CVS Portland OR')?")
          }
        } catch {
          addAgent("Had trouble searching — try again with more detail?")
        }
        setIsSearching(false)
        break

      case "medications":
        addUser(val)
        if (val.toLowerCase().includes("none") || val.toLowerCase().includes("no meds") || val.toLowerCase().includes("nothing")) {
          setPatient(p => ({ ...p, medications: [] }))
          addAgent("No medications — noted.", "maya")
          setTimeout(() => {
            addAgent("Almost done. Any health devices?", "sage", [
              { label: "Apple Watch / Fitbit", value: "smartwatch" },
              { label: "Glucose Monitor", value: "glucose" },
              { label: "Blood Pressure Cuff", value: "bp" },
              { label: "None", value: "none" },
            ])
            advanceStep("devices")
          }, 800)
        } else {
          const parts = val.split(/\s+/)
          const med = { name: parts.slice(0, -2).join(" ") || val, dose: parts[parts.length - 2] || "", frequency: parts[parts.length - 1] || "" }
          setPatient(p => ({ ...p, medications: [...(p.medications || []), med] }))
          addAgent(`Got it - **${val}** added to your list.\n\nI will check for interactions once we have everything.\n\nAny other medications? (Say 'done' when you are finished)`, "maya")
          advanceStep("med-more")
        }
        break

      case "med-more":
        addUser(val)
        if (val.toLowerCase() === "done" || val.toLowerCase() === "that's it" || val.toLowerCase() === "no") {
          const medCount = patient.medications?.length || 0
          addAgent(`${medCount} medication${medCount !== 1 ? "s" : ""} recorded. Interaction check complete: no obvious interactions found in this demo.\n\nNext, a few care setup details.`, "maya")
          setTimeout(() => {
            addAgent("Almost done. Any health devices?", "sage", [
              { label: "Apple Watch / Fitbit", value: "smartwatch" },
              { label: "Glucose Monitor", value: "glucose" },
              { label: "BP Cuff", value: "bp" },
              { label: "Multiple", value: "multiple" },
              { label: "None", value: "none" },
            ])
            advanceStep("devices")
          }, 800)
        } else {
          const med = { name: val, dose: "", frequency: "" }
          setPatient(p => ({ ...p, medications: [...(p.medications || []), med] }))
          addAgent(`Added **${val}**. Any more? (Say 'done' when finished)`, "maya")
        }
        break

      case "devices":
        addUser(val)
        setPatient(p => ({ ...p, devices: [val] }))
        addAgent("Last step: I will prepare your preventive screening list.", "sage")
        setTimeout(async () => {
          let age = 40
          try {
            const dob = new Date(patient.dob || "")
            age = Math.floor((Date.now() - dob.getTime()) / 31557600000)
          } catch {}

          try {
            const res = await fetch("/api/onboarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                step: "screenings",
                data: { age, gender: patient.gender || "other", riskFactors: patient.riskFactors || [] },
              }),
            })
            const data = await res.json()
            const screenings = data.screenings || []
            setPatient(p => ({ ...p, screenings }))

            const list = screenings.map((s: { name: string; frequency: string; reason: string }) => `- **${s.name}** - ${s.frequency}\n  _${s.reason}_`).join("\n\n")
            addAgent(`Hi ${patient.fullName?.split(" ")[0] || "there"}.\n\nBased on your profile, these screenings may be relevant:\n\n${list}\n\nDo you want help turning these into scheduling next steps?`, "ivy", [
              { label: "Yes, help me schedule", value: "yes" },
              { label: "Let me review first", value: "later" },
            ])
            advanceStep("screenings")
          } catch {
            addAgent("Your prevention list is ready. Let us wrap up.", "ivy")
            advanceStep("summary")
          }
        }, 800)
        break

      case "screenings":
        addUser(val)
        if (val.toLowerCase().includes("yes")) {
          addSystem("Preparing scheduling next steps...")
          addAgent("I will surface realistic scheduling options and follow-up reminders from your dashboard.", "ivy")
        }
        setTimeout(() => {
          const medList = patient.medications?.length
            ? patient.medications.map(m => `- ${m.name} ${m.dose} ${m.frequency}`.trim()).join("\n")
            : "- None"
          const screenList = patient.screenings?.map(s => `- ${s.name}`).join("\n") || "- To be determined"

          addAgent(
            `You're all set!\n\nHere's your care team summary:\n\n` +
            `**PCP:** ${patient.pcpName || "To be assigned"}${patient.pcpPhone ? `\nPhone: ${patient.pcpPhone}` : ""}${patient.pcpAddress ? `\nAddress: ${patient.pcpAddress}` : ""}\n` +
            `**Pharmacy:** ${patient.pharmacy || "To be assigned"}\n\n` +
            `**Medications:**\n${medList}\n\n` +
            `**Upcoming Screenings:**\n${screenList}\n\n` +
            (isConnected
              ? `Your profile has been saved to your account. When you return, everything will be here.\n\n`
              : "") +
            `Your OpenRx care plan is ready. You can now review screenings, messages, appointments, medications, and follow-up tasks from the dashboard.`
          )

          // Save to the connected account when available.
          saveToWallet()

          advanceStep("complete")
        }, 1500)
        break

      default:
        addUser(val)
        break
    }
  }, [input, step, patient, searchResults, addUser, addAgent, addSystem, advanceStep, isConnected, saveToWallet])

  const handleOption = useCallback((value: string) => {
    handleSubmit(value)
  }, [handleSubmit])

  const progress = getStepProgress(step)
  const stageTitle = step === "complete" ? "Care profile complete" : progress.label
  const progressPercent = Math.round((progress.current / progress.total) * 100)

  return (
    <div className="mx-auto max-w-4xl animate-slide-up space-y-4">
      <AppPageHeader
        variant="hero"
        eyebrow="Setup"
        title="Tell us what care to coordinate."
        description="Answer one question at a time. Skip anything you do not know. The goal is a usable care plan, not a long form."
        meta={
          <>
            <span className="chip">{progressPercent}%</span>
            <span className="chip">{stageTitle}</span>
            {isConnected ? <span className="chip">Account connected</span> : null}
          </>
        }
      />

      <section className="surface-card overflow-hidden">
        <div className="border-b border-[rgba(82,108,139,0.12)] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">{stageTitle}</p>
              <p className="mt-1 text-xs text-muted">Step {progress.current} of {progress.total}</p>
            </div>
            {stepHistory.length > 0 && step !== "complete" ? (
              <button onClick={goBack} className="control-button-secondary px-3 py-2" aria-label="Go back to previous step">
                <ArrowLeft size={14} />
                Back
              </button>
            ) : null}
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-border/50">
            <div className="h-full rounded-full bg-teal transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="flex min-h-[620px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.map((msg) => {
              const agentInfo = msg.agent ? AGENT_NAMES[msg.agent] : null
              const Icon = agentInfo?.icon || Bot

              return (
                <div key={msg.id}>
                  <div className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
                    {msg.role !== "system" ? (
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", msg.role === "agent" ? "bg-teal/10" : "bg-soft-blue/10")}>
                        {msg.role === "user" ? <User size={14} className="text-soft-blue" /> : <Icon size={14} className={agentInfo?.color || "text-teal"} />}
                      </div>
                    ) : null}
                    <div className={cn(
                      "max-w-[88%] rounded-[20px] px-4 py-3",
                      msg.role === "user" ? "bg-white text-primary" :
                      msg.role === "system" ? "w-full max-w-full bg-white/34 text-center text-xs text-muted" :
                      "bg-teal/6 text-primary"
                    )}>
                      {msg.role === "agent" && agentInfo ? (
                        <span className={cn("mb-1 block text-[10px] font-bold uppercase tracking-[0.14em]", agentInfo.color)}>
                          {agentInfo.name}
                        </span>
                      ) : null}
                      <p className="whitespace-pre-line text-sm leading-7">
                        {msg.content.replace(/\*\*(.*?)\*\*/g, "$1")}
                      </p>
                    </div>
                  </div>

                  {msg.options && step !== "complete" && msg.id === messages[messages.length - 1]?.id ? (
                    <div className="ml-11 mt-3 flex flex-wrap gap-2">
                      {msg.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleOption(opt.value)}
                          className="rounded-full border border-[rgba(82,108,139,0.12)] bg-white/72 px-3.5 py-2 text-xs font-semibold text-secondary transition hover:bg-white hover:text-primary"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}

            {isTyping ? (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal/10">
                  <Heart size={14} className="text-teal" />
                </div>
                <div className="rounded-[20px] bg-teal/6 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal/40" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal/40" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal/40" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            ) : null}

            <div ref={endRef} />
          </div>

          {step !== "complete" ? (
            <div className="border-t border-[rgba(82,108,139,0.12)] bg-white/48 px-3 py-3 sm:px-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder={isSearching ? "Searching..." : "Type your answer"}
                  disabled={isTyping || isSearching}
                  aria-label="Onboarding chat input"
                  className="min-h-11 flex-1 rounded-full border border-[rgba(82,108,139,0.14)] bg-white px-4 py-2.5 text-sm text-primary placeholder:text-muted focus:border-teal/25 focus:outline-none focus:ring-1 focus:ring-teal/10 disabled:opacity-50"
                />
                <button
                  onClick={() => handleSubmit()}
                  disabled={isTyping || isSearching || !input.trim()}
                  aria-label="Send message"
                  className="control-button-primary min-h-11 px-5"
                >
                  Continue
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-[rgba(82,108,139,0.12)] bg-accent/5 px-5 py-5 text-center">
              <CheckCircle2 size={24} className="mx-auto text-accent" />
              <p className="mt-2 text-base font-semibold text-accent">Care setup complete</p>
              <a href="/dashboard" className="mt-3 inline-flex text-sm font-semibold text-teal hover:underline">
                Go to dashboard
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
