import Link from "next/link"
import {
  Calendar,
  Receipt,
  ShieldCheck,
  Pill,
  MessageSquare,
  Bot,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Heart,
  Users,
  TrendingUp,
  Search,
  Zap,
  Lock,
  Globe,
  Star,
} from "lucide-react"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"

const AGENT_COLORS: Record<string, string> = {
  "Onboarding Guide": "text-accent bg-accent/10",
  "Coordinator": "text-soft-blue bg-soft-blue/10",
  "Triage Nurse": "text-soft-red bg-soft-red/8",
  "Scheduling": "text-terra bg-terra/10",
  "Billing": "text-yellow-700 bg-yellow-50",
  "Pharmacy": "text-accent bg-accent/10",
  "Wellness": "text-accent bg-accent/10",
  "Prior Auth": "text-soft-blue bg-soft-blue/10",
  "Referrals": "text-terra bg-terra/10",
}

function agentColor(role: string) {
  for (const key of Object.keys(AGENT_COLORS)) {
    if (role.toLowerCase().includes(key.toLowerCase())) return AGENT_COLORS[key]
  }
  return "text-warm-600 bg-sand/40"
}

export default function LandingPage() {
  const year = new Date().getFullYear()
  return (
    <div className="min-h-screen bg-cream text-warm-800">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-sand/70 bg-pampas/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-terra via-terra-light to-accent shadow-lg shadow-terra/20">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path d="M12 4v16M4 12h16" stroke="#11221D" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold">OpenRx</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cloudy">care operating system</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/providers" className="text-xs font-semibold text-warm-600 transition hover:text-terra">Providers</Link>
            <Link href="/chat" className="text-xs font-semibold text-warm-600 transition hover:text-terra">AI Concierge</Link>
            <Link href="/billing" className="text-xs font-semibold text-warm-600 transition hover:text-terra">Billing</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="hidden rounded-xl border border-sand bg-cream/70 px-4 py-2 text-xs font-semibold text-warm-700 transition hover:border-terra/30 hover:text-terra sm:inline-flex"
            >
              Try AI Concierge
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-terra px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-terra/25 transition hover:bg-terra-dark"
            >
              Open Dashboard
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 pb-14 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-terra/20 bg-terra/8 px-4 py-1.5 text-xs font-bold text-terra">
            <Sparkles size={12} />
            Built for patients who want zero friction
          </div>
          <h1 className="mt-6 text-5xl leading-[1.03] text-warm-800 lg:text-6xl">
            Healthcare that feels
            <br />
            <span className="text-gradient-terra">surprisingly effortless.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-warm-600">
            OpenRx combines natural-language care search, smart scheduling, payment transparency, and AI care
            coordination into one product patients actually enjoy using.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-xl bg-terra px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-terra/30 transition hover:bg-terra-dark hover:-translate-y-0.5"
            >
              Get started free
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/providers"
              className="inline-flex items-center gap-2 rounded-xl border border-sand bg-pampas px-6 py-3.5 text-sm font-bold text-warm-800 transition hover:border-terra/30 hover:shadow-sm"
            >
              <Search size={15} className="text-terra" />
              Find providers near me
            </Link>
          </div>

          {/* Trust chips */}
          <div className="mt-7 flex flex-wrap gap-2">
            {[
              { icon: Globe, label: "Natural language search" },
              { icon: Users, label: "NPI-verified providers" },
              { icon: Lock, label: "Privacy-first by design" },
              { icon: Zap, label: "Real-time AI agents" },
            ].map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-sand bg-pampas px-3 py-1.5 text-xs font-semibold text-warm-600"
              >
                <chip.icon size={11} className="text-terra shrink-0" />
                {chip.label}
              </span>
            ))}
          </div>
        </div>

        {/* Care hub preview card */}
        <div className="surface-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-sand/70 bg-cream/70 px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cloudy">Today in your care hub</p>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Live
            </span>
          </div>
          <div className="space-y-2.5 p-5">
            {[
              {
                icon: Calendar,
                title: "Cardiology follow-up booked",
                detail: "Friday · 10:15 AM · In-network copay estimate ready",
                tone: "text-soft-blue",
                bg: "bg-soft-blue/10",
              },
              {
                icon: Receipt,
                title: "Claim anomaly caught",
                detail: "Vera flagged duplicate code and drafted correction",
                tone: "text-terra",
                bg: "bg-terra/10",
              },
              {
                icon: Pill,
                title: "Medication refill approved",
                detail: "Refill routed to selected pharmacy",
                tone: "text-accent",
                bg: "bg-accent/10",
              },
              {
                icon: Heart,
                title: "Preventive screening suggestion",
                detail: "Quinn recommends lipid panel + A1C this month",
                tone: "text-yellow-700",
                bg: "bg-yellow-50",
              },
            ].map((item) => (
              <div key={item.title} className="surface-muted flex items-start gap-3 px-3 py-2.5 transition hover:border-sand/80">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
                  <item.icon size={14} className={item.tone} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-warm-800">{item.title}</p>
                  <p className="text-xs text-warm-500">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-sand/60 bg-cream/50 px-5 py-3 text-center">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-bold text-terra hover:gap-2.5 transition-all">
              Open your full dashboard <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-14">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { value: `${OPENCLAW_CONFIG.agents.length}`, label: "Specialist AI agents", icon: Bot, color: "text-terra", bg: "bg-terra/8" },
            { value: "Live", label: "NPI data source", icon: TrendingUp, color: "text-accent", bg: "bg-accent/8" },
            { value: "Natural language", label: "Search input mode", icon: MessageSquare, color: "text-soft-blue", bg: "bg-soft-blue/8" },
            { value: "Wallet linked", label: "Patient identity", icon: Users, color: "text-warm-600", bg: "bg-sand/40" },
          ].map((s) => (
            <div key={s.label} className="surface-card p-5 text-center group hover:-translate-y-0.5">
              <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} transition group-hover:scale-110`}>
                <s.icon size={18} className={s.color} />
              </div>
              <p className="text-2xl font-bold text-warm-800">{s.value}</p>
              <p className="mt-1 text-xs font-medium text-warm-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-14">
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full border border-terra/20 bg-terra/8 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-terra mb-3">Platform</span>
          <h2 className="text-3xl text-warm-800">Designed like the best consumer apps</h2>
          <p className="mt-2 text-sm text-warm-500 max-w-xl mx-auto">
            Fast defaults, obvious next actions, and one intelligent interface for your entire care journey.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Calendar,
              title: "Always know your next step",
              desc: "Timeline-first scheduling with reminders, prep checklists, and clear copay estimates.",
              href: "/scheduling",
              color: "text-terra",
              bg: "bg-terra/8",
            },
            {
              icon: Receipt,
              title: "Billing clarity by default",
              desc: "Receipts, attestations, and refunds are tracked with a compliance-ready ledger.",
              href: "/compliance-ledger",
              color: "text-yellow-700",
              bg: "bg-yellow-50",
            },
            {
              icon: ShieldCheck,
              title: "Safety built in",
              desc: "Second opinions, prior auth automation, and escalation paths for urgent issues.",
              href: "/second-opinion",
              color: "text-soft-blue",
              bg: "bg-soft-blue/8",
            },
            {
              icon: MessageSquare,
              title: "Conversations in one stream",
              desc: "Patient messages, care updates, and AI triage are unified so nothing gets lost.",
              href: "/messages",
              color: "text-accent",
              bg: "bg-accent/8",
            },
            {
              icon: Bot,
              title: "Natural-language everything",
              desc: "Search providers, ask screening questions, and coordinate care in plain English.",
              href: "/chat",
              color: "text-terra",
              bg: "bg-terra/8",
            },
            {
              icon: Pill,
              title: "Medication confidence",
              desc: "Smart adherence tracking, refill alerts, and pharmacy-aware pricing decisions.",
              href: "/prescriptions",
              color: "text-accent",
              bg: "bg-accent/8",
            },
          ].map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="surface-card group p-6 transition-all hover:-translate-y-1 hover:border-terra/25 hover:shadow-card-hover"
            >
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${feature.bg} transition group-hover:scale-105`}>
                <feature.icon size={18} className={feature.color} />
              </div>
              <h3 className="text-base font-bold text-warm-800 group-hover:text-terra transition-colors">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-warm-500">{feature.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-terra group-hover:gap-2 transition-all">
                Explore <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Agent network */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-14">
        <div className="surface-card overflow-hidden">
          <div className="border-b border-sand/70 bg-gradient-to-r from-cream/80 to-cream/40 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cloudy">OpenClaw agent network</span>
                <h3 className="mt-0.5 text-2xl text-warm-800">
                  <span className="text-gradient-terra">{OPENCLAW_CONFIG.agents.length} specialists</span> working as one care team
                </h3>
              </div>
              <div className="hidden items-center gap-2 rounded-xl border border-accent/20 bg-accent/8 px-3 py-2 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-bold text-accent">All agents online</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {OPENCLAW_CONFIG.agents.slice(0, 8).map((agent) => (
              <div key={agent.id} className="surface-muted group px-3 py-3.5 transition hover:border-sand/80">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${agentColor(agent.role)}`}>
                    {agent.role.split(" ")[0]}
                  </span>
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent/70" />
                </div>
                <p className="text-sm font-semibold text-warm-800">{agent.name}</p>
                <p className="mt-0.5 text-[11px] text-cloudy leading-snug">Collaborates in real time with the full care team.</p>
              </div>
            ))}
          </div>
          {OPENCLAW_CONFIG.agents.length > 8 && (
            <div className="border-t border-sand/60 bg-cream/50 px-6 py-3 text-center">
              <span className="text-xs font-semibold text-warm-500">
                + {OPENCLAW_CONFIG.agents.length - 8} more specialist agents in the network
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-warm-800 via-warm-700 to-warm-800 px-8 py-14 text-center shadow-premium">
          {/* Subtle background orbs */}
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-terra/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-xs font-bold text-white/80">
              <Star size={11} className="text-terra" />
              Start your care journey today
            </div>
            <h2 className="text-3xl font-serif text-white lg:text-4xl">
              Take control of your healthcare.<br />
              <span className="text-gradient-terra">No forms. No friction. No wait.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/60">
              OpenRx puts 12 AI specialists, your full health record, and real-time billing intelligence in one place — so you always know what's next.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-xl bg-terra px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-terra/30 transition hover:bg-terra-light hover:-translate-y-0.5"
              >
                Get started — it&rsquo;s free
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 px-6 py-3.5 text-sm font-semibold text-white/90 transition hover:bg-white/15 hover:border-white/30"
              >
                <CheckCircle2 size={14} />
                Preview the dashboard
              </Link>
            </div>
            <p className="mt-5 text-[11px] text-white/35">No credit card required · Wallet-optional · Privacy-first</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sand/70 bg-pampas">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-terra to-accent shadow-md shadow-terra/20">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4v16M4 12h16" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-warm-800">OpenRx</span>
              </div>
              <p className="text-xs text-warm-500 max-w-[200px] leading-relaxed">
                The care operating system built for patients who expect more.
              </p>
            </div>
            {/* Links */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-xs">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-cloudy mb-3">Product</p>
                <Link href="/dashboard" className="block text-warm-500 hover:text-terra transition">Dashboard</Link>
                <Link href="/chat" className="block text-warm-500 hover:text-terra transition">AI Concierge</Link>
                <Link href="/providers" className="block text-warm-500 hover:text-terra transition">Provider Search</Link>
                <Link href="/billing" className="block text-warm-500 hover:text-terra transition">Billing & Claims</Link>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-cloudy mb-3">Legal</p>
                <Link href="/privacy-explained" className="block text-warm-500 hover:text-terra transition">Privacy Policy</Link>
                <Link href="/compliance-ledger" className="block text-warm-500 hover:text-terra transition">Compliance</Link>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-sand/60 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-warm-400">
            <p>© {year} OpenRx · Powered by OpenClaw</p>
            <p>Live data environment · wallet-linked patient context</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
