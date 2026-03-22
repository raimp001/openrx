import Link from "next/link"
import {
  Activity,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  Heart,
  Lock,
  MessageSquare,
  Pill,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Zap,
} from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"

const featureCards = [
  {
    icon: Calendar,
    title: "Coordinate care without the admin drag",
    description:
      "Scheduling, follow-ups, and next-step reminders stay in one clear timeline instead of scattered portals.",
    href: "/scheduling",
  },
  {
    icon: Receipt,
    title: "See billing risk before it becomes a problem",
    description:
      "Claims, prior auths, and receipts are reviewed in one operating view with AI support behind the scenes.",
    href: "/billing",
  },
  {
    icon: Search,
    title: "Find care in natural language",
    description:
      "Search by city, ZIP, specialty, or plain English instead of manually navigating healthcare directories.",
    href: "/providers",
  },
  {
    icon: Pill,
    title: "Stay on top of medications and refills",
    description:
      "Medication tracking, refill prompts, and pharmacy coordination live beside the rest of your care plan.",
    href: "/prescriptions",
  },
  {
    icon: MessageSquare,
    title: "Keep conversations in one stream",
    description:
      "Messages, reminders, and AI guidance are anchored in one interface so the patient never has to chase context.",
    href: "/messages",
  },
  {
    icon: ShieldCheck,
    title: "Escalate when the case deserves it",
    description:
      "Second opinions, prior-auth workflows, and human review paths are available when automation should not act alone.",
    href: "/second-opinion",
  },
]

const setupSteps = [
  {
    step: "01",
    title: "Tell OpenRx what you need",
    description: "Start with a short guided intake instead of forms and disconnected onboarding screens.",
    icon: Sparkles,
  },
  {
    step: "02",
    title: "Your AI care team builds the brief",
    description: "OpenClaw agents coordinate search, scheduling, billing, and screening support in the background.",
    icon: Users,
  },
  {
    step: "03",
    title: "Run everything from one workspace",
    description: "Appointments, messages, medications, and claims stay in one system with a clear next action.",
    icon: Zap,
  },
]

const previewItems = [
  {
    icon: Calendar,
    title: "Cardiology follow-up booked",
    detail: "Friday · 10:15 AM · in-network",
    tone: "text-soft-blue",
    bg: "bg-soft-blue/10",
  },
  {
    icon: Receipt,
    title: "Billing anomaly flagged",
    detail: "Vera caught a duplicate claim path",
    tone: "text-terra-dark",
    bg: "bg-terra/10",
  },
  {
    icon: Pill,
    title: "Refill window approaching",
    detail: "Maya prepared the pharmacy handoff",
    tone: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Heart,
    title: "Preventive screening due",
    detail: "Quinn recommends lipid panel + A1C review",
    tone: "text-warm-700",
    bg: "bg-[#d8c9ae]/35",
  },
]

const agentAccent = (index: number) => {
  const accents = [
    "border-terra/18 bg-terra/8 text-terra-dark",
    "border-soft-blue/18 bg-soft-blue/8 text-soft-blue",
    "border-accent/18 bg-accent/8 text-accent",
    "border-[#d8c9ae] bg-[#f7efe1] text-warm-700",
  ]
  return accents[index % accents.length]
}

export default function LandingPage() {
  const year = new Date().getFullYear()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-sand/60 bg-[rgba(255,253,249,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <BrandMark />
            <BrandWordmark subtitleClassName="text-cloudy/80" titleClassName="text-sm font-semibold text-warm-800" />
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
                className="rounded-full px-3.5 py-2 text-xs font-semibold text-warm-600 transition hover:bg-white hover:text-warm-800"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="hidden rounded-full border border-sand/70 bg-white/80 px-4 py-2 text-xs font-semibold text-warm-700 transition hover:border-terra/20 hover:text-warm-800 sm:inline-flex"
            >
              Try AI Concierge
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full bg-warm-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-warm-700"
            >
              Open Dashboard
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl gap-10 px-6 pb-16 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pt-20">
          <div>
            <span className="eyebrow-pill mb-5">
              <Sparkles size={11} />
              OpenRx care operating system
            </span>
            <h1 className="max-w-4xl text-[clamp(2.8rem,5vw,4.9rem)] font-serif leading-[0.98] tracking-[-0.055em] text-warm-800">
              One calm, clear interface for the entire care journey.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-warm-600">
              OpenRx brings provider search, scheduling, screening, medications, billing, and AI coordination into one
              clinical workspace that feels deliberate instead of fragmented.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-full bg-terra px-6 py-3 text-sm font-semibold text-white transition hover:bg-terra-dark"
              >
                Start care setup
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/providers"
                className="inline-flex items-center gap-2 rounded-full border border-sand/70 bg-white/80 px-6 py-3 text-sm font-semibold text-warm-700 transition hover:border-terra/20 hover:text-warm-800"
              >
                <Stethoscope size={14} className="text-terra-dark" />
                Find care nearby
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {[
                { icon: Search, label: "Natural-language search" },
                { icon: Lock, label: "Privacy-first" },
                { icon: Activity, label: "Live care status" },
                { icon: Bot, label: `${OPENCLAW_CONFIG.agents.length} AI specialists` },
              ].map((item) => (
                <span key={item.label} className="metric-chip">
                  <item.icon size={12} className="text-terra-dark" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="surface-card relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-terra/10 blur-3xl" />
              <div className="absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-accent/8 blur-3xl" />
            </div>
            <div className="relative">
              <div className="flex items-center justify-between border-b border-sand/60 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cloudy">Today in your care desk</p>
                  <p className="mt-1 text-base font-semibold text-warm-800">A single operating view for care</p>
                </div>
                <span className="metric-chip text-accent">
                  <CheckCircle2 size={12} />
                  Live
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {previewItems.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-[22px] border border-sand/70 bg-white/78 px-4 py-3.5 shadow-sm"
                  >
                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${item.bg}`}>
                      <item.icon size={16} className={item.tone} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-warm-800">{item.title}</p>
                      <p className="mt-1 text-[12px] text-warm-600">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <StatCard value={`${OPENCLAW_CONFIG.agents.length}`} label="AI specialists" />
                <StatCard value="Live" label="NPI data" />
                <StatCard value="1" label="Care workspace" />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-6 py-8">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Built for patients first",
                description: "Clear next actions and fewer dead-end states. The product should feel guided, not administrative.",
              },
              {
                title: "Designed for clinical complexity",
                description: "Scheduling, claims, medications, screening, and escalations belong in one system, not five tabs.",
              },
              {
                title: "Powered by coordinated agents",
                description: "OpenClaw agents handle the background work while patients and staff stay in one conversation layer.",
              },
            ].map((item) => (
              <div key={item.title} className="surface-muted p-5">
                <p className="text-sm font-semibold text-warm-800">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-warm-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-6 py-20">
          <div className="mb-10 max-w-2xl">
            <span className="eyebrow-pill">Platform</span>
            <h2 className="mt-4 text-4xl font-serif text-warm-800">Everything important stays on one visual system.</h2>
            <p className="mt-4 text-base leading-8 text-warm-600">
              No abrupt theme changes, no novelty dashboards, no mismatched interface language between search, screening,
              billing, and care coordination.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((feature) => (
              <Link key={feature.title} href={feature.href} className="surface-card group p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terra/10 text-terra-dark">
                  <feature.icon size={20} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-warm-800 transition group-hover:text-terra-dark">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-warm-600">{feature.description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-cloudy transition group-hover:gap-2 group-hover:text-terra-dark">
                  Explore
                  <ArrowRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-sand/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.5),rgba(247,240,229,0.9))] py-20">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <span className="eyebrow-pill">OpenClaw network</span>
                <h2 className="mt-4 text-4xl font-serif text-warm-800">
                  {OPENCLAW_CONFIG.agents.length} specialists, one shared care desk.
                </h2>
                <p className="mt-4 text-base leading-8 text-warm-600">
                  The agent layer is visible, but the interface stays quiet. The point is coordinated care, not an AI carnival.
                </p>
              </div>
              <span className="metric-chip text-accent">
                <Zap size={12} />
                Agent mesh live
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {OPENCLAW_CONFIG.agents.slice(0, 8).map((agent, index) => (
                <div key={agent.id} className={`rounded-[24px] border p-4 shadow-sm ${agentAccent(index)}`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">{agent.role.split(" ")[0]}</p>
                  <p className="mt-3 text-sm font-semibold">{agent.name}</p>
                  <p className="mt-2 text-[12px] leading-6 text-warm-600">{agent.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-6 py-20">
          <div className="mb-10 text-center">
            <span className="eyebrow-pill">How it works</span>
            <h2 className="mt-4 text-4xl font-serif text-warm-800">The flow should feel simple even when the system is not.</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {setupSteps.map((step) => (
              <div key={step.step} className="surface-card p-6">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-cloudy">{step.step}</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terra/10 text-terra-dark">
                    <step.icon size={16} />
                  </div>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-warm-800">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-warm-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-6 pb-24">
          <div className="surface-card overflow-hidden px-8 py-14 text-center">
            <span className="eyebrow-pill">
              <Heart size={11} />
              Start with one calm system
            </span>
            <h2 className="mt-5 text-4xl font-serif text-warm-800 lg:text-5xl">
              OpenRx should feel like one product from the first page onward.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-warm-600">
              Provider search, screening, billing review, and care coordination now share the same visual language,
              typography, and interaction pattern.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-full bg-terra px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-terra-dark"
              >
                Get started free
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-sand/70 bg-white/85 px-7 py-3.5 text-sm font-semibold text-warm-700 transition hover:border-terra/20 hover:text-warm-800"
              >
                Preview the dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-sand/60 bg-[rgba(255,251,245,0.75)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <BrandMark />
              <BrandWordmark subtitleClassName="text-cloudy/80" titleClassName="text-sm font-semibold text-warm-800" />
            </div>
            <p className="mt-4 max-w-xs text-sm leading-7 text-warm-600">
              OpenRx is the care operating system for patients and staff who want one coherent interface instead of a patchwork.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm text-warm-600">
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cloudy">Product</p>
              <FooterLink href="/dashboard" label="Dashboard" />
              <FooterLink href="/providers" label="Provider Search" />
              <FooterLink href="/chat" label="AI Concierge" />
              <FooterLink href="/billing" label="Billing" />
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cloudy">Trust</p>
              <FooterLink href="/privacy-explained" label="Privacy" />
              <FooterLink href="/compliance-ledger" label="Compliance Ledger" />
              <FooterLink href="/join-network" label="Join Network" />
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 border-t border-sand/60 px-6 py-5 text-[11px] text-cloudy sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} OpenRx · Powered by OpenClaw</p>
          <p>One visual system across onboarding, care, billing, and messaging.</p>
        </div>
      </footer>
    </div>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[22px] border border-sand/70 bg-white/82 px-4 py-3 shadow-sm">
      <p className="text-xl font-semibold leading-none text-warm-800">{value}</p>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-cloudy">{label}</p>
    </div>
  )
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="block transition hover:text-warm-800">
      {label}
    </Link>
  )
}
