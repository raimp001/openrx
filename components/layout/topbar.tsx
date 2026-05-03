"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import {
  Bell,
  Calendar,
  Command,
  FlaskConical,
  LayoutDashboard,
  MessageSquare,
  Pill,
  Search,
  UserCircle,
  X,
  ArrowRightCircle,
  Activity,
  Syringe,
  Clock,
  Bot,
} from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useWalletIdentity } from "@/lib/wallet-context"

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export default function Topbar() {
  const pathname = usePathname()
  const { snapshot, getPhysician } = useLiveSnapshot()
  const { isConnected, profile, walletAddress } = useWalletIdentity()
  const displayName = isConnected
    ? profile?.fullName || snapshot.patient?.full_name || (walletAddress ? shortenAddress(walletAddress) : "")
    : ""
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const unread = snapshot.messages.filter((m) => !m.read).length
  const isOnboarding = pathname === "/onboarding"
  const hasSearchableData =
    Boolean(snapshot.patient) ||
    snapshot.appointments.length > 0 ||
    snapshot.prescriptions.length > 0 ||
    snapshot.labResults.length > 0 ||
    snapshot.messages.length > 0
  const showSearch = hasSearchableData && !isOnboarding
  const pageInfo = useMemo(() => {
    const entries: Array<[string, { label: string; note: string }]> = [
      ["/dashboard", { label: "My care", note: "Screenings, messages, appointments, and next steps" }],
      ["/onboarding", { label: "Care setup", note: "Doctors, pharmacy, medications, and screening context" }],
      ["/providers", { label: "Find care", note: "Doctors, specialists, labs, and imaging near you" }],
      ["/screening", { label: "Screenings", note: "Prevention and hereditary review" }],
      ["/messages", { label: "Messages", note: "Questions, follow-up, and care coordination" }],
      ["/billing", { label: "Coverage & billing", note: "Claims, denials, and payment status" }],
      ["/prescriptions", { label: "Medications", note: "Refills, adherence, and access" }],
      ["/lab-results", { label: "Lab results", note: "Test results that need review" }],
      ["/scheduling", { label: "Appointments", note: "Upcoming visits and logistics" }],
      ["/clinical-trials", { label: "Clinical trials", note: "Study matching near you" }],
      ["/prior-auth", { label: "Coverage approvals", note: "Prior approvals, denials, and appeals" }],
      ["/chat", { label: "Ask for help", note: "Questions about care, referrals, and coverage" }],
    ]

    const match = entries.find(([href]) => pathname === href || pathname?.startsWith(`${href}/`))
    return match?.[1] || { label: "My care", note: "Your health summary, messages, and next steps" }
  }, [pathname])

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (event.target as HTMLElement).isContentEditable

      if ((event.key === "/" && !isEditable) || ((event.ctrlKey || event.metaKey) && event.key === "k")) {
        event.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }

      if (event.key === "Escape") {
        inputRef.current?.blur()
        setIsOpen(false)
        setQuery("")
      }
    }

    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const quickNav = useMemo(
    () => [
      { label: "My care", href: "/dashboard", icon: LayoutDashboard, keywords: ["home", "dashboard", "overview"] },
      { label: "Profile", href: "/profile", icon: UserCircle, keywords: ["profile", "account", "personal"] },
      { label: "Timeline", href: "/timeline", icon: Clock, keywords: ["timeline", "history", "events"] },
      { label: "Appointments", href: "/scheduling", icon: Calendar, keywords: ["appointments", "schedule", "book"] },
      { label: "Medications", href: "/prescriptions", icon: Pill, keywords: ["meds", "medications", "prescriptions"] },
      { label: "Lab Results", href: "/lab-results", icon: FlaskConical, keywords: ["labs", "results", "blood"] },
      { label: "Vitals", href: "/vitals", icon: Activity, keywords: ["vitals", "bp", "heart rate"] },
      { label: "Vaccinations", href: "/vaccinations", icon: Syringe, keywords: ["vaccines", "shots"] },
      { label: "Referrals", href: "/referrals", icon: ArrowRightCircle, keywords: ["referrals", "specialists"] },
      { label: "Messages", href: "/messages", icon: MessageSquare, keywords: ["messages", "inbox"] },
      { label: "Ask for help", href: "/chat", icon: Bot, keywords: ["ai", "ask", "chat", "help"] },
    ],
    []
  )

  const results = useMemo(() => {
    if (!query || query.length < 2) return null
    const lowered = query.toLowerCase()

    const navigation = quickNav
      .filter((item) => item.label.toLowerCase().includes(lowered) || item.keywords.some((kw) => kw.includes(lowered)))
      .slice(0, 5)

    const prescriptions = snapshot.prescriptions
      .filter((rx) => rx.medication_name.toLowerCase().includes(lowered))
      .slice(0, 3)

    const appointments = snapshot.appointments
      .filter((apt) => {
        const physician = getPhysician(apt.physician_id)
        return apt.reason.toLowerCase().includes(lowered) || physician?.full_name.toLowerCase().includes(lowered)
      })
      .slice(0, 3)

    const total = navigation.length + prescriptions.length + appointments.length
    return { navigation, prescriptions, appointments, total }
  }, [getPhysician, query, quickNav, snapshot.appointments, snapshot.prescriptions])

  const flatResults = useMemo(() => {
    if (!results) return []
    const items: { href: string; label: string }[] = []
    for (const item of results.navigation) items.push({ href: item.href, label: item.label })
    for (const apt of results.appointments) items.push({ href: "/scheduling", label: apt.reason })
    for (const rx of results.prescriptions) items.push({ href: "/prescriptions", label: rx.medication_name })
    return items
  }, [results])

  const closeSearch = useCallback(() => {
    setIsOpen(false)
    setQuery("")
    setActiveIndex(-1)
  }, [])

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen || flatResults.length === 0) return

      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, flatResults.length - 1))
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault()
        const item = flatResults[activeIndex]
        if (item) {
          window.location.href = item.href
          closeSearch()
        }
      }
    },
    [activeIndex, closeSearch, flatResults, isOpen]
  )

  useEffect(() => {
    setActiveIndex(-1)
  }, [query])

  return (
    <header className="sticky top-0 z-30 px-4 pt-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1240px] items-center gap-3 rounded-full border border-[rgba(82,108,139,0.12)] bg-[rgba(247,250,255,0.76)] px-3 py-2 shadow-[0_18px_54px_rgba(8,24,46,0.06)] backdrop-blur-2xl">
        <div className="min-w-0 shrink-0 pl-1 lg:min-w-[132px]">
          <p className="truncate text-sm font-semibold text-primary">{pageInfo.label}</p>
        </div>

        {showSearch ? (
          <div ref={searchRef} className="relative flex-1">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setIsOpen(true)
              }}
              onFocus={() => query.length >= 2 && setIsOpen(true)}
              onKeyDown={handleSearchKeyDown}
            role="combobox"
            aria-controls="global-search-results"
            aria-expanded={isOpen && !!results}
            aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
              placeholder="Search your care plan"
              className="w-full rounded-full border border-transparent bg-white/76 py-2.5 pl-10 pr-14 text-sm text-primary placeholder:text-muted transition focus:border-accent/25 focus:ring-1 focus:ring-accent/10"
            />
            {query ? (
              <button
                onClick={() => {
                  setQuery("")
                  setIsOpen(false)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-primary"
                aria-label="Clear"
              >
                <X size={13} />
              </button>
            ) : (
              <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full border border-white/85 bg-white/86 px-2 py-1 text-[10px] font-medium text-muted lg:flex">
                <Command size={9} /> K
              </span>
            )}

            {isOpen && results ? (
              <div className="surface-card absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[22px] bg-[rgba(255,255,255,0.98)]">
                {results.total === 0 ? (
                  <div className="px-4 py-3 text-sm text-secondary">No results for “{query}”</div>
                ) : (
                  <div id="global-search-results" className="max-h-80 overflow-y-auto py-1" role="listbox">
                    {(() => {
                      let index = 0
                      return (
                        <>
                          {results.navigation.map((item) => {
                            const Icon = item.icon
                            const rowIndex = index++
                            return (
                              <Link
                                key={item.href}
                                id={`search-result-${rowIndex}`}
                                href={item.href}
                                onClick={closeSearch}
                                role="option"
                                aria-selected={activeIndex === rowIndex}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-[rgba(239,246,255,0.82)]",
                                  activeIndex === rowIndex && "bg-[rgba(239,246,255,0.82)]"
                                )}
                              >
                                <Icon size={14} className="text-teal" />
                                <span className="font-medium text-primary">{item.label}</span>
                              </Link>
                            )
                          })}
                          {results.appointments.map((apt) => {
                            const physician = getPhysician(apt.physician_id)
                            const rowIndex = index++
                            return (
                              <Link
                                key={apt.id}
                                id={`search-result-${rowIndex}`}
                                href="/scheduling"
                                onClick={closeSearch}
                                role="option"
                                aria-selected={activeIndex === rowIndex}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-[rgba(239,246,255,0.82)]",
                                  activeIndex === rowIndex && "bg-[rgba(239,246,255,0.82)]"
                                )}
                              >
                                <Calendar size={14} className="text-muted" />
                                <div>
                                  <span className="font-medium text-primary">{apt.reason}</span>
                                  <span className="ml-2 text-xs text-muted">
                                    {physician?.full_name} · {formatDate(apt.scheduled_at)}
                                  </span>
                                </div>
                              </Link>
                            )
                          })}
                          {results.prescriptions.map((rx) => {
                            const rowIndex = index++
                            return (
                              <Link
                                key={rx.id}
                                id={`search-result-${rowIndex}`}
                                href="/prescriptions"
                                onClick={closeSearch}
                                role="option"
                                aria-selected={activeIndex === rowIndex}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-[rgba(239,246,255,0.82)]",
                                  activeIndex === rowIndex && "bg-[rgba(239,246,255,0.82)]"
                                )}
                              >
                                <Pill size={14} className="text-muted" />
                                <span className="font-medium text-primary">
                                  {rx.medication_name} {rx.dosage}
                                </span>
                              </Link>
                            )
                          })}
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <Link
            href="/chat"
            className="hidden flex-1 items-center justify-between gap-4 rounded-full bg-white/72 px-4 py-2.5 text-sm text-secondary transition hover:bg-white/92 hover:text-primary lg:flex"
          >
            <span className="inline-flex items-center gap-2">
              <Bot size={15} className="text-teal" />
              {isOnboarding ? "Ask if you get stuck" : "Ask what to do next"}
            </span>
            <ArrowRightCircle size={15} className="text-muted" />
          </Link>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/chat"
            className="hidden h-10 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-white shadow-[0_12px_28px_rgba(7,17,31,0.18)] transition hover:bg-[#12213a] md:inline-flex"
          >
            <Bot size={15} />
            Ask
          </Link>

          <Link
            href="/messages"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-secondary transition hover:bg-white hover:text-primary"
            aria-label="Messages"
          >
            <Bell size={16} strokeWidth={1.6} />
            {unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-coral px-1 text-[9px] font-semibold text-white">
                {unread}
              </span>
            ) : null}
          </Link>

          {isConnected ? (
            <Link
              href="/profile"
              className="flex h-10 items-center gap-2 rounded-full bg-white/70 pl-1.5 pr-3 transition hover:bg-white"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                {displayName ? displayName.charAt(0).toUpperCase() : "?"}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-[12px] font-medium text-primary">
                  {displayName ? displayName.split(" ")[0] : walletAddress ? shortenAddress(walletAddress) : "Profile"}
                </p>
              </div>
            </Link>
          ) : isOnboarding ? (
            <span className="hidden rounded-full bg-white/70 px-3 py-2 text-[12px] font-semibold text-secondary sm:inline-flex">
              Setup
            </span>
          ) : (
            <Link href="/onboarding" className="h-10 rounded-full bg-white/70 px-4 py-2.5 text-[13px] font-semibold text-primary transition hover:bg-white">
              Setup
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
