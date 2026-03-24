"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Bell,
  Bot,
  Calendar,
  Command,
  FlaskConical,
  LayoutDashboard,
  MessageSquare,
  Pill,
  Receipt,
  Search,
  Sparkles,
  UserCircle,
  X,
  ArrowRightCircle,
  Activity,
  Syringe,
  Clock,
  type LucideIcon,
} from "lucide-react"
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
  WalletDropdownLink,
} from "@coinbase/onchainkit/wallet"
import { Address, Avatar, Name, Identity } from "@coinbase/onchainkit/identity"
import { useWalletIdentity } from "@/lib/wallet-context"
import { formatDate, formatTime } from "@/lib/utils"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useCareTeamSession } from "@/lib/hooks/use-care-team-session"

export default function Topbar() {
  const { isConnected, profile, isNewUser } = useWalletIdentity()
  const { snapshot, getPhysician } = useLiveSnapshot()
  const { session: careTeamSession } = useCareTeamSession({ pollMs: 10000 })
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const myMessages = snapshot.messages
  const unread = myMessages.filter((message) => !message.read).length
  const myClaims = snapshot.claims
  const myPrescriptions = snapshot.prescriptions
  const myAppointments = snapshot.appointments
  const myLabResults = snapshot.labResults
  const myReferrals = snapshot.referrals

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
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || (event.target as HTMLElement).isContentEditable

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
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: ["home", "dashboard", "overview"] },
      { label: "My Profile", href: "/profile", icon: UserCircle, keywords: ["profile", "account", "personal", "info", "insurance", "history"] },
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
    ],
    []
  )

  const results = useMemo(() => {
    if (!query || query.length < 2) return null
    const lowered = query.toLowerCase()

    const navigation = quickNav
      .filter(
        (item) =>
          item.label.toLowerCase().includes(lowered) || item.keywords.some((keyword) => keyword.includes(lowered))
      )
      .slice(0, 4)

    const claims = myClaims
      .filter(
        (claim) =>
          claim.claim_number.toLowerCase().includes(lowered) ||
          claim.cpt_codes.some((code) => code.includes(lowered)) ||
          claim.icd_codes.some((code) => code.toLowerCase().includes(lowered))
      )
      .slice(0, 3)

    const prescriptions = myPrescriptions
      .filter(
        (prescription) =>
          prescription.medication_name.toLowerCase().includes(lowered) ||
          prescription.dosage.toLowerCase().includes(lowered) ||
          prescription.pharmacy.toLowerCase().includes(lowered)
      )
      .slice(0, 3)

    const appointments = myAppointments
      .filter((appointment) => {
        const physician = getPhysician(appointment.physician_id)
        return (
          appointment.reason.toLowerCase().includes(lowered) ||
          appointment.type.toLowerCase().includes(lowered) ||
          physician?.full_name.toLowerCase().includes(lowered) ||
          physician?.specialty.toLowerCase().includes(lowered)
        )
      })
      .slice(0, 3)

    const labs = myLabResults
      .filter(
        (lab) =>
          lab.test_name.toLowerCase().includes(lowered) ||
          lab.lab_facility.toLowerCase().includes(lowered) ||
          lab.category.toLowerCase().includes(lowered) ||
          lab.results.some((result) => result.name.toLowerCase().includes(lowered))
      )
      .slice(0, 3)

    const messages = myMessages.filter((message) => message.content.toLowerCase().includes(lowered)).slice(0, 2)

    const referrals = myReferrals
      .filter(
        (referral) =>
          referral.specialist_specialty.toLowerCase().includes(lowered) ||
          referral.reason.toLowerCase().includes(lowered) ||
          (referral.specialist_name || "").toLowerCase().includes(lowered)
      )
      .slice(0, 2)

    const total =
      navigation.length +
      claims.length +
      prescriptions.length +
      appointments.length +
      labs.length +
      messages.length +
      referrals.length

    return { navigation, claims, prescriptions, appointments, labs, messages, referrals, total }
  }, [getPhysician, myAppointments, myClaims, myLabResults, myMessages, myPrescriptions, myReferrals, query, quickNav])

  const closeSearch = useCallback(() => {
    setIsOpen(false)
    setQuery("")
  }, [])

  const nextAppointment = useMemo(() => {
    return [...myAppointments]
      .filter((appointment) => new Date(appointment.scheduled_at).getTime() >= Date.now())
      .sort((left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime())[0]
  }, [myAppointments])

  const summaryItems = [
    nextAppointment ? `Next visit ${formatDate(nextAppointment.scheduled_at)}` : "No visit scheduled yet",
    unread > 0 ? `${unread} unread message${unread > 1 ? "s" : ""}` : "Inbox clear",
    careTeamSession?.needsInputCount
      ? `${careTeamSession.needsInputCount} care-team review item${careTeamSession.needsInputCount > 1 ? "s" : ""}`
      : "Care team synchronized",
  ]

  return (
    <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="app-shell-panel overflow-visible">
        <div className="flex flex-col gap-5 px-4 py-4 lg:px-6 lg:py-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow-pill">OpenRx workspace</span>
                <span className="text-[11px] font-medium text-warm-500">
                  {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </span>
                {profile?.fullName ? (
                  <span className="text-[11px] font-medium text-warm-500">· {profile.fullName.split(" ")[0]}</span>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                <h1 className="max-w-3xl text-[clamp(1.9rem,2.8vw,2.8rem)] font-semibold tracking-[-0.07em] text-warm-800">
                  Care, prevention, and follow-up in one quiet workspace.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-warm-600">
                  Search visits, medications, labs, claims, messages, and referrals without switching context.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {summaryItems.map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 text-[12px] font-medium text-warm-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-terra/70" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:max-w-[36rem] xl:justify-end">
              {isConnected && isNewUser ? (
                <Link
                  href="/onboarding"
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-terra/15 bg-white/90 px-4 text-[11px] font-semibold text-terra-dark transition hover:border-terra/30"
                >
                  <Sparkles size={11} />
                  Finish setup
                </Link>
              ) : null}

              <QuickAction href="/scheduling" icon={Calendar} label="Book visit" />
              <QuickAction href="/messages" icon={Bell} label={unread > 0 ? `Inbox (${unread})` : "Inbox"} />

              {careTeamSession?.canAccessCareTeam ? (
                <Link
                  href="/dashboard/care-team"
                  aria-label="AI Care Team Command Center"
                  className="relative inline-flex h-11 items-center gap-2 rounded-2xl border border-black/[0.07] bg-white/90 px-4 text-[11px] font-semibold text-warm-700 transition hover:border-soft-blue/25 hover:text-warm-900"
                >
                  <Bot size={15} className="text-soft-blue" />
                  <span className="hidden sm:inline">Care team</span>
                  {careTeamSession.needsInputCount > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-soft-blue px-1 text-[9px] font-bold text-white shadow-[0_0_0_4px_rgba(42,124,167,0.12)]">
                      {careTeamSession.needsInputCount}
                    </span>
                  ) : null}
                </Link>
              ) : null}

              <Wallet>
                <ConnectWallet className="!h-11 !rounded-2xl !border !border-warm-800/10 !bg-warm-800 !px-4 !text-xs !font-semibold !text-white !shadow-[0_14px_28px_rgba(17,34,30,0.16)] !transition hover:!bg-warm-700">
                  <Avatar className="h-5 w-5" />
                  <Name className="text-xs" />
                </ConnectWallet>
                <WalletDropdown className="!rounded-[22px] !border-sand/70 !bg-pampas !shadow-premium">
                  <Identity className="px-4 pb-2 pt-3" hasCopyAddressOnClick>
                    <Avatar />
                    <Name className="font-semibold text-warm-800" />
                    <Address className="text-[10px] text-cloudy" />
                  </Identity>
                  <WalletDropdownLink icon="wallet" href="/wallet" className="!text-warm-700 hover:!bg-cream/70">
                    My Wallet
                  </WalletDropdownLink>
                  <WalletDropdownDisconnect className="!text-soft-red" />
                </WalletDropdown>
              </Wallet>
            </div>
          </div>

          <div ref={searchRef} className="relative w-full max-w-4xl">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-cloudy/80" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setIsOpen(true)
              }}
              onFocus={() => query.length >= 2 && setIsOpen(true)}
              placeholder="Search meds, labs, visits, claims, referrals, or jump anywhere"
              className="w-full rounded-[24px] border border-black/[0.08] bg-white/94 py-3.5 pl-11 pr-16 text-[13px] text-warm-800 placeholder:text-cloudy/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_28px_rgba(17,34,30,0.05)] transition focus:border-terra/30 focus:bg-white focus:shadow-[0_0_0_4px_rgba(224,91,67,0.08),0_18px_34px_rgba(17,34,30,0.08)]"
            />
            {query ? (
              <button
                onClick={() => {
                  setQuery("")
                  setIsOpen(false)
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-cloudy/60 transition hover:text-warm-700"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            ) : (
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full border border-black/[0.07] bg-[#f6f2ea] px-2 py-1 text-[9px] font-semibold text-cloudy/70 lg:flex">
                <Command size={9} /> K
              </span>
            )}

            {isOpen && results ? (
              <div className="absolute left-0 right-0 top-full z-50 mt-3 overflow-hidden rounded-[24px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,244,235,0.96))] shadow-premium">
                {results.total === 0 ? (
                  <div className="px-5 py-4 text-sm text-warm-500">No results for “{query}”.</div>
                ) : (
                  <div className="max-h-[32rem] overflow-y-auto py-2">
                    {results.navigation.length > 0 ? (
                      <SearchSection title="Navigate" icon={Search}>
                        <div className="flex flex-wrap gap-2 px-5 py-3">
                          {results.navigation.map((item) => {
                            const Icon = item.icon
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={closeSearch}
                                className="inline-flex items-center gap-2 rounded-full border border-sand/75 bg-white px-3 py-1.5 text-[11px] font-semibold text-warm-700 transition hover:border-terra/24 hover:bg-terra/5 hover:text-terra-dark"
                              >
                                <Icon size={11} className="text-terra" />
                                {item.label}
                              </Link>
                            )
                          })}
                        </div>
                      </SearchSection>
                    ) : null}

                    {results.appointments.length > 0 ? (
                      <SearchSection title="Appointments" icon={Calendar}>
                        {results.appointments.map((appointment) => {
                          const physician = getPhysician(appointment.physician_id)
                          return (
                            <SearchRow
                              key={appointment.id}
                              href="/scheduling"
                              title={appointment.reason}
                              subtitle={`${physician?.full_name || "Clinician"} · ${formatDate(appointment.scheduled_at)} ${formatTime(appointment.scheduled_at)}`}
                              onClick={closeSearch}
                            />
                          )
                        })}
                      </SearchSection>
                    ) : null}

                    {results.prescriptions.length > 0 ? (
                      <SearchSection title="Medications" icon={Pill}>
                        {results.prescriptions.map((prescription) => (
                          <SearchRow
                            key={prescription.id}
                            href="/prescriptions"
                            title={`${prescription.medication_name} ${prescription.dosage}`}
                            subtitle={`${prescription.frequency} · ${prescription.pharmacy} · ${prescription.status}`}
                            onClick={closeSearch}
                          />
                        ))}
                      </SearchSection>
                    ) : null}

                    {results.labs.length > 0 ? (
                      <SearchSection title="Lab Results" icon={FlaskConical}>
                        {results.labs.map((lab) => (
                          <SearchRow
                            key={lab.id}
                            href="/lab-results"
                            title={lab.test_name}
                            subtitle={`${lab.lab_facility} · ${lab.status}${lab.results.some((result) => result.flag !== "normal") ? " · abnormal" : ""}`}
                            onClick={closeSearch}
                          />
                        ))}
                      </SearchSection>
                    ) : null}

                    {results.messages.length > 0 ? (
                      <SearchSection title="Messages" icon={MessageSquare}>
                        {results.messages.map((message) => (
                          <SearchRow
                            key={message.id}
                            href="/messages"
                            title={`${message.content.slice(0, 64)}${message.content.length > 64 ? "…" : ""}`}
                            subtitle={`via ${message.channel} · ${message.read ? "read" : "unread"}`}
                            onClick={closeSearch}
                          />
                        ))}
                      </SearchSection>
                    ) : null}

                    {results.referrals.length > 0 ? (
                      <SearchSection title="Referrals" icon={ArrowRightCircle}>
                        {results.referrals.map((referral) => (
                          <SearchRow
                            key={referral.id}
                            href="/referrals"
                            title={referral.specialist_specialty}
                            subtitle={`${referral.reason} · ${referral.status}`}
                            onClick={closeSearch}
                          />
                        ))}
                      </SearchSection>
                    ) : null}

                    {results.claims.length > 0 ? (
                      <SearchSection title="Claims" icon={Receipt}>
                        {results.claims.map((claim) => (
                          <SearchRow
                            key={claim.id}
                            href="/billing"
                            title={claim.claim_number}
                            subtitle={`CPT ${claim.cpt_codes.join(", ")} · ${claim.status}`}
                            onClick={closeSearch}
                          />
                        ))}
                      </SearchSection>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
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
      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-black/[0.07] bg-white/90 px-4 text-[11px] font-semibold text-warm-700 transition hover:border-terra/20 hover:text-warm-900"
    >
      <Icon size={13} className="text-terra" />
      <span>{label}</span>
    </Link>
  )
}

function SearchSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <section className="py-1">
      <div className="flex items-center gap-2 border-y border-sand/60 bg-[linear-gradient(180deg,rgba(248,242,232,0.9),rgba(255,255,255,0.6))] px-5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-warm-500">
        <Icon size={11} className="text-terra" />
        {title}
      </div>
      {children}
    </section>
  )
}

function SearchRow({
  href,
  title,
  subtitle,
  onClick,
}: {
  href: string
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-5 py-3 transition hover:bg-cream/45"
    >
      <p className="text-sm font-semibold text-warm-800">{title}</p>
      <p className="mt-0.5 text-[11px] text-cloudy">{subtitle}</p>
    </Link>
  )
}
