"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  AlertCircle,
  ArrowRightCircle,
  Bot,
  Calendar,
  ChevronDown,
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
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useWalletIdentity } from "@/lib/wallet-context"
import { cn } from "@/lib/utils"

const primaryNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Ask AI", icon: Bot },
]

const collapsibleSections = [
  {
    label: "Care",
    items: [
      { href: "/scheduling", label: "Appointments", icon: Calendar },
      { href: "/prescriptions", label: "Medications", icon: Pill },
      { href: "/screening", label: "AI Screening", icon: Heart },
      { href: "/lab-results", label: "Lab Results", icon: FlaskConical },
      { href: "/vitals", label: "Vitals", icon: Activity },
      { href: "/vaccinations", label: "Vaccinations", icon: Syringe },
      { href: "/referrals", label: "Referrals", icon: ArrowRightCircle },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/messages", label: "Messages", icon: MessageSquare },
      { href: "/billing", label: "Bills & Claims", icon: Receipt },
      { href: "/prior-auth", label: "Prior Auth", icon: ShieldCheck },
      { href: "/drug-prices", label: "Drug Prices", icon: DollarSign },
      { href: "/wallet", label: "Wallet", icon: WalletIcon },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/profile", label: "Profile", icon: UserCircle },
      { href: "/timeline", label: "Timeline", icon: Clock },
      { href: "/providers", label: "Care Network", icon: Stethoscope },
      { href: "/compliance-ledger", label: "Compliance Ledger", icon: ShieldCheck },
      { href: "/second-opinion", label: "Second Opinion", icon: ShieldCheck },
      { href: "/clinical-trials", label: "Clinical Trials", icon: FlaskConical },
      { href: "/emergency-card", label: "Emergency Card", icon: AlertCircle },
      { href: "/join-network", label: "Join Network", icon: UserPlus },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { snapshot } = useLiveSnapshot()
  const { isConnected, profile } = useWalletIdentity()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {}
    try {
      const saved = localStorage.getItem("openrx:sidebar-sections")
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const patientName = isConnected ? (profile?.fullName || snapshot.patient?.full_name || "") : ""
  const hasPatient = isConnected && !!patientName

  const unreadCount = snapshot.messages.filter((m) => !m.read).length

  const toggleSection = (label: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [label]: !prev[label] }
      try { localStorage.setItem("openrx:sidebar-sections", JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Auto-expand section if current path is inside it
  useEffect(() => {
    for (const section of collapsibleSections) {
      if (section.items.some((item) => pathname === item.href || pathname?.startsWith(item.href + "/"))) {
        setOpenSections((prev) => ({ ...prev, [section.label]: true }))
      }
    }
  }, [pathname])

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

  // Focus trap for mobile sidebar
  useEffect(() => {
    if (!mobileOpen) return
    const sidebar = document.querySelector<HTMLElement>("[data-mobile-sidebar]")
    if (!sidebar) return
    const focusable = sidebar.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first.focus()
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", trap)
    return () => document.removeEventListener("keydown", trap)
  }, [mobileOpen])

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/")

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <BrandMark size="sm" />
          <BrandWordmark
            className="min-w-0"
            titleClassName="text-[15px] font-semibold text-primary"
            subtitleClassName="text-muted"
          />
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="rounded-nav p-1.5 text-muted transition hover:bg-surface hover:text-primary lg:hidden"
        >
          <X size={15} />
        </button>
      </div>

      {/* Patient card */}
      {hasPatient && (
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal/10 text-sm font-semibold text-teal">
              {patientName.charAt(0) || "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-primary">{patientName}</p>
              <p className="text-[11px] text-muted">Connected</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-3" aria-label="Main navigation">
        {/* Primary nav */}
        <div className="space-y-0.5">
          {primaryNav.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-nav px-3 py-2.5 text-[13px] font-medium transition",
                  active
                    ? "bg-teal/8 text-teal font-semibold"
                    : "text-secondary hover:bg-surface hover:text-primary"
                )}
              >
                {active && <span className="absolute inset-y-1.5 left-0.5 w-[2px] rounded-full bg-teal" />}
                <item.icon size={16} className={active ? "text-teal" : "text-muted group-hover:text-secondary"} strokeWidth={1.5} />
                <span className="flex-1">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Collapsible sections */}
        {collapsibleSections.map((section) => {
          const isOpen = openSections[section.label] || false
          const hasActiveChild = section.items.some((item) => isActive(item.href))

          return (
            <div key={section.label} className="mt-3">
              <button
                onClick={() => toggleSection(section.label)}
                className="flex w-full items-center justify-between rounded-nav px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted transition hover:text-secondary"
              >
                {section.label}
                <ChevronDown
                  size={12}
                  className={cn("transition-transform", isOpen && "rotate-180")}
                />
              </button>

              {(isOpen || hasActiveChild) && (
                <div className="mt-0.5 space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-nav px-3 py-2 text-[13px] font-medium transition",
                          active
                            ? "bg-teal/8 text-teal font-semibold"
                            : "text-secondary hover:bg-surface hover:text-primary"
                        )}
                      >
                        {active && <span className="absolute inset-y-1.5 left-0.5 w-[2px] rounded-full bg-teal" />}
                        <item.icon size={15} className={active ? "text-teal" : "text-muted group-hover:text-secondary"} strokeWidth={1.5} />
                        <span className="flex-1">{item.label}</span>
                        {item.href === "/messages" && unreadCount > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-coral/10 px-1.5 text-[10px] font-semibold text-coral">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border/60 px-3 py-3">
        <Link
          href="/chat"
          className="flex items-center gap-3 rounded-nav border border-border bg-white px-3 py-2.5 text-sm font-medium text-primary transition hover:border-teal/30"
        >
          <Bot size={16} className="text-teal" strokeWidth={1.5} />
          <span className="flex-1">Open concierge</span>
        </Link>
        <div className="mt-2 flex gap-2">
          <Link
            href="/"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-nav border border-border bg-white px-2 py-2 text-[11px] font-medium text-secondary transition hover:text-primary"
          >
            <ExternalLink size={11} />
            Site
          </Link>
          <Link
            href="/privacy-explained"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-nav border border-border bg-white px-2 py-2 text-[11px] font-medium text-secondary transition hover:text-primary"
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
        className="fixed left-4 top-4 z-50 rounded-nav border border-border bg-white p-2.5 text-secondary shadow-card transition hover:text-primary lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        data-mobile-sidebar
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[256px] flex-col border-r border-border/60 bg-white transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[256px] flex-col border-r border-border/60 bg-white lg:flex">
        {sidebarContent}
      </aside>
    </>
  )
}
