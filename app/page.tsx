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
  Search,
  Zap,
  Lock,
  Globe,
  Star,
  ChevronRight,
  Activity,
  FlaskConical,
} from "lucide-react"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"

const AGENT_COLORS: Record<string, string> = {
  "Onboarding Guide": "from-terra/20 to-terra/5 border-terra/20 text-terra",
  "Coordinator": "from-soft-blue/20 to-soft-blue/5 border-soft-blue/20 text-soft-blue",
  "Triage Nurse": "from-soft-red/20 to-soft-red/5 border-soft-red/20 text-soft-red",
  "Scheduling": "from-terra/20 to-terra/5 border-terra/20 text-terra",
  "Billing": "from-yellow-500/20 to-yellow-500/5 border-yellow-500/20 text-yellow-500",
  "Pharmacy": "from-accent/20 to-accent/5 border-accent/20 text-accent",
  "Wellness": "from-accent/20 to-accent/5 border-accent/20 text-accent",
  "Prior Auth": "from-soft-blue/20 to-soft-blue/5 border-soft-blue/20 text-soft-blue",
  "Referrals": "from-terra/20 to-terra/5 border-terra/20 text-terra",
}

function agentColor(role: string) {
  for (const key of Object.keys(AGENT_COLORS)) {
    if (role.toLowerCase().includes(key.toLowerCase())) return AGENT_COLORS[key]
  }
  return "from-white/10 to-white/5 border-white/10 text-white/60"
}

export default function LandingPage() {
  const year = new Date().getFullYear()
  return (
    <div className="min-h-screen bg-night text-white">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-night/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-terra to-terra-light shadow-lg shadow-terra/30">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 4v16M4 12h16" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight text-white">OpenRx</span>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {[
              { label: "Providers", href: "/providers" },
              { label: "AI Concierge", href: "/chat" },
              { label: "Billing", href: "/billing" },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-lg px-3.5 py-2 text-xs font-medium text-white/60 transition hover:bg-white/6 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              Try AI Concierge
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl bg-terra px-4 py-2 text-xs font-bold text-white shadow-lg shadow-terra/30 transition hover:bg-terra-light"
            >
              Open Dashboard
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        {/* Mesh gradient background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-terra/12 blur-[120px]" />
          <div className="absolute -right-20 top-20 h-[500px] w-[500px] rounded-full bg-accent/8 blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 h-[300px] w-[800px] -translate-x-1/2 rounded-full bg-soft-blue/6 blur-[80px]" />
        </div>
        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative mx-auto grid w-full max-w-7xl gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1fr_1fr] lg:pt-28">
          {/* Left */}
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-terra/25 bg-terra/10 px-4 py-1.5 text-xs font-bold text-terra mb-7">
              <Sparkles size={11} />
              Built for patients who want zero friction
            </div>
            <h1 className="text-[clamp(2.6rem,5.5vw,4.5rem)] font-serif leading-[1.02] tracking-tight text-white">
              Healthcare that{" "}
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-terra via-terra-light to-yellow-400 bg-clip-text text-transparent">
                actually works
              </span>{" "}
              for you.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/50">
              One product that replaces a dozen healthcare headaches — natural-language search, smart scheduling, billing transparency, and 12 AI specialists on call 24/7.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2.5 rounded-xl bg-terra px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-terra/35 transition hover:bg-terra-light hover:-translate-y-0.5"
              >
                Get started free
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/providers"
                className="inline-flex items-center gap-2.5 rounded-xl border border-white/12 bg-white/6 px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <Search size={14} className="text-white/50" />
                Find providers near me
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {[
                { icon: Globe, label: "Natural language search" },
                { icon: Users, label: "NPI-verified" },
                { icon: Lock, label: "Privacy-first" },
                { icon: Zap, label: "Real-time AI" },
              ].map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/50"
                >
                  <chip.icon size={10} className="text-terra/80" />
                  {chip.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right — glass care hub preview */}
          <div className="relative flex items-center justify-center">
            {/* Outer glow */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-terra/8 via-transparent to-accent/6 blur-xl" />
            <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
              {/* Card header */}
              <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-terra animate-pulse" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">Today in your care hub</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-accent/15 border border-accent/20 px-2.5 py-1 text-[10px] font-bold text-accent">
                  <span className="h-1 w-1 rounded-full bg-accent animate-pulse" /> Live
                </span>
              </div>
              {/* Items */}
              <div className="space-y-2 p-4">
                {[
                  { icon: Calendar, title: "Cardiology follow-up booked", detail: "Friday · 10:15 AM · In-network", color: "text-soft-blue", bg: "bg-soft-blue/15" },
                  { icon: Receipt, title: "Claim anomaly caught", detail: "Vera flagged duplicate billing code", color: "text-terra", bg: "bg-terra/15" },
                  { icon: Pill, title: "Medication refill approved", detail: "Routed to your pharmacy", color: "text-accent", bg: "bg-accent/15" },
                  { icon: Heart, title: "Preventive screening suggested", detail: "Lipid panel + A1C recommended", color: "text-yellow-400", bg: "bg-yellow-400/15" },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/4 px-3.5 py-3 transition hover:bg-white/7">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
                      <item.icon size={14} className={item.color} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/90">{item.title}</p>
                      <p className="text-xs text-white/35">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/8 px-5 py-3.5 text-center">
                <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-bold text-terra hover:gap-2.5 transition-all">
                  Open your full dashboard <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-white/6 bg-white/2">
        <div className="mx-auto w-full max-w-7xl px-6 py-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { value: `${OPENCLAW_CONFIG.agents.length}`, label: "AI Specialists", icon: Bot, color: "text-terra" },
              { value: "Live", label: "NPI data feed", icon: Activity, color: "text-accent" },
              { value: "100%", label: "Natural language", icon: MessageSquare, color: "text-soft-blue" },
              { value: "0", label: "Forms to fill", icon: CheckCircle2, color: "text-yellow-400" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/3 px-4 py-3">
                <s.icon size={16} className={s.color} />
                <div>
                  <p className="text-base font-bold text-white leading-none">{s.value}</p>
                  <p className="text-[10px] font-medium text-white/35 mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="mx-auto w-full max-w-7xl px-6 py-24">
        <div className="mb-14 max-w-xl">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-terra/80">Platform</span>
          <h2 className="mt-3 text-4xl font-serif text-white leading-tight">
            Designed like the best<br />consumer apps
          </h2>
          <p className="mt-4 text-base text-white/40 leading-relaxed">
            Fast defaults, obvious next actions, and one intelligent interface for your entire care journey.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Calendar,
              title: "Always know your next step",
              desc: "Timeline-first scheduling with reminders, prep checklists, and clear copay estimates before you book.",
              href: "/scheduling",
              accent: "#F05A3D",
            },
            {
              icon: Receipt,
              title: "Billing clarity by default",
              desc: "Receipts, attestations, and refunds tracked in a compliance-ready ledger — no more surprise bills.",
              href: "/compliance-ledger",
              accent: "#EAB308",
            },
            {
              icon: ShieldCheck,
              title: "Safety built in",
              desc: "Second opinions, prior auth automation, and escalation paths for urgent issues, always on.",
              href: "/second-opinion",
              accent: "#1E88B6",
            },
            {
              icon: MessageSquare,
              title: "Conversations in one stream",
              desc: "Patient messages, care updates, and AI triage unified so nothing falls through the cracks.",
              href: "/messages",
              accent: "#1FA971",
            },
            {
              icon: Bot,
              title: "Natural-language everything",
              desc: "Search providers, ask screening questions, and coordinate care in plain English — no coding needed.",
              href: "/chat",
              accent: "#F05A3D",
            },
            {
              icon: Pill,
              title: "Medication confidence",
              desc: "Smart adherence tracking, refill alerts, and pharmacy-aware pricing to keep you on schedule.",
              href: "/prescriptions",
              accent: "#1FA971",
            },
          ].map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/4 p-6 transition-all hover:bg-white/7 hover:border-white/14 hover:-translate-y-1"
            >
              {/* Gradient top border */}
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${feature.accent}60, transparent)` }}
              />
              <div
                className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: `${feature.accent}18`, border: `1px solid ${feature.accent}20` }}
              >
                <feature.icon size={20} style={{ color: feature.accent }} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-terra transition-colors">{feature.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-white/40">{feature.desc}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-white/30 group-hover:text-terra group-hover:gap-2 transition-all">
                Explore <ArrowRight size={11} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── AGENT NETWORK ── */}
      <section className="relative overflow-hidden border-y border-white/6 bg-gradient-to-b from-midnight/60 to-night py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-terra/6 blur-[80px]" />
          <div className="absolute left-0 bottom-0 h-[300px] w-[400px] rounded-full bg-accent/5 blur-[80px]" />
        </div>
        <div className="relative mx-auto w-full max-w-7xl px-6">
          {/* Header */}
          <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-terra/80">OpenClaw Agent Network</span>
              <h2 className="mt-3 text-4xl font-serif text-white">
                <span className="bg-gradient-to-r from-terra to-yellow-400 bg-clip-text text-transparent">
                  {OPENCLAW_CONFIG.agents.length} specialists
                </span>{" "}
                working as one
              </h2>
              <p className="mt-3 text-base text-white/40 max-w-md">
                Each agent has a distinct role and communicates in real time with the rest of your care team.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/10 px-4 py-2.5 w-fit">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-bold text-accent">All agents online</span>
            </div>
          </div>

          {/* Agent grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {OPENCLAW_CONFIG.agents.slice(0, 8).map((agent) => {
              const cls = agentColor(agent.role)
              return (
                <div
                  key={agent.id}
                  className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 transition hover:-translate-y-0.5 ${cls}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-current/10 opacity-80`}>
                      {agent.role.split(" ")[0]}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-accent/60 group-hover:bg-accent transition" />
                  </div>
                  <p className="text-sm font-bold text-white">{agent.name}</p>
                  <p className="mt-1 text-[11px] text-white/35 leading-snug">
                    Collaborates in real time with the full care team.
                  </p>
                </div>
              )
            })}
          </div>

          {OPENCLAW_CONFIG.agents.length > 8 && (
            <div className="mt-5 text-center">
              <span className="text-xs text-white/25">
                + {OPENCLAW_CONFIG.agents.length - 8} more specialists in the network
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="mx-auto w-full max-w-7xl px-6 py-24">
        <div className="mb-14 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-terra/80">How it works</span>
          <h2 className="mt-3 text-4xl font-serif text-white">Up and running in minutes</h2>
          <p className="mt-3 text-base text-white/40">No paperwork. No waiting room intake forms.</p>
        </div>
        <div className="grid gap-px sm:grid-cols-3 rounded-2xl overflow-hidden border border-white/8">
          {[
            {
              step: "01",
              icon: Sparkles,
              title: "Tell us about yourself",
              desc: "Chat with Sage, your onboarding guide. She asks one question at a time — no forms, just conversation.",
              color: "text-terra",
            },
            {
              step: "02",
              icon: Users,
              title: "We build your care team",
              desc: "Atlas coordinates 12 specialists behind the scenes to verify insurance, find your doctors, and set up your chart.",
              color: "text-accent",
            },
            {
              step: "03",
              icon: Zap,
              title: "Your dashboard goes live",
              desc: "Real-time appointments, AI billing review, medication tracking, and your full health record in one place.",
              color: "text-soft-blue",
            },
          ].map((step, i) => (
            <div key={i} className="bg-white/3 p-8 hover:bg-white/5 transition">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[11px] font-bold text-white/20">{step.step}</span>
                <div className={`h-px flex-1 bg-white/6`} />
                <step.icon size={18} className={step.color} />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
              <p className="text-sm leading-relaxed text-white/40">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-terra/15 via-midnight to-midnight px-8 py-20 text-center">
          {/* Orbs */}
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-terra/20 blur-[80px]" />
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-accent/12 blur-[70px]" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle at 50% 0%, rgba(240,90,61,0.06) 0%, transparent 70%)",
            }}
          />

          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-terra/25 bg-terra/12 px-4 py-1.5 text-xs font-bold text-terra">
              <Star size={11} />
              Start your care journey today
            </div>
            <h2 className="text-4xl font-serif text-white lg:text-5xl leading-tight">
              Take control of your healthcare.
              <br />
              <span className="bg-gradient-to-r from-terra via-terra-light to-yellow-400 bg-clip-text text-transparent">
                No forms. No friction. No wait.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-white/40">
              OpenRx puts {OPENCLAW_CONFIG.agents.length} AI specialists, your full health record, and real-time billing intelligence in one place — so you always know what&rsquo;s next.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2.5 rounded-xl bg-terra px-8 py-4 text-sm font-bold text-white shadow-xl shadow-terra/35 transition hover:bg-terra-light hover:-translate-y-0.5"
              >
                Get started — it&rsquo;s free
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2.5 rounded-xl border border-white/12 bg-white/6 px-7 py-4 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <CheckCircle2 size={14} />
                Preview the dashboard
              </Link>
            </div>
            <p className="mt-5 text-xs text-white/20">No credit card required · Wallet-optional · Privacy-first</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/6">
        <div className="mx-auto w-full max-w-7xl px-6 py-12">
          <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-terra to-terra-light shadow-lg shadow-terra/25">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4v16M4 12h16" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-white">OpenRx</span>
              </div>
              <p className="text-xs text-white/25 max-w-[180px] leading-relaxed">
                The care operating system built for patients who expect more.
              </p>
            </div>
            {/* Links */}
            <div className="grid grid-cols-2 gap-x-14 gap-y-2 text-xs">
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/20 mb-4">Product</p>
                {[
                  { label: "Dashboard", href: "/dashboard" },
                  { label: "AI Concierge", href: "/chat" },
                  { label: "Provider Search", href: "/providers" },
                  { label: "Billing & Claims", href: "/billing" },
                ].map((l) => (
                  <Link key={l.label} href={l.href} className="block text-white/35 hover:text-white transition">{l.label}</Link>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/20 mb-4">Legal</p>
                {[
                  { label: "Privacy Policy", href: "/privacy-explained" },
                  { label: "Compliance", href: "/compliance-ledger" },
                ].map((l) => (
                  <Link key={l.label} href={l.href} className="block text-white/35 hover:text-white transition">{l.label}</Link>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/5 pt-6 text-[11px] text-white/15">
            <p>© {year} OpenRx · Powered by OpenClaw</p>
            <p>Live data environment · wallet-linked patient context</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
