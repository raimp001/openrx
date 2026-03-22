"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  AlertCircle,
  ArrowRightCircle,
  Bot,
  Calendar,
  Clock,
  DollarSign,
  ExternalLink,
  FlaskConical,
  Heart,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Pill,
  Receipt,
  ShieldCheck,
  Stethoscope,
  Syringe,
  UserCircle,
  UserPlus,
  Wallet as WalletIcon,
  Workflow,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import { useCareTeamSession } from "@/lib/hooks/use-care-team-session"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn, formatDate, formatTime } from "@/lib/utils"

const baseNavSections = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Home", icon: LayoutDashboard },
      { href: "/profile", label: "My Profile", icon: UserCircle },
      { href: "/timeline", label: "Health Timeline", icon: Clock },
      { href: "/onboarding", label: "Get Started", icon: Heart },
    ],
  },
  {
    label: "Care",
    items: [
      { href: "/scheduling", label: "Appointments", icon: Calendar },
      { href: "/screening", label: "AI Screening", icon: Heart },
      { href: "/prescriptions", label: "Medications", icon: Pill, matchAlso: ["/pharmacy"], badgeKey: "pendingRefills" as const },
      { href: "/lab-results", label: "Lab Results", icon: FlaskConical, badgeKey: "pendingLabs" as const },
      { href: "/vitals", label: "Vital Signs", icon: Activity },
      { href: "/vaccinations", label: "Vaccinations", icon: Syringe },
      { href: "/referrals", label: "Referrals", icon: ArrowRightCircle },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/billing", label: "Bills & Claims", icon: Receipt },
      { href: "/compliance-ledger", label: "Compliance Ledger", icon: ShieldCheck },
      { href: "/drug-prices", label: "Drug Prices", icon: DollarSign },
      { href: "/prior-auth", label: "Prior Auth", icon: ShieldCheck, badgeKey: "pendingPA" as const },
      { href: "/wallet", label: "Wallet", icon: WalletIcon },
    ],
  },
  {
    label: "Explore",
    items: [
      { href: "/providers", label: "Care Network", icon: Stethoscope },
      { href: "/join-network", label: "Join Network", icon: UserPlus },
      { href: "/projects/default/visualize", label: "Codebase Mapper", icon: Workflow },
      { href: "/second-opinion", label: "Second Opinion", icon: ShieldCheck },
      { href: "/clinical-trials", label: "Clinical Trials", icon: FlaskConical },
      { href: "/messages", label: "Messages", icon: MessageSquare, badgeKey: "unreadMessages" as const },
      { href: "/emergency-card", label: "Emergency Card", icon: AlertCircle },
      { href: "/chat", label: "Ask AI", icon: Bot },
    ],
  },
]

type BadgeKey = "unreadMessages" | "pendingRefills" | "pendingPA" | "pendingLabs"

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { snapshot } = useLiveSnapshot()
  const { session: careTeamSession } = useCareTeamSession({ pollMs: 15000 })

  const careTeamVisible = Boolean(careTeamSession?.canAccessCareTeam)
  const badges = {
    unreadMessages: snapshot.messages.filter((message) => !message.read).length,
    pendingRefills: snapshot.prescriptions.filter((prescription) => prescription.status === "pending-refill").length,
    pendingPA: snapshot.priorAuths.filter(
      (priorAuth) => priorAuth.status === "pending" || priorAuth.status === "submitted"
    ).length,
    pendingLabs: snapshot.labResults.filter((lab) => lab.status === "pending").length,
  }

  const nextAppointment = useMemo(() => {
    return [...snapshot.appointments]
      .filter((appointment) => new Date(appointment.scheduled_at).getTime() >= Date.now())
      .sort((left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime())[0]
  }, [snapshot.appointments])

  const navSections = useMemo(() => {
    const sections = baseNavSections.map((section) => ({
      label: section.label,
      items: [...section.items],
    }))
    if (careTeamVisible) {
      const careSection = sections.find((section) => section.label === "Overview")
      if (careSection && !careSection.items.some((item) => item.href === "/dashboard/care-team")) {
        careSection.items.splice(1, 0, {
          href: "/dashboard/care-team",
          label: "AI Care Team",
          icon: Bot,
        })
      }
    }
    return sections
  }, [careTeamVisible])

  const attentionCount =
    badges.pendingLabs +
    badges.pendingPA +
    badges.pendingRefills +
    (careTeamSession?.needsInputCount ?? 0)

  const summaryCards = [
    { label: "Attention", value: attentionCount, tone: attentionCount > 0 ? "text-terra-dark" : "text-warm-700" },
    { label: "Visits", value: snapshot.appointments.length, tone: "text-warm-800" },
    { label: "Messages", value: badges.unreadMessages, tone: badges.unreadMessages > 0 ? "text-accent" : "text-warm-700" },
  ]

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false)
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  const sidebarContent = (
    <>
      <div className="relative overflow-hidden border-b border-sand/70 px-5 pb-5 pt-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(224,91,67,0.14),transparent_38%),radial-gradient(circle_at_100%_16%,rgba(22,142,104,0.1),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.7),transparent)]" />
        <div className="relative flex items-center gap-3">
          <BrandMark className="shadow-[0_10px_30px_rgba(224,91,67,0.18)]" size="sm" />
          <BrandWordmark
            className="min-w-0"
            titleClassName="text-[17px] font-semibold text-warm-800"
            subtitleClassName="text-warm-500"
          />
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="ml-auto rounded-xl p-1.5 text-warm-500 transition hover:bg-warm-800/6 hover:text-warm-800 lg:hidden"
          >
            <X size={15} />
          </button>
        </div>

        <div className="relative mt-5 rounded-[26px] border border-sand/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(249,243,234,0.9))] p-4 shadow-[0_18px_40px_rgba(17,34,30,0.08)]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,rgba(224,91,67,0.12),rgba(242,132,103,0.18))] ring-1 ring-terra/12">
              <span className="text-sm font-semibold text-warm-800">
                {(snapshot.patient?.full_name || "OpenRx").charAt(0)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cloudy/90">Patient pulse</p>
              <p className="truncate text-sm font-semibold text-warm-800">
                {snapshot.patient?.full_name || "Connect records to personalize"}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-warm-600">
                {nextAppointment
                  ? `Next visit ${formatDate(nextAppointment.scheduled_at)} at ${formatTime(nextAppointment.scheduled_at)}`
                  : "Your care plan, screening, coverage, and messaging live here."}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-sand/70 bg-pampas/88 px-2.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
              >
                <p className={cn("text-base font-semibold leading-none", card.tone)}>{card.value}</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-cloudy/85">{card.label}</p>
              </div>
            ))}
          </div>

          {careTeamSession?.needsInputCount ? (
            <Link
              href="/dashboard/care-team"
              className="mt-4 flex items-center gap-2 rounded-2xl border border-soft-blue/20 bg-soft-blue/8 px-3 py-2 text-[11px] font-semibold text-soft-blue transition hover:bg-soft-blue/12"
            >
              <span className="h-2 w-2 rounded-full bg-soft-blue shadow-[0_0_0_6px_rgba(42,124,167,0.15)]" />
              {careTeamSession.needsInputCount} agent item{careTeamSession.needsInputCount > 1 ? "s" : ""} waiting
            </Link>
          ) : null}
        </div>
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto px-4 py-4" aria-label="Main navigation">
        {navSections.map((section) => (
          <section key={section.label} className="mb-5">
            <div className="mb-2 flex items-center gap-2 px-2">
              <span className="h-px flex-1 bg-sand/70" />
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-cloudy/95">{section.label}</p>
              <span className="h-px flex-1 bg-sand/70" />
            </div>

            <div className="space-y-1.5">
              {section.items.map((item) => {
                const matchAlso = "matchAlso" in item ? (item.matchAlso as string[]) : undefined
                const active =
                  pathname === item.href ||
                  pathname?.startsWith(item.href + "/") ||
                  matchAlso?.some((entry) => pathname === entry || pathname?.startsWith(entry + "/"))
                const badgeKey = "badgeKey" in item ? (item.badgeKey as BadgeKey | undefined) : undefined
                const badgeCount =
                  item.href === "/dashboard/care-team"
                    ? careTeamSession?.needsInputCount ?? 0
                    : badgeKey
                    ? badges[badgeKey]
                    : 0

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-[12.5px] font-medium transition-all duration-200",
                      active
                        ? "border-terra/20 bg-[linear-gradient(180deg,rgba(224,91,67,0.12),rgba(255,255,255,0.9))] text-warm-800 shadow-[0_12px_26px_rgba(17,34,30,0.08)]"
                        : "border-transparent text-warm-700 hover:border-sand/70 hover:bg-white/82 hover:text-warm-800"
                    )}
                  >
                    {active ? (
                      <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-[linear-gradient(180deg,#f4ae8d,#e05b43)]" />
                    ) : null}
                    <item.icon
                      size={15}
                      className={cn(
                        "shrink-0 transition-colors",
                        active ? "text-terra-dark" : "text-cloudy group-hover:text-terra-dark"
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {badgeCount > 0 ? (
                      <span
                        className={cn(
                          "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[9px] font-bold",
                          active ? "bg-terra/14 text-terra-dark" : "bg-warm-800/6 text-warm-700"
                        )}
                      >
                        {badgeCount}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="border-t border-sand/70 px-4 py-4">
        <Link
          href="/chat"
          className="flex items-center gap-3 rounded-[22px] border border-terra/18 bg-[linear-gradient(180deg,rgba(224,91,67,0.12),rgba(255,252,248,0.92))] px-4 py-3 text-sm font-semibold text-warm-800 transition hover:border-terra/28 hover:bg-[linear-gradient(180deg,rgba(224,91,67,0.16),rgba(255,252,248,0.96))]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/90 text-terra-dark shadow-sm">
            <Bot size={15} />
          </span>
          <span className="flex-1">AI Concierge</span>
          <span className="h-2 w-2 rounded-full bg-terra animate-glow-pulse" />
        </Link>

        <div className="mt-3 flex gap-2">
          <Link
            href="/"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-sand/70 bg-white/72 px-3 py-2.5 text-[11px] font-semibold text-warm-700 transition hover:bg-white hover:text-warm-800"
          >
            <ExternalLink size={12} />
            Site
          </Link>
          <Link
            href="/privacy-explained"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-sand/70 bg-white/72 px-3 py-2.5 text-[11px] font-semibold text-warm-700 transition hover:bg-white hover:text-warm-800"
          >
            <ShieldCheck size={12} />
            Privacy
          </Link>
        </div>
      </div>
    </>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-2xl border border-sand/80 bg-pampas/95 p-2.5 text-warm-700 shadow-soft-card transition hover:bg-white hover:text-warm-800 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[272px] flex-col border-r border-sand/70 bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(248,241,231,0.97))] shadow-[12px_0_50px_rgba(17,34,30,0.09)] transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[272px] flex-col border-r border-sand/70 bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(248,241,231,0.97))] shadow-[12px_0_50px_rgba(17,34,30,0.09)] lg:flex">
        {sidebarContent}
      </aside>
    </>
  )
}
