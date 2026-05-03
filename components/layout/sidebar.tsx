"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bot, Heart, LayoutDashboard, Menu, MessageSquare, Stethoscope, UserCircle, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/chat", label: "Ask", icon: Bot, primary: true },
  { href: "/dashboard", label: "My care", icon: LayoutDashboard, primary: true },
  { href: "/screening", label: "Screenings", icon: Heart },
  { href: "/providers", label: "Find care", icon: Stethoscope },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/onboarding", label: "Setup", icon: UserCircle },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { snapshot } = useLiveSnapshot()
  const unreadCount = snapshot.messages.filter((message) => !message.read).length

  const visibleItems = useMemo(() => navItems, [])

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

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`)

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-4 py-4 lg:justify-center lg:px-2">
        <Link href="/" className="flex items-center gap-3" aria-label="OpenRx home">
          <BrandMark size="sm" />
          <BrandWordmark
            className="min-w-0 lg:hidden"
            titleClassName="text-[15px] font-semibold text-primary"
            subtitle={false}
          />
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="rounded-full p-2 text-muted transition hover:bg-white hover:text-primary lg:hidden"
        >
          <X size={15} />
        </button>
      </div>

      <div className="px-3 pb-3 lg:px-2">
        <Link
          href="/chat"
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-black lg:h-12 lg:px-0"
          title="Ask OpenRx"
        >
          <Bot size={15} />
          <span className="lg:sr-only">Ask OpenRx</span>
        </Link>
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto px-2 pb-4" aria-label="Main navigation">
        <div className="space-y-0.5">
          {visibleItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "group flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-[13px] font-medium transition lg:h-11 lg:justify-center lg:px-0",
                  active
                    ? "bg-white text-primary shadow-[0_12px_28px_rgba(8,24,46,0.08)]"
                    : "text-secondary hover:bg-white/72 hover:text-primary"
                )}
              >
                <item.icon size={15} className={active ? "text-primary" : "text-muted group-hover:text-primary"} strokeWidth={1.7} />
                <span className="flex-1 lg:sr-only">{item.label}</span>
                {item.href === "/messages" && unreadCount > 0 ? (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-white lg:absolute lg:right-1 lg:top-1">
                    {unreadCount}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="px-3 py-3 lg:px-2">
        <Link
          href="/privacy-explained"
          className="block rounded-[14px] px-3 py-2 text-[12px] font-medium text-muted transition hover:bg-white/72 hover:text-primary lg:px-0 lg:text-center"
          title="Privacy"
        >
          <span className="lg:sr-only">Privacy</span>
          <span aria-hidden className="hidden lg:inline">?</span>
        </Link>
      </div>
    </>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-full border border-[rgba(82,108,139,0.12)] bg-white/92 p-2.5 text-secondary shadow-card transition hover:text-primary lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {mobileOpen ? <div className="fixed inset-0 z-40 bg-black/24 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

      <aside
        className={cn(
          "shell-rail fixed left-0 top-0 z-50 flex h-screen w-[244px] flex-col border-r transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      <aside className="shell-rail fixed left-0 top-0 z-40 hidden h-screen w-[76px] flex-col border-r lg:flex">
        {sidebarContent}
      </aside>
    </>
  )
}
