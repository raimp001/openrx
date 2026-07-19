"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bot, Heart, LayoutDashboard, Menu, ShieldCheck, Stethoscope, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import ChatHistorySidebar from "@/components/chat/chat-history-sidebar"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "My care", icon: LayoutDashboard, primary: true },
  { href: "/screening", label: "Screenings", icon: Heart },
  { href: "/providers", label: "Find care", icon: Stethoscope },
]

export default function Sidebar() {
  const pathname = usePathname()
  const isChatRoute = pathname === "/chat" || pathname?.startsWith("/chat/")
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const visibleItems = useMemo(() => navItems, [])

  useEffect(() => {
    if (isChatRoute) return
    document.documentElement.style.setProperty("--openrx-sidebar-width", "76px")
  }, [isChatRoute])

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

  // Move focus into the drawer when it opens and back to the trigger when it
  // closes, so keyboard and screen-reader users are not left behind the overlay.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (mobileOpen) {
      wasOpenRef.current = true
      const focusable = drawerRef.current?.querySelector<HTMLElement>("a, button")
      focusable?.focus()
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false
      openButtonRef.current?.focus({ preventScroll: true })
    }
  }, [mobileOpen])

  if (isChatRoute) {
    return <ChatHistorySidebar />
  }

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
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-white/10 hover:text-primary lg:hidden"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-3 pb-3 lg:px-2">
        <Link
          href="/chat"
          className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-100 lg:h-12 lg:px-0"
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
                    ? "bg-cyan-200/10 text-primary ring-1 ring-cyan-200/18"
                    : "text-secondary hover:bg-white/8 hover:text-primary"
                )}
              >
                <item.icon size={15} className={active ? "text-primary" : "text-muted group-hover:text-primary"} strokeWidth={1.7} />
                <span className="flex-1 lg:sr-only">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="px-3 py-3 lg:px-2">
        <Link
          href="/privacy-explained"
          className="flex items-center gap-3 rounded-[14px] px-3 py-2 text-[12px] font-medium text-muted transition hover:bg-white/8 hover:text-primary lg:justify-center lg:px-0"
          title="Privacy"
        >
          <ShieldCheck size={15} strokeWidth={1.7} aria-hidden />
          <span className="lg:sr-only">Privacy</span>
        </Link>
      </div>
    </>
  )

  return (
    <>
      <button
        ref={openButtonRef}
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-[#101010]/92 text-secondary shadow-card transition hover:border-white/20 hover:text-primary lg:hidden"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
      >
        <Menu size={18} />
      </button>

      {mobileOpen ? <div className="fixed inset-0 z-40 bg-black/24 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

      {mobileOpen ? (
        <aside
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="shell-rail fixed left-0 top-0 z-50 flex h-screen w-[244px] flex-col border-r lg:hidden"
        >
          {sidebarContent}
        </aside>
      ) : null}

      <aside className="shell-rail fixed left-0 top-0 z-40 hidden h-screen w-[76px] flex-col border-r lg:flex">
        {sidebarContent}
      </aside>
    </>
  )
}
