"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Bell,
  Calendar,
  Command,
  FlaskConical,
  LayoutDashboard,
  MessageSquare,
  Pill,
  Receipt,
  Search,
  UserCircle,
  X,
  ArrowRightCircle,
  Activity,
  Syringe,
  Clock,
  Bot,
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
import { cn, formatDate, formatTime } from "@/lib/utils"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useWalletIdentity } from "@/lib/wallet-context"

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export default function Topbar() {
  const { snapshot, getPhysician } = useLiveSnapshot()
  const { isConnected, profile, walletAddress } = useWalletIdentity()
  const displayName = isConnected ? (profile?.fullName || snapshot.patient?.full_name || (walletAddress ? shortenAddress(walletAddress) : "")) : ""
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const unread = snapshot.messages.filter((m) => !m.read).length

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
      { label: "Profile", href: "/profile", icon: UserCircle, keywords: ["profile", "account", "personal"] },
      { label: "Timeline", href: "/timeline", icon: Clock, keywords: ["timeline", "history", "events"] },
      { label: "Appointments", href: "/scheduling", icon: Calendar, keywords: ["appointments", "schedule", "book"] },
      { label: "Medications", href: "/prescriptions", icon: Pill, keywords: ["meds", "medications", "prescriptions"] },
      { label: "Lab Results", href: "/lab-results", icon: FlaskConical, keywords: ["labs", "results", "blood"] },
      { label: "Vitals", href: "/vitals", icon: Activity, keywords: ["vitals", "bp", "heart rate"] },
      { label: "Vaccinations", href: "/vaccinations", icon: Syringe, keywords: ["vaccines", "shots"] },
      { label: "Referrals", href: "/referrals", icon: ArrowRightCircle, keywords: ["referrals", "specialists"] },
      { label: "Messages", href: "/messages", icon: MessageSquare, keywords: ["messages", "inbox"] },
      { label: "Billing", href: "/billing", icon: Receipt, keywords: ["billing", "claims", "bills"] },
      { label: "Ask AI", href: "/chat", icon: Bot, keywords: ["ai", "ask", "chat"] },
    ],
    []
  )

  const results = useMemo(() => {
    if (!query || query.length < 2) return null
    const lowered = query.toLowerCase()

    const navigation = quickNav
      .filter((item) =>
        item.label.toLowerCase().includes(lowered) || item.keywords.some((kw) => kw.includes(lowered))
      )
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
  }, [getPhysician, snapshot.appointments, snapshot.prescriptions, query, quickNav])

  const [activeIndex, setActiveIndex] = useState(-1)

  const flatResults = useMemo(() => {
    if (!results) return []
    const items: { href: string; label: string }[] = []
    for (const n of results.navigation) items.push({ href: n.href, label: n.label })
    for (const a of results.appointments) items.push({ href: "/scheduling", label: a.reason })
    for (const r of results.prescriptions) items.push({ href: "/prescriptions", label: r.medication_name })
    return items
  }, [results])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || flatResults.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      const item = flatResults[activeIndex]
      if (item) { window.location.href = item.href; closeSearch() }
    }
  }, [isOpen, flatResults, activeIndex])

  // Reset active index when query changes
  useEffect(() => { setActiveIndex(-1) }, [query])

  const closeSearch = useCallback(() => {
    setIsOpen(false)
    setQuery("")
    setActiveIndex(-1)
  }, [])

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-[rgba(250,250,248,0.95)] backdrop-blur-lg">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Search */}
        <div ref={searchRef} className="relative flex-1 max-w-lg">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            onKeyDown={handleSearchKeyDown}
            role="combobox"
            aria-expanded={isOpen && !!results}
            aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
            placeholder="Search..."
            className="w-full rounded-nav border border-border bg-white py-2 pl-9 pr-12 text-sm text-primary placeholder:text-muted transition focus:border-teal/40 focus:ring-1 focus:ring-teal/20"
          />
          {query ? (
            <button
              onClick={() => { setQuery(""); setIsOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-primary"
              aria-label="Clear"
            >
              <X size={12} />
            </button>
          ) : (
            <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 text-[9px] font-medium text-muted lg:flex">
              <Command size={8} /> K
            </span>
          )}

          {isOpen && results ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-card border border-border bg-white shadow-card-hover">
              {results.total === 0 ? (
                <div className="px-4 py-3 text-sm text-secondary">No results for &ldquo;{query}&rdquo;</div>
              ) : (
                <div className="max-h-80 overflow-y-auto py-1" role="listbox">
                  {(() => {
                    let idx = 0
                    return (
                      <>
                        {results.navigation.map((item) => {
                          const Icon = item.icon
                          const i = idx++
                          return (
                            <Link
                              key={item.href}
                              id={`search-result-${i}`}
                              href={item.href}
                              onClick={closeSearch}
                              role="option"
                              aria-selected={activeIndex === i}
                              className={cn(
                                "flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-surface",
                                activeIndex === i && "bg-surface"
                              )}
                            >
                              <Icon size={14} className="text-teal" />
                              <span className="font-medium text-primary">{item.label}</span>
                            </Link>
                          )
                        })}
                        {results.appointments.map((apt) => {
                          const physician = getPhysician(apt.physician_id)
                          const i = idx++
                          return (
                            <Link
                              key={apt.id}
                              id={`search-result-${i}`}
                              href="/scheduling"
                              onClick={closeSearch}
                              role="option"
                              aria-selected={activeIndex === i}
                              className={cn(
                                "flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-surface",
                                activeIndex === i && "bg-surface"
                              )}
                            >
                              <Calendar size={14} className="text-muted" />
                              <div>
                                <span className="font-medium text-primary">{apt.reason}</span>
                                <span className="ml-2 text-xs text-muted">{physician?.full_name} · {formatDate(apt.scheduled_at)}</span>
                              </div>
                            </Link>
                          )
                        })}
                        {results.prescriptions.map((rx) => {
                          const i = idx++
                          return (
                            <Link
                              key={rx.id}
                              id={`search-result-${i}`}
                              href="/prescriptions"
                              onClick={closeSearch}
                              role="option"
                              aria-selected={activeIndex === i}
                              className={cn(
                                "flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-surface",
                                activeIndex === i && "bg-surface"
                              )}
                            >
                              <Pill size={14} className="text-muted" />
                              <span className="font-medium text-primary">{rx.medication_name} {rx.dosage}</span>
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

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/messages"
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-secondary transition hover:text-primary hover:bg-surface"
            aria-label="Messages"
          >
            <Bell size={16} strokeWidth={1.5} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-coral px-1 text-[9px] font-semibold text-white">
                {unread}
              </span>
            )}
          </Link>

          {displayName ? (
            <Wallet>
              <ConnectWallet className="ock-wallet-connect">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal text-[10px] font-semibold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-[13px]">{displayName.split(" ")[0]}</span>
              </ConnectWallet>
              <WalletDropdown className="ock-wallet-dropdown">
                <div className="px-3 py-2.5 border-b border-border/60">
                  <p className="text-[13px] font-medium text-primary">{displayName}</p>
                  <p className="text-[11px] text-muted mt-0.5">{walletAddress ? shortenAddress(walletAddress) : ""}</p>
                </div>
                <WalletDropdownLink icon="wallet" href="/wallet" className="ock-wallet-link">
                  Wallet
                </WalletDropdownLink>
                <WalletDropdownLink icon="wallet" href="/profile" className="ock-wallet-link">
                  Profile
                </WalletDropdownLink>
                <WalletDropdownDisconnect className="ock-wallet-disconnect" />
              </WalletDropdown>
            </Wallet>
          ) : (
            <Wallet>
              <ConnectWallet className="ock-wallet-connect-primary" />
              <WalletDropdown className="ock-wallet-dropdown">
                <Identity className="px-3 py-2.5" hasCopyAddressOnClick>
                  <Avatar className="h-8 w-8" />
                  <Name className="font-medium text-primary text-[13px]" />
                  <Address className="text-[11px] text-muted" />
                </Identity>
                <WalletDropdownDisconnect className="ock-wallet-disconnect" />
              </WalletDropdown>
            </Wallet>
          )}
        </div>
      </div>
    </header>
  )
}
