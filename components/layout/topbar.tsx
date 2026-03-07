"use client"

import { Bell, Search, X, UserCircle, Sparkles, Pill, Calendar, Receipt, Command, FlaskConical, MessageSquare, ArrowRightCircle, LayoutDashboard, Activity, Syringe, Bot, Clock, type LucideIcon } from "lucide-react"
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
  WalletDropdownLink,
} from "@coinbase/onchainkit/wallet"
import { Address, Avatar, Name, Identity } from "@coinbase/onchainkit/identity"
import { useWalletIdentity } from "@/lib/wallet-context"
import { cn, formatDate, formatTime } from "@/lib/utils"
import Link from "next/link"
import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useCareTeamSession } from "@/lib/hooks/use-care-team-session"

export default function Topbar() {
  const { isConnected, profile, isNewUser } = useWalletIdentity()
  const { snapshot, getPhysician } = useLiveSnapshot()
  const { session: careTeamSession } = useCareTeamSession({ pollMs: 10000 })
  const myMessages = snapshot.messages
  const unread = myMessages.filter((m) => !m.read).length
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const myClaims = snapshot.claims
  const myPrescriptions = snapshot.prescriptions
  const myAppointments = snapshot.appointments

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable
      if ((e.key === "/" && !isEditable) || ((e.ctrlKey || e.metaKey) && e.key === "k")) {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
      if (e.key === "Escape") {
        inputRef.current?.blur()
        setIsOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const myLabResults = snapshot.labResults
  const myReferrals = snapshot.referrals

  const QUICK_NAV = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: ["home", "dashboard", "overview"] },
    { label: "Timeline", href: "/timeline", icon: Clock, keywords: ["timeline", "history", "events", "log"] },
    { label: "Appointments", href: "/scheduling", icon: Calendar, keywords: ["appointments", "schedule", "book", "visit"] },
    { label: "Medications", href: "/prescriptions", icon: Pill, keywords: ["meds", "medications", "prescriptions", "drugs", "pills"] },
    { label: "Lab Results", href: "/lab-results", icon: FlaskConical, keywords: ["labs", "lab", "results", "tests", "blood"] },
    { label: "Vital Signs", href: "/vitals", icon: Activity, keywords: ["vitals", "bp", "blood pressure", "heart rate", "glucose", "weight"] },
    { label: "Vaccinations", href: "/vaccinations", icon: Syringe, keywords: ["vaccines", "vaccinations", "shots", "immunizations"] },
    { label: "Referrals", href: "/referrals", icon: ArrowRightCircle, keywords: ["referrals", "specialists", "specialist"] },
    { label: "Messages", href: "/messages", icon: MessageSquare, keywords: ["messages", "inbox", "chat", "communicate"] },
    { label: "Billing", href: "/billing", icon: Receipt, keywords: ["billing", "claims", "bills", "payments", "charges"] },
    { label: "Ask AI", href: "/chat", icon: Bot, keywords: ["ai", "ask", "chat", "help", "assistant"] },
  ]

  const results = useMemo(() => {
    if (!query || query.length < 2) return null
    const q = query.toLowerCase()

    // Quick navigation shortcuts
    const quickNav = QUICK_NAV.filter((n) =>
      n.label.toLowerCase().includes(q) || n.keywords.some((k) => k.includes(q))
    ).slice(0, 3)

    const matchedClaims = myClaims
      .filter(
        (c) =>
          c.claim_number.toLowerCase().includes(q) ||
          c.cpt_codes.some((code) => code.includes(q)) ||
          c.icd_codes.some((code) => code.toLowerCase().includes(q))
      )
      .slice(0, 3)

    const matchedRx = myPrescriptions
      .filter(
        (rx) =>
          rx.medication_name.toLowerCase().includes(q) ||
          rx.dosage.toLowerCase().includes(q) ||
          rx.pharmacy.toLowerCase().includes(q)
      )
      .slice(0, 3)

    const matchedApts = myAppointments
      .filter((apt) => {
        const physician = getPhysician(apt.physician_id)
        return (
          apt.reason.toLowerCase().includes(q) ||
          apt.type.toLowerCase().includes(q) ||
          physician?.full_name.toLowerCase().includes(q) ||
          physician?.specialty.toLowerCase().includes(q)
        )
      })
      .slice(0, 3)

    const matchedLabs = myLabResults
      .filter((lab) =>
        lab.test_name.toLowerCase().includes(q) ||
        lab.lab_facility.toLowerCase().includes(q) ||
        lab.category.toLowerCase().includes(q) ||
        lab.results.some((r) => r.name.toLowerCase().includes(q))
      )
      .slice(0, 3)

    const matchedMessages = myMessages
      .filter((m) => m.content.toLowerCase().includes(q))
      .slice(0, 2)

    const matchedReferrals = myReferrals
      .filter((r) =>
        r.specialist_specialty.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        (r.specialist_name || "").toLowerCase().includes(q)
      )
      .slice(0, 2)

    const total = quickNav.length + matchedClaims.length + matchedRx.length + matchedApts.length + matchedLabs.length + matchedMessages.length + matchedReferrals.length
    if (total === 0) return { quickNav: [], claims: [], rx: [], apts: [], labs: [], messages: [], referrals: [], total: 0 }
    return { quickNav, claims: matchedClaims, rx: matchedRx, apts: matchedApts, labs: matchedLabs, messages: matchedMessages, referrals: matchedReferrals, total }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, myClaims, myPrescriptions, myAppointments, myLabResults, myMessages, myReferrals, getPhysician])

  const closeSearch = useCallback(() => {
    setIsOpen(false)
    setQuery("")
  }, [])

  return (
    <header className="sticky top-0 z-30 border-b border-sand/40 bg-white/80 shadow-topbar backdrop-blur-xl">
      <div className="flex h-[64px] items-center justify-between gap-3 px-4 lg:px-8">
        <div ref={searchRef} className="relative ml-10 w-full max-w-lg lg:ml-0">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cloudy/70" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            placeholder="Search anything — meds, labs, appointments, claims…"
            className="w-full rounded-xl border border-sand/70 bg-cream/60 py-2 pl-9 pr-14 text-[13px] text-warm-800 placeholder:text-cloudy/60 transition focus:border-terra/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(240,90,61,0.08)]"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery("")
                setIsOpen(false)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cloudy/60 transition hover:text-warm-700"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          ) : (
            <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-sand/80 bg-cream/80 px-1.5 py-0.5 text-[9px] font-medium text-cloudy/70 lg:flex">
              <Command size={8} />K
            </span>
          )}

          {isOpen && results && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[500px] overflow-y-auto rounded-2xl border border-sand/60 bg-white shadow-premium animate-scale-in">
              {results.total === 0 ? (
                <div className="px-4 py-3 text-xs text-warm-500">No results for &ldquo;{query}&rdquo;</div>
              ) : (
                <>
                  {results.quickNav.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 border-b border-sand/60 bg-cream/70 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warm-500">
                        <Search size={10} /> Navigate
                      </div>
                      <div className="flex flex-wrap gap-2 px-4 py-2.5">
                        {results.quickNav.map((nav) => {
                          const Icon = nav.icon
                          return (
                            <Link
                              key={nav.href}
                              href={nav.href}
                              onClick={closeSearch}
                              className="flex items-center gap-1.5 rounded-lg border border-sand/70 bg-cream/80 px-2.5 py-1.5 text-xs font-semibold text-warm-700 transition hover:border-terra/30 hover:text-terra"
                            >
                              <Icon size={11} className="text-terra" />
                              {nav.label}
                            </Link>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {results.apts.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 border-y border-sand/60 bg-cream/70 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warm-500">
                        <Calendar size={10} /> Appointments
                      </div>
                      {results.apts.map((apt) => {
                        const physician = getPhysician(apt.physician_id)
                        return (
                          <Link
                            key={apt.id}
                            href="/scheduling"
                            onClick={closeSearch}
                            className="block px-4 py-2.5 transition hover:bg-cream/70"
                          >
                            <p className="text-xs font-semibold text-warm-800">{apt.reason}</p>
                            <p className="text-[11px] text-cloudy">
                              {physician?.full_name} · {formatDate(apt.scheduled_at)} {formatTime(apt.scheduled_at)}
                            </p>
                          </Link>
                        )
                      })}
                    </>
                  )}

                  {results.rx.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 border-y border-sand/60 bg-cream/70 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warm-500">
                        <Pill size={10} /> Medications
                      </div>
                      {results.rx.map((rx) => (
                        <Link
                          key={rx.id}
                          href="/prescriptions"
                          onClick={closeSearch}
                          className="block px-4 py-2.5 transition hover:bg-cream/70"
                        >
                          <p className="text-xs font-semibold text-warm-800">
                            {rx.medication_name} {rx.dosage}
                          </p>
                          <p className="text-[11px] text-cloudy">
                            {rx.frequency} · {rx.pharmacy} ·{" "}
                            <span className={cn("font-bold uppercase", rx.status === "active" ? "text-accent" : "text-warm-500")}>
                              {rx.status}
                            </span>
                          </p>
                        </Link>
                      ))}
                    </>
                  )}

                  {results.labs.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 border-y border-sand/60 bg-cream/70 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warm-500">
                        <FlaskConical size={10} /> Lab Results
                      </div>
                      {results.labs.map((lab) => (
                        <Link
                          key={lab.id}
                          href="/lab-results"
                          onClick={closeSearch}
                          className="block px-4 py-2.5 transition hover:bg-cream/70"
                        >
                          <p className="text-xs font-semibold text-warm-800">{lab.test_name}</p>
                          <p className="text-[11px] text-cloudy">
                            {lab.lab_facility} ·{" "}
                            <span className={cn("font-bold uppercase", lab.status === "resulted" ? "text-accent" : "text-warm-500")}>
                              {lab.status}
                            </span>
                            {lab.results.some((r) => r.flag !== "normal") && (
                              <span className="ml-1 font-bold text-soft-red">· ABNORMAL</span>
                            )}
                          </p>
                        </Link>
                      ))}
                    </>
                  )}

                  {results.messages.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 border-y border-sand/60 bg-cream/70 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warm-500">
                        <MessageSquare size={10} /> Messages
                      </div>
                      {results.messages.map((msg) => (
                        <Link
                          key={msg.id}
                          href="/messages"
                          onClick={closeSearch}
                          className="block px-4 py-2.5 transition hover:bg-cream/70"
                        >
                          <p className="text-xs font-semibold text-warm-800 truncate">{msg.content.slice(0, 60)}{msg.content.length > 60 ? "…" : ""}</p>
                          <p className="text-[11px] text-cloudy">via {msg.channel} · {msg.read ? "read" : "unread"}</p>
                        </Link>
                      ))}
                    </>
                  )}

                  {results.referrals.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 border-y border-sand/60 bg-cream/70 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warm-500">
                        <ArrowRightCircle size={10} /> Referrals
                      </div>
                      {results.referrals.map((ref) => (
                        <Link
                          key={ref.id}
                          href="/referrals"
                          onClick={closeSearch}
                          className="block px-4 py-2.5 transition hover:bg-cream/70"
                        >
                          <p className="text-xs font-semibold text-warm-800">{ref.specialist_specialty}</p>
                          <p className="text-[11px] text-cloudy">{ref.reason} · {ref.status}</p>
                        </Link>
                      ))}
                    </>
                  )}

                  {results.claims.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 border-y border-sand/60 bg-cream/70 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warm-500">
                        <Receipt size={10} /> Claims
                      </div>
                      {results.claims.map((c) => (
                        <Link
                          key={c.id}
                          href="/billing"
                          onClick={closeSearch}
                          className="block px-4 py-2.5 transition hover:bg-cream/70"
                        >
                          <p className="text-xs font-semibold text-warm-800">{c.claim_number}</p>
                          <p className="text-[11px] text-cloudy">
                            CPT: {c.cpt_codes.join(", ")} ·{" "}
                            <span
                              className={cn(
                                "font-bold uppercase",
                                c.status === "denied" ? "text-soft-red" : c.status === "paid" ? "text-accent" : "text-warm-500"
                              )}
                            >
                              {c.status}
                            </span>
                          </p>
                        </Link>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="hidden items-center gap-1 rounded-xl border border-sand/50 bg-cream/50 px-1 py-1 xl:flex">
          <QuickAction href="/scheduling" icon={Calendar} label="Book" />
          <QuickAction href="/billing" icon={Receipt} label="Bills" />
          <QuickAction href="/prescriptions" icon={Pill} label="Meds" />
        </div>

        <div className="flex items-center gap-2">
          {isConnected && profile && (
            <div className="hidden items-center gap-1.5 rounded-xl border border-accent/20 bg-accent/8 px-2.5 py-1.5 lg:flex">
              <div className="h-4 w-4 rounded-full bg-accent/20 flex items-center justify-center">
                <UserCircle size={11} className="text-accent" />
              </div>
              <span className="text-[11px] font-semibold text-accent">
                {profile.onboardingComplete ? profile.fullName?.split(" ")[0] || "Active" : "Linked"}
              </span>
            </div>
          )}

          {isConnected && isNewUser && (
            <Link
              href="/onboarding"
              className="hidden items-center gap-1.5 rounded-xl border border-terra/25 bg-terra/10 px-3 py-1.5 text-[11px] font-semibold text-terra transition hover:bg-terra/16 lg:flex"
            >
              <Sparkles size={10} /> Setup
            </Link>
          )}

          <Link
            href="/messages"
            aria-label="Notifications"
            className="relative rounded-xl border border-transparent p-2 transition hover:border-sand/60 hover:bg-cream/70"
          >
            <Bell size={17} className="text-warm-500" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-terra px-1 text-[8px] font-bold text-white">
                {unread}
              </span>
            )}
          </Link>

          <div className="border-l border-sand/60 pl-2.5">
          {careTeamSession?.canAccessCareTeam && (
            <Link
              href="/dashboard/care-team"
              aria-label="AI Care Team Command Center"
              className="relative rounded-xl border border-transparent p-2 transition hover:border-sand/80 hover:bg-cream/70"
            >
              <Bot size={18} className="text-warm-600" />
              {careTeamSession.needsInputCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[10px] w-[10px] rounded-full bg-soft-blue shadow-[0_0_0_3px_rgba(96,182,255,0.24)]" />
              )}
            </Link>
          )}

          <div className="border-l border-sand/80 pl-3">
            <Wallet>
              <ConnectWallet className="!rounded-xl !bg-terra !px-3 !py-2 !text-xs !font-semibold !text-white !transition hover:!bg-terra-dark">
                <Avatar className="h-5 w-5" />
                <Name className="text-xs" />
              </ConnectWallet>
              <WalletDropdown className="!rounded-xl !border-sand !bg-pampas">
                <Identity className="px-4 pb-2 pt-3" hasCopyAddressOnClick>
                  <Avatar />
                  <Name className="font-semibold text-warm-800" />
                  <Address className="text-[10px] text-cloudy" />
                </Identity>
                <WalletDropdownLink icon="wallet" href="/wallet" className="!text-warm-700 hover:!bg-sand/40">
                  My Wallet
                </WalletDropdownLink>
                <WalletDropdownDisconnect className="!text-soft-red" />
              </WalletDropdown>
            </Wallet>
          </div>
        </div>
      </div>
    </header>
  )
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: LucideIcon
  label: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-warm-600 transition hover:bg-white hover:text-warm-800 hover:shadow-sm"
    >
      <Icon size={11} className="text-terra" />
      {label}
    </Link>
  )
}
