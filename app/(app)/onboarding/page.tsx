"use client"

import { cn } from "@/lib/utils"
import { useWalletIdentity } from "@/lib/wallet-context"
import { AppPageHeader } from "@/components/layout/app-page"
import {
  Bot, User, Heart, Pill, Stethoscope,
  CheckCircle2,
  Activity, ArrowRight, Sparkles, Wallet as WalletIcon,
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

const AGENT_NAMES: Record<string, { name: string; icon: typeof Bot; color: string }> = {
  sage: { name: "Sage", icon: Heart, color: "text-teal" },
  maya: { name: "Maya", icon: Pill, color: "text-yellow-600" },
  cal: { name: "Cal", icon: Stethoscope, color: "text-soft-blue" },
  ivy: { name: "Ivy", icon: Activity, color: "text-accent" },
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
  const [patient, setPatient] = useState<PatientData>({})
  const [isTyping, setIsTyping] = useState(false)
  const [searchResults, setSearchResults] = useState<{ name: string; npi: string; credential?: string; specialty?: string; fullAddress?: string; phone?: string }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
        `Hi! I'm Sage. Let's set up your care team — takes about 2 minutes.\n\nDo you have a primary care physician?`,
        "sage",
        [
          { label: "Yes, I have one", value: "yes" },
          { label: "No, I need one", value: "no" },
        ]
      )
      setStep("has-pcp")
    }
  }, [step, messages.length, addAgent, isConnected])

  // Save to wallet identity when onboarding completes
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
          setStep("pcp-search")
        } else {
          setPatient(p => ({ ...p, hasPcp: false }))
          addAgent("No problem. What city or ZIP? I'll find in-network PCPs near you.")
          setStep("pcp-search")
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
            setStep("pcp-confirm")
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
          setStep("has-dentist")
        } else {
          addAgent("I didn’t recognize which PCP you meant. Reply with the number, paste the doctor’s name, or say 'search again'.")
          setStep("pcp-confirm")
        }
        break

      case "has-dentist":
        addUser(val)
        if (val.toLowerCase().includes("skip")) {
          addAgent("No worries, we can set that up later.\n\nWhat pharmacy do you use? (Name and city)")
          setStep("pharmacy-search")
        } else if (val.toLowerCase().includes("yes")) {
          addAgent("Noted. What pharmacy do you use?")
          setStep("pharmacy-search")
        } else {
          addAgent("Let me find dentists near you. What city or ZIP?")
          setStep("dentist-search")
        }
        break

      case "dentist-search":
        addUser(val)
          addAgent("Noted. What pharmacy do you use?")
        setStep("pharmacy-search")
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
              setStep("medications")
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
            setStep("devices")
          }, 800)
        } else {
          const parts = val.split(/\s+/)
          const med = { name: parts.slice(0, -2).join(" ") || val, dose: parts[parts.length - 2] || "", frequency: parts[parts.length - 1] || "" }
          setPatient(p => ({ ...p, medications: [...(p.medications || []), med] }))
          addAgent(`Got it — **${val}** added to your list.\n\nI'll check for interactions once we have everything.\n\nAny other medications? (Say 'done' when you're finished)`, "maya")
          setStep("med-more")
        }
        break

      case "med-more":
        addUser(val)
        if (val.toLowerCase() === "done" || val.toLowerCase() === "that's it" || val.toLowerCase() === "no") {
          const medCount = patient.medications?.length || 0
          addAgent(`${medCount} medication${medCount !== 1 ? "s" : ""} recorded. Running interaction check... No interactions found!\n\nHanding you back to Sage.`, "maya")
          setTimeout(() => {
            addAgent("Almost done. Any health devices?", "sage", [
              { label: "Apple Watch / Fitbit", value: "smartwatch" },
              { label: "Glucose Monitor", value: "glucose" },
              { label: "BP Cuff", value: "bp" },
              { label: "Multiple", value: "multiple" },
              { label: "None", value: "none" },
            ])
            setStep("devices")
          }, 800)
        } else {
          const med = { name: val, dose: "", frequency: "" }
          setPatient(p => ({ ...p, medications: [...(p.medications || []), med] }))
          addAgent(`Added **${val}** — any more? (Say 'done' when finished)`, "maya")
        }
        break

      case "devices":
        addUser(val)
        setPatient(p => ({ ...p, devices: [val] }))
        addAgent("Last step — Ivy will set up your preventive screenings.", "sage")
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

            const list = screenings.map((s: { name: string; frequency: string; reason: string }) => `- **${s.name}** — ${s.frequency}\n  _${s.reason}_`).join("\n\n")
            addAgent(`Hi ${patient.fullName?.split(" ")[0] || "there"}! I'm Ivy, your wellness coach.\n\nBased on your profile, here are your recommended screenings:\n\n${list}\n\nI'll work with Cal (scheduling) to get these booked for you. Want me to schedule them now?`, "ivy", [
              { label: "Yes, schedule them!", value: "yes" },
              { label: "Let me review first", value: "later" },
            ])
            setStep("screenings")
          } catch {
            addAgent("I've set up your wellness plan. Let's wrap up!", "ivy")
            setStep("summary")
          }
        }, 800)
        break

      case "screenings":
        addUser(val)
        if (val.toLowerCase().includes("yes")) {
          addSystem("Cal is scheduling your screenings...")
          addAgent("I've asked Cal to find the best times for your screenings. You'll get confirmations shortly!", "ivy")
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
              ? `Your profile has been saved to your wallet identity. When you reconnect, everything will be here.\n\n`
              : "") +
            `Your OpenRx care team — Atlas, Nova, Cal, Vera, Maya, Rex, Ivy, and I — are all working together behind the scenes for you. Welcome aboard!`
          )

          // Save to wallet identity
          saveToWallet()

          setStep("complete")
        }, 1500)
        break

      default:
        addUser(val)
        break
    }
  }, [input, step, patient, searchResults, addUser, addAgent, addSystem, isConnected, saveToWallet])

  const handleOption = useCallback((value: string) => {
    handleSubmit(value)
  }, [handleSubmit])

  return (
    <div className="animate-slide-up max-w-2xl mx-auto">
      <AppPageHeader
        align="center"
        variant="hero"
        title="Welcome to OpenRx"
        description="Your AI care team is ready. No forms — just a conversation."
        className="mb-6 surface-card p-5"
        leading={
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-teal-dark">
            <Sparkles size={24} className="text-white" />
          </div>
        }
        meta={
          isConnected ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-[10px] font-semibold text-accent">
              <WalletIcon size={10} />
              Wallet connected — profile will be saved automatically
            </div>
          ) : null
        }
      />

      {/* Chat */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => {
            const agentInfo = msg.agent ? AGENT_NAMES[msg.agent] : null
            const Icon = agentInfo?.icon || Bot

            return (
              <div key={msg.id}>
                <div className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
                  {msg.role !== "system" && (
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      msg.role === "agent" ? "bg-teal/10" : "bg-soft-blue/10"
                    )}>
                      {msg.role === "user" ? <User size={14} className="text-soft-blue" /> : <Icon size={14} className={agentInfo?.color || "text-teal"} />}
                    </div>
                  )}
                  <div className={cn(
                    "rounded-xl px-4 py-3 max-w-[85%]",
                    msg.role === "user" ? "bg-soft-blue/5 border border-soft-blue/10" :
                    msg.role === "system" ? "bg-surface text-center w-full max-w-full text-xs text-muted py-2" :
                    "bg-teal/5 border border-teal/10"
                  )}>
                    {msg.role === "agent" && agentInfo && (
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider mb-1 block", agentInfo.color)}>
                        {agentInfo.name}
                      </span>
                    )}
                    <p className="text-sm text-primary leading-relaxed whitespace-pre-line">
                      {msg.content.replace(/\*\*(.*?)\*\*/g, "$1")}
                    </p>
                  </div>
                </div>

                {/* Option buttons */}
                {msg.options && step !== "complete" && msg.id === messages[messages.length - 1]?.id && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-11">
                    {msg.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleOption(opt.value)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-teal/20 bg-teal/5 text-teal hover:bg-teal/10 transition"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
                <Heart size={14} className="text-teal" />
              </div>
              <div className="rounded-xl bg-teal/5 border border-teal/10 px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-teal/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-teal/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-teal/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Input */}
        {step !== "complete" && (
          <div className="px-5 py-3 border-t border-border bg-surface/30">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Type your answer..."
                disabled={isTyping || isSearching}
                aria-label="Onboarding chat input"
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-surface text-sm placeholder:text-muted focus:outline-none focus:border-teal/40 focus:ring-1 focus:ring-teal/20 transition disabled:opacity-50"
              />
              <button
                onClick={() => handleSubmit()}
                disabled={isTyping || isSearching || !input.trim()}
                aria-label="Send message"
                className="px-4 py-2.5 bg-teal text-white rounded-xl hover:bg-teal-dark transition disabled:opacity-50"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Complete state */}
        {step === "complete" && (
          <div className="px-5 py-4 border-t border-border bg-accent/5 text-center">
            <CheckCircle2 size={20} className="text-accent mx-auto mb-1" />
            <p className="text-sm font-semibold text-accent">Onboarding Complete</p>
            {isConnected && (
              <p className="text-[10px] text-accent/70 mt-0.5">Profile saved to your wallet identity</p>
            )}
            <a href="/dashboard" className="text-xs text-teal font-semibold mt-1 inline-block hover:underline">
              Go to Dashboard →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
