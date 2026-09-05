"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowRightCircle,
  Bell,
  Bot,
  HeartPulse,
  LayoutDashboard,
  MessageSquare,
  Stethoscope,
  UserCircle,
  UserPlus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot";
import { useWalletIdentity } from "@/lib/wallet-context";

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const navShortcuts = [
  { href: "/screening", label: "Check screening", icon: HeartPulse, primary: true },
  { href: "/providers", label: "Find care", icon: Stethoscope, primary: true },
  { href: "/dashboard", label: "Track", icon: LayoutDashboard, primary: false },
  { href: "/wallet", label: "Tip / save", icon: Wallet, primary: false },
  { href: "/join-network", label: "Join network", icon: UserPlus, primary: false },
];

export default function Topbar() {
  const pathname = usePathname();
  const isChatRoute = pathname === "/chat" || pathname?.startsWith("/chat/");
  const { snapshot } = useLiveSnapshot();
  const { isConnected, profile, walletAddress } = useWalletIdentity();
  const unread = snapshot.messages.filter((m) => !m.read).length;
  const displayName = isConnected
    ? profile?.fullName || snapshot.patient?.full_name || (walletAddress ? shortenAddress(walletAddress) : "")
    : "";

  const pageInfo = useMemo(() => {
    const entries: Array<[string, { label: string; note: string }]> = [
      ["/screening", { label: "Check screening", note: "Know what may be due and what to do next" }],
      ["/providers", { label: "Find care", note: "Call-ready options, scripts, and verification gaps" }],
      ["/dashboard", { label: "Track next step", note: "Saved plans, reminders, and care momentum" }],
      ["/wallet", { label: "Tip / save", note: "Optional wallet actions after useful guidance" }],
      ["/join-network", { label: "Join network", note: "Provider and caregiver onboarding with human review" }],
      ["/messages", { label: "Messages", note: "Questions, follow-up, and care coordination" }],
      ["/onboarding", { label: "Care setup", note: "Profile details for more useful screening and handoffs" }],
      ["/chat", { label: "Ask OpenRx", note: "One question, source links, and the next useful action" }],
    ];

    const match = entries.find(([href]) => pathname === href || pathname?.startsWith(`${href}/`));
    return match?.[1] || { label: "OpenRx", note: "Screening navigation and care handoffs" };
  }, [pathname]);

  if (isChatRoute) {
    return null;
  }

  return (
    <header className="sticky top-0 z-30 pl-[4.75rem] pr-3 pt-3 sm:px-6 lg:px-8">
      <div className="ml-auto flex w-fit max-w-[1240px] items-center gap-1.5 rounded-full border border-white/10 bg-[#101010]/82 px-2 py-1.5 shadow-[0_18px_54px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:mx-auto sm:w-full sm:gap-3 sm:px-3 sm:py-2">
        <div className="hidden min-w-0 shrink-0 pl-1 sm:block lg:min-w-[156px]">
          <p className="truncate text-sm font-semibold text-primary">{pageInfo.label}</p>
          <p className="hidden truncate text-[11px] text-muted xl:block">{pageInfo.note}</p>
        </div>

        <Link
          href="/screening"
          className="hidden flex-1 items-center justify-between gap-4 rounded-full border border-white/10 bg-white/[0.055] px-4 py-2.5 text-sm text-secondary transition hover:bg-white/[0.09] hover:text-primary lg:flex"
        >
          <span className="inline-flex items-center gap-2">
            <HeartPulse size={15} className="text-teal" />
            Start with one sentence — get the next useful action
          </span>
          <ArrowRightCircle size={15} className="text-muted" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Focused app navigation">
          {navShortcuts.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full px-3 text-[12px] font-semibold transition",
                  active
                    ? "bg-cyan-200 text-black"
                    : item.primary
                      ? "border border-white/10 bg-white/[0.06] text-primary hover:bg-white/[0.1]"
                      : "text-secondary hover:bg-white/[0.08] hover:text-primary",
                )}
              >
                <Icon size={14} />
                <span className="hidden xl:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/messages"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-secondary transition hover:bg-white/[0.1] hover:text-primary"
            aria-label="Messages"
          >
            {unread > 0 ? <Bell size={16} strokeWidth={1.6} /> : <MessageSquare size={16} strokeWidth={1.6} />}
            {unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-coral px-1 text-[9px] font-semibold text-white">
                {unread}
              </span>
            ) : null}
          </Link>

          {isConnected ? (
            <Link
              href="/profile"
              className="flex h-10 w-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] transition hover:bg-white/[0.1] sm:w-auto sm:justify-start sm:pl-1.5 sm:pr-3"
              aria-label="Profile"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-200 text-[10px] font-semibold text-black">
                {displayName ? displayName.charAt(0).toUpperCase() : "?"}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-[12px] font-medium text-primary">
                  {displayName ? displayName.split(" ")[0] : walletAddress ? shortenAddress(walletAddress) : "Profile"}
                </p>
              </div>
            </Link>
          ) : (
            <Link
              href="/onboarding"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-primary transition hover:bg-white/[0.1] sm:w-auto sm:px-4 sm:py-2.5 sm:text-[13px] sm:font-semibold"
              aria-label="Setup"
            >
              <UserCircle size={16} className="sm:hidden" />
              <span className="hidden sm:inline">Setup</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
