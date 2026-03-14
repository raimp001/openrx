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
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { getPatientMessages, getPatientPrescriptions, priorAuths, getPatientLabResults } from "@/lib/seed-data"
import { currentUser } from "@/lib/current-user"

function useSidebarBadges() {
  const myMessages = getPatientMessages(currentUser.id)
  const unreadMessages = myMessages.filter((m) => !m.read).length

  const myPrescriptions = getPatientPrescriptions(currentUser.id)
  const pendingRefills = myPrescriptions.filter((p) => p.status === "pending-refill").length

  const myPA = priorAuths.filter((p) => p.patient_id === currentUser.id)
  const pendingPA = myPA.filter((p) => p.status === "pending" || p.status === "submitted").length

  const myLabs = getPatientLabResults(currentUser.id)
  const pendingLabs = myLabs.filter((l) => l.status === "pending").length

  return { unreadMessages, pendingRefills, pendingPA, pendingLabs }
}

const navSections = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Home", icon: LayoutDashboard },
      { href: "/onboarding", label: "Get Started", icon: Heart },
    ],
  },
  {
    label: "Health",
    items: [
      { href: "/scheduling", label: "Appointments", icon: Calendar },
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
      { href: "/drug-prices", label: "Drug Prices", icon: DollarSign },
      { href: "/prior-auth", label: "Prior Auth", icon: ShieldCheck, badgeKey: "pendingPA" as const },
      { href: "/prior-auth/audit", label: "PA Audit Trail", icon: ClipboardList },
      { href: "/wallet", label: "Wallet", icon: WalletIcon },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/providers", label: "Find a Doctor", icon: Stethoscope },
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
  const badges = useSidebarBadges()

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
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sand">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-terra to-terra-dark flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 4v16M4 12h16"
              stroke="#060D1B"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-base font-bold text-warm-800 font-serif tracking-wide">
            OpenRx
          </h1>
          <p className="text-[8px] font-semibold text-cloudy uppercase tracking-[2px]">
            Powered by OpenClaw
          </p>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="ml-auto lg:hidden p-1 rounded-lg hover:bg-pampas transition"
        >
          <X size={18} className="text-warm-600" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto" aria-label="Main navigation">
        {navSections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-3" : ""}>
            {section.label && (
              <p className="px-3 py-1 text-[9px] font-bold text-cloudy uppercase tracking-[1.5px]">
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
                      "flex items-center gap-3 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all",
                      active
                        ? "bg-terra/8 text-terra font-semibold"
                        : "text-warm-600 hover:text-warm-800 hover:bg-pampas"
                    )}
                  >
                    <item.icon
                      size={14}
                      className={active ? "text-terra" : "text-warm-500"}
                    />
                    <span className="flex-1">{item.label}</span>
                    {badgeCount > 0 && (
                      <span className={cn(
                        "text-[9px] font-bold rounded-full flex items-center justify-center min-w-[16px] h-[16px] px-1",
                        active
                          ? "bg-terra text-white"
                          : "bg-terra/15 text-terra"
                      )}>
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-sand">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-cloudy hover:text-terra hover:bg-terra/5 transition-all"
        >
          <ExternalLink size={13} />
          Home
        </Link>
        <div className="mt-2 mx-3 px-3 py-1.5 rounded-lg bg-terra/10 border border-terra/20">
          <p className="text-[9px] font-bold text-terra uppercase tracking-wider">
            Demo Account
          </p>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-pampas rounded-xl border border-sand shadow-sm hover:shadow-md transition"
        aria-label="Open navigation"
      >
        <Menu size={20} className="text-warm-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-[260px] border-r border-sand bg-pampas flex flex-col transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-[220px] border-r border-sand bg-pampas flex-col">
        {sidebarContent}
      </aside>
    </>
  )
}
