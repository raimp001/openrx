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
} from "lucide-react"
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream text-warm-800">
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

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 pb-14 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-terra/20 bg-terra/10 px-4 py-1.5 text-xs font-bold text-terra">
            <Sparkles size={13} />
            Built for patients who want zero friction
          </div>
          <h1 className="mt-6 text-5xl leading-[1.03] text-warm-800 lg:text-6xl">
            Healthcare that feels
            <br />
            <span className="text-terra">surprisingly effortless.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-warm-600">
            OpenRx combines natural-language care search, smart scheduling, payment transparency, and AI care
            coordination into one product patients actually enjoy using.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-xl bg-terra px-6 py-3 text-sm font-bold text-white shadow-xl shadow-terra/25 transition hover:bg-terra-dark"
            >
              Get started
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/providers"
              className="inline-flex items-center gap-2 rounded-xl border border-sand bg-pampas px-6 py-3 text-sm font-bold text-warm-800 transition hover:border-terra/30"
            >
              <Search size={15} className="text-terra" />
              Find providers near me
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap gap-3 text-xs font-semibold text-warm-500">
            <span className="rounded-full border border-sand bg-pampas px-3 py-1">Natural language search</span>
            <span className="rounded-full border border-sand bg-pampas px-3 py-1">NPI-aware provider matching</span>
            <span className="rounded-full border border-sand bg-pampas px-3 py-1">Payments + compliance ledger</span>
          </div>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="border-b border-sand/70 bg-cream/70 px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cloudy">Today in your care hub</p>
          </div>
          <div className="space-y-3 p-5">
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
              <div key={item.title} className="surface-muted flex items-start gap-3 px-3 py-3">
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
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-14">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { value: `${OPENCLAW_CONFIG.agents.length}`, label: "Specialist agents", icon: CheckCircle2 },
            { value: "Live", label: "NPI data source", icon: TrendingUp },
            { value: "Natural language", label: "Search input mode", icon: Calendar },
            { value: "Wallet linked", label: "Patient identity", icon: Users },
          ].map((s) => (
            <div key={s.label} className="surface-card p-5 text-center">
              <s.icon size={22} className="mx-auto mb-3 text-terra" />
              <p className="text-3xl font-bold text-warm-800">{s.value}</p>
              <p className="mt-1 text-xs font-medium text-warm-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-14">
        <div className="mb-6 text-center">
          <h2 className="text-3xl text-warm-800">Designed like the best consumer apps</h2>
          <p className="mt-2 text-sm text-warm-500">
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
            },
            {
              icon: Receipt,
              title: "Billing clarity by default",
              desc: "Receipts, attestations, and refunds are tracked with a compliance-ready ledger.",
              href: "/compliance-ledger",
            },
            {
              icon: ShieldCheck,
              title: "Safety built in",
              desc: "Second opinions, prior auth automation, and escalation paths for urgent issues.",
              href: "/second-opinion",
            },
            {
              icon: MessageSquare,
              title: "Conversations in one stream",
              desc: "Patient messages, care updates, and AI triage are unified so nothing gets lost.",
              href: "/messages",
            },
            {
              icon: Bot,
              title: "Natural-language everything",
              desc: "Search providers, ask screening questions, and coordinate care in plain English.",
              href: "/chat",
            },
            {
              icon: Pill,
              title: "Medication confidence",
              desc: "Smart adherence tracking, refill alerts, and pharmacy-aware pricing decisions.",
              href: "/prescriptions",
            },
          ].map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="surface-card group p-5 transition-all hover:-translate-y-0.5 hover:border-terra/25"
            >
              <feature.icon size={22} className="mb-4 text-terra transition-transform group-hover:scale-110" />
              <h3 className="text-base font-bold text-warm-800 group-hover:text-terra">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-warm-500">{feature.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-terra">
                Explore <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="surface-card overflow-hidden">
          <div className="border-b border-sand/70 bg-cream/60 px-6 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cloudy">OpenClaw agent network</p>
            <h3 className="mt-1 text-2xl text-warm-800">{OPENCLAW_CONFIG.agents.length} specialists working as one care team</h3>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {OPENCLAW_CONFIG.agents.slice(0, 8).map((agent) => (
              <div key={agent.id} className="surface-muted px-3 py-3">
                <p className="text-sm font-semibold text-warm-800">{agent.name}</p>
                <p className="text-[11px] font-semibold text-terra">{agent.role}</p>
                <p className="mt-1 text-[11px] text-cloudy">Cross-collaborates in real time.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-sand/70 bg-pampas">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7 text-xs text-warm-500">
          <p>OpenRx · Powered by OpenClaw</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy-explained" className="hover:text-terra transition">Privacy</Link>
            <p>Live data environment · wallet-linked patient context</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
