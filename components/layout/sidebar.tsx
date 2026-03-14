"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Calendar,
  Receipt,
  Pill,
  DollarSign,
  Wallet as WalletIcon,
  MessageSquare,
  Bot,
  ExternalLink,
  Menu,
  X,
  Stethoscope,
  Heart,
  FlaskConical,
  Activity,
  Syringe,
  ArrowRightCircle,
  AlertCircle,
  ShieldCheck,
  UserPlus,
  Workflow,
  Clock,
  Cpu,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"

const navSections = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Home", icon: LayoutDashboard },
      { href: "/timeline", label: "Health Timeline", icon: Clock },
      { href: "/onboarding", label: "Get Started", icon: Heart },
    ],
  },
  {
    label: "Health",
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
    label: "Finance",
    items: [
      { href: "/billing", label: "Bills & Claims", icon: Receipt },
      { href: "/compliance-ledger", label: "Compliance Ledger", icon: ShieldCheck },
      { href: "/drug-prices", label: "Drug Prices", icon: DollarSign },
      { href: "/prior-auth", label: "Prior Auth", icon: ShieldCheck, badgeKey: "pendingPA" as const },
      { href: "/wallet", label: "Wallet", icon: WalletIcon },
    ],
  },
  {
    label: "Agents",
    items: [
      { href: "/hermes", label: "Hermes Agent", icon: Cpu },
      { href: "/projects/default/visualize", label: "Codebase Mapper", icon: Workflow },
      { href: "/chat", label: "Ask AI", icon: Bot },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/providers", label: "Care Network", icon: Stethoscope },
      { href: "/join-network", label: "Join Network", icon: UserPlus },
      { href: "/second-opinion", label: "Second Opinion", icon: ShieldCheck },
      { href: "/clinical-trials", label: "Clinical Trials", icon: FlaskConical },
      { href: "/messages", label: "Messages", icon: MessageSquare, badgeKey: "unreadMessages" as const },
      { href: "/emergency-card", label: "Emergency Card", icon: AlertCircle },
    ],
  },
]

type BadgeKey = "unreadMessages" | "pendingRefills" | "pendingPA" | "pendingLabs"

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { snapshot } = useLiveSnapshot()
  const badges = {
    unreadMessages: snapshot.messages.filter((message) => !message.read).length,
    pendingRefills: snapshot.prescriptions.filter((prescription) => prescription.status === "pending-refill").length,
    pendingPA: snapshot.priorAuths.filter(
      (priorAuth) => priorAuth.status === "pending" || priorAuth.status === "submitted"
    ).length,
    pendingLabs: snapshot.labResults.filter((lab) => lab.status === "pending").length,
  }

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false)
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  const sidebarContent = (
    <>
      {/* Logo area */}
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-terra via-terra to-terra-dark shadow-terra-glow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 4v16M4 12h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            {/* Subtle glow ring */}
            <div className="absolute inset-0 rounded-xl ring-1 ring-terra/30" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold tracking-tight text-white">OpenRx</h1>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">Care OS</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-1 text-white/30 transition hover:bg-white/10 hover:text-white/60 lg:hidden"
          >
            <X size={15} />
          </button>
        </div>

        {/* Patient chip */}
        {snapshot.patient && (
          <div className="mt-4 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-terra/40 to-accent/40 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-white/80">
                  {snapshot.patient.full_name.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-white/85 leading-tight">
                  {snapshot.patient.full_name}
                </p>
                <p className="text-[10px] text-white/35 leading-tight mt-0.5">{snapshot.patient.insurance_provider || "Patient"}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-3" aria-label="Main navigation">
        {navSections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-5" : ""}>
            {section.label && (
              <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.22em] text-white/25">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const matchAlso = "matchAlso" in item ? (item.matchAlso as string[]) : undefined
                const active =
                  pathname === item.href ||
                  pathname?.startsWith(item.href + "/") ||
                  matchAlso?.some((m) => pathname === m || pathname?.startsWith(m + "/"))
                const badgeKey = "badgeKey" in item ? (item.badgeKey as BadgeKey) : undefined
                const badgeCount = badgeKey ? badges[badgeKey] : 0

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "nav-active-bar group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12.5px] font-medium transition-all duration-150",
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:bg-white/6 hover:text-white/80"
                    )}
                  >
                    <item.icon
                      size={14}
                      className={cn(
                        "shrink-0 transition-colors",
                        active ? "text-terra" : "text-white/35 group-hover:text-white/60"
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badgeCount > 0 && (
                      <span className={cn(
                        "flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold",
                        active ? "bg-terra/30 text-terra" : "bg-white/12 text-white/60"
                      )}>
                        {badgeCount}
                      </span>
                    )}
                    {active && (
                      <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-terra shadow-[0_0_8px_rgba(240,90,61,0.7)]" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/8 px-3 py-3 space-y-1">
        <Link
          href="/chat"
          className="flex items-center gap-2.5 rounded-xl border border-terra/25 bg-terra/12 px-3 py-2.5 text-[12px] font-semibold text-terra transition hover:bg-terra/20 hover:border-terra/40"
        >
          <Bot size={13} className="text-terra" />
          <span className="flex-1">AI Concierge</span>
          <span className="h-1.5 w-1.5 rounded-full bg-terra animate-glow-pulse" />
        </Link>
        <div className="flex gap-1">
          <Link
            href="/"
            className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium text-white/28 transition hover:bg-white/6 hover:text-white/55"
          >
            <ExternalLink size={11} />
            Site
          </Link>
          <Link
            href="/privacy-explained"
            className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium text-white/28 transition hover:bg-white/6 hover:text-white/55"
          >
            <ShieldCheck size={11} />
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
        className="fixed left-4 top-4 z-50 rounded-xl border border-white/15 bg-midnight p-2 text-white/60 shadow-sidebar transition hover:bg-white/10 hover:text-white lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={19} />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col bg-midnight shadow-sidebar transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[248px] flex-col bg-midnight shadow-sidebar lg:flex">
        {sidebarContent}
      </aside>
    </>
  )
}
