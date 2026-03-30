"use client"

import Link from "next/link"
import {
  ArrowRight,
  Bot,
  Heart,
  Shield,
  Clock,
  FileCheck,
  Pill,
  Wallet,
  Lock,
  Activity,
  Zap,
  Users,
  Star,
  CheckCircle2,
  Sparkles,
  Eye,
  Search,
  ArrowUpRight,
  Stethoscope,
  FlaskConical,
  Calendar,
  Receipt,
  ShieldCheck,
  AlertCircle,
  ChevronRight,
  CircleDot,
  BarChart3,
  MapPin,
} from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal"

/* ─── Tiny building blocks ─── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-teal/10 bg-teal-50/60 px-3.5 py-1 text-[11px] font-semibold text-teal-700 tracking-wide">
      {children}
    </span>
  )
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow?: React.ReactNode; title: React.ReactNode; subtitle?: string }) {
  return (
    <div className="text-center">
      {eyebrow && <div className="reveal mb-5">{eyebrow}</div>}
      <h2 className="reveal font-serif text-display-lg text-primary">{title}</h2>
      {subtitle && (
        <p className="reveal mx-auto mt-4 max-w-lg text-body-lg text-secondary">{subtitle}</p>
      )}
    </div>
  )
}

/* ─── Care flow simulation — signature interaction ─── */
function CareFlowDemo() {
  const steps = [
    { label: "Screening due", status: "active" as const, detail: "Colonoscopy — age 45+", icon: Eye, color: "teal" },
    { label: "Provider found", status: "done" as const, detail: "GI specialist · 2.1 mi", icon: MapPin, color: "emerald" },
    { label: "Prior auth", status: "active" as const, detail: "Auto-submitted by Rex", icon: ShieldCheck, color: "amber" },
    { label: "Appointment", status: "pending" as const, detail: "Pending auth approval", icon: Calendar, color: "zinc" },
    { label: "Follow-up", status: "pending" as const, detail: "Results → care plan", icon: Activity, color: "zinc" },
  ]

  return (
    <div className="relative">
      {/* Vertical connector */}
      <div className="absolute left-5 top-8 bottom-8 w-px bg-gradient-to-b from-teal/20 via-teal/10 to-transparent" />

      <div className="space-y-3">
        {steps.map((step, i) => {
          const Icon = step.icon
          const isActive = step.status === "active"
          const isDone = step.status === "done"
          return (
            <div
              key={step.label}
              className={`
                relative flex items-start gap-4 rounded-xl px-3 py-3 transition-all
                ${isActive ? "bg-teal-50/40" : ""}
                ${isDone ? "opacity-70" : ""}
              `}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div
                className={`
                  relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
                  ${isDone ? "bg-emerald-50 text-emerald-600" : ""}
                  ${isActive ? "bg-teal-50 text-teal shadow-glow-sm" : ""}
                  ${step.status === "pending" ? "bg-zinc-50 text-zinc-400" : ""}
                `}
              >
                {isDone ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <Icon size={16} />
                )}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[13px] font-semibold ${isDone ? "text-secondary line-through" : isActive ? "text-primary" : "text-zinc-400"}`}>
                    {step.label}
                  </span>
                  {isActive && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-teal">
                      <CircleDot size={8} className="animate-pulse-soft" />
                      In progress
                    </span>
                  )}
                </div>
                <p className={`text-[12px] mt-0.5 ${isDone ? "text-muted" : isActive ? "text-secondary" : "text-zinc-400"}`}>
                  {step.detail}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Agent grid for "How it works" ─── */
const AGENT_CARDS = [
  {
    icon: Heart,
    name: "Sage",
    role: "Onboarding",
    what: "Sets up your care profile in a 2-minute conversation. Finds your PCP, pharmacy, and medications.",
    color: "bg-teal-50 text-teal",
  },
  {
    icon: Clock,
    name: "Cal",
    role: "Scheduling",
    what: "Insurance-aware booking, automatic reminders, and no-show follow-up.",
    color: "bg-violet-50 text-violet",
  },
  {
    icon: Pill,
    name: "Maya",
    role: "Medications",
    what: "Reconciles prescriptions, checks adherence, and sends refill reminders before you run out.",
    color: "bg-amber-50 text-amber",
  },
  {
    icon: Receipt,
    name: "Vera",
    role: "Billing",
    what: "Analyzes claims for errors, explains EOBs in plain English, and detects overbilling.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: ShieldCheck,
    name: "Rex",
    role: "Prior Auth",
    what: "Automates submissions, tracks status, and drafts appeals when claims are denied.",
    color: "bg-teal-50 text-teal-dark",
  },
  {
    icon: Activity,
    name: "Ivy & Quinn",
    role: "Prevention",
    what: "Age-appropriate screening, risk stratification, and follow-up prompts before things become urgent.",
    color: "bg-red-50 text-red-500",
  },
]

export default function LandingPage() {
  const year = new Date().getFullYear()
  const scrollRef = useScrollReveal()

  return (
    <div className="min-h-screen" ref={scrollRef}>
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <BrandMark />
            <BrandWordmark titleClassName="text-sm font-semibold text-primary" subtitleClassName="text-muted" />
          </div>
          <nav className="flex items-center gap-4" aria-label="Main navigation">
            <Link href="/privacy-explained" className="btn-ghost hidden sm:inline-flex">
              Privacy
            </Link>
            <Link href="/providers" className="btn-ghost hidden sm:inline-flex">
              Find Providers
            </Link>
            <Link href="/dashboard" className="btn-primary px-5 py-2 text-[13px]">
              Open Dashboard
              <ArrowRight size={13} />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden">
          <div className="bg-gradient-hero bg-mesh">
            <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-20 lg:pb-32 lg:pt-28">
              <div className="grid gap-16 lg:grid-cols-[1.15fr,0.85fr] lg:items-center">
                {/* Left: copy */}
                <div className="animate-hero-fade">
                  <Eyebrow>
                    <Sparkles size={11} />
                    Care coordination, handled
                  </Eyebrow>
                  <h1 className="mt-6 font-serif text-display-xl text-primary">
                    One calm place for{" "}
                    <span className="italic text-gradient-teal">everything</span>{" "}
                    between you and your health.
                  </h1>
                  <p className="mt-6 max-w-lg text-body-lg text-secondary">
                    Appointments, medications, labs, referrals, bills, prior auth, and preventive screenings —
                    coordinated by 12 AI agents so you always know what to do next.
                  </p>
                  <div className="mt-10 flex flex-wrap items-center gap-3 animate-hero-fade [animation-delay:0.15s]">
                    <Link href="/onboarding" className="btn-primary group text-[15px] px-7 py-3.5">
                      Get Started Free
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link href="/dashboard" className="btn-secondary text-[15px] px-7 py-3.5">
                      See the Dashboard
                    </Link>
                  </div>
                  <div className="mt-8 flex flex-wrap gap-6 text-[13px] text-secondary animate-hero-fade [animation-delay:0.3s]">
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-teal" /> No account needed</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-teal" /> Privacy-first</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-teal" /> Works without data</span>
                  </div>
                </div>

                {/* Right: care flow simulation */}
                <div className="hidden lg:block animate-hero-fade [animation-delay:0.2s]">
                  <div className="surface-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50">
                        <Activity size={14} className="text-teal" />
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-primary">Care Flow</p>
                        <p className="text-[10px] text-muted">Colonoscopy screening path</p>
                      </div>
                    </div>
                    <CareFlowDemo />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Social proof strip ─── */}
        <section className="border-b border-border/30">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-8 px-6 py-5 text-[12px] text-muted">
            {[
              "USPSTF screening guidelines",
              "NPI Registry verified",
              "Powered by Claude AI",
              "No data sold, ever",
            ].map((text) => (
              <span key={text} className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-teal/60" />
                {text}
              </span>
            ))}
          </div>
        </section>

        {/* ─── What OpenRx does differently ─── */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24" aria-label="Key differentiators">
          <SectionHeading
            eyebrow={<Eyebrow><Zap size={11} />Why OpenRx</Eyebrow>}
            title={<>Healthcare has too many <span className="italic text-gradient-teal">disconnected pieces</span></>}
            subtitle="Most patients juggle 5+ portals for appointments, prescriptions, labs, claims, and messages. OpenRx brings them into one workspace."
          />

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Search,
                title: "Know what's next",
                description: "A prioritized action rail shows overdue screenings, pending refills, unresolved claims, and upcoming appointments — not a random grid of modules.",
              },
              {
                icon: Users,
                title: "AI care team",
                description: "Twelve specialist agents handle scheduling, billing, prior auth, medication reconciliation, and screening behind the scenes.",
              },
              {
                icon: Shield,
                title: "Prevention first",
                description: "Age-appropriate screening reminders, risk stratification, and follow-up prompts surface before things become urgent.",
              },
              {
                icon: Eye,
                title: "Plain-English finance",
                description: "Claims explained without jargon. Deductible timing. Prior auth status. Overbilling detection. All in one calm view.",
              },
              {
                icon: Lock,
                title: "Privacy by default",
                description: "No account, no email, no PHI on-chain. Works in demo mode with zero personal data. Disconnect anytime.",
              },
              {
                icon: Stethoscope,
                title: "Second opinions & trials",
                description: "AI-assisted diagnosis review and clinical trial matching — so you feel confident and informed about your options.",
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className={`reveal reveal-delay-${(i % 3) + 1} surface-card-interactive p-6`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50/60">
                  <item.icon size={18} className="text-teal" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-primary">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-secondary">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── How the care team works ─── */}
        <section className="border-t border-border/30">
          <div className="bg-gradient-hero bg-mesh">
            <div className="relative mx-auto w-full max-w-6xl px-6 py-24">
              <SectionHeading
                eyebrow={<Eyebrow><Bot size={11} />The OpenClaw Engine</Eyebrow>}
                title={<>12 agents, one <span className="italic text-gradient-teal">coordinated</span> team</>}
                subtitle="Each agent is a specialist. Atlas orchestrates them all. You just ask a question — the right agent handles it."
              />

              <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {AGENT_CARDS.map((agent, i) => (
                  <div
                    key={agent.name}
                    className={`reveal reveal-delay-${(i % 3) + 1} surface-card overflow-hidden`}
                  >
                    <div className="p-5">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${agent.color.split(" ")[0]}`}>
                          <agent.icon size={16} className={agent.color.split(" ")[1]} strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-[14px] font-semibold text-primary">{agent.name}</h3>
                          <span className="text-[11px] text-muted">{agent.role}</span>
                        </div>
                      </div>
                      <p className="mt-3 text-[13px] leading-relaxed text-secondary">{agent.what}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Getting started ─── */}
        <section className="border-t border-border/30 bg-white">
          <div className="mx-auto w-full max-w-6xl px-6 py-24">
            <SectionHeading
              title={<>Up and running in <span className="italic text-gradient-teal">2 minutes</span></>}
            />
            <div className="mt-16 grid gap-10 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Connect (optional)",
                  description: "Use a Coinbase Smart Wallet as your pseudonymous identity. Or just explore in demo mode — no setup needed.",
                  icon: Wallet,
                },
                {
                  step: "02",
                  title: "Talk to Sage",
                  description: "Our onboarding agent builds your care profile through a short conversation. Find your PCP, pharmacy, and medications.",
                  icon: Heart,
                },
                {
                  step: "03",
                  title: "Your team gets to work",
                  description: "Twelve agents begin coordinating — scheduling screenings, checking refills, reviewing claims, and surfacing your next steps.",
                  icon: Zap,
                },
              ].map((item, i) => (
                <div key={item.step} className={`reveal reveal-delay-${i + 1} text-center`}>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-teal shadow-glow-sm">
                    <item.icon size={22} className="text-white" strokeWidth={1.5} />
                  </div>
                  <div className="mt-2 text-[11px] font-bold text-teal tracking-wider">{item.step}</div>
                  <h3 className="mt-2 text-[16px] font-semibold text-primary">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-secondary">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Trust & privacy ─── */}
        <section className="border-t border-border/30">
          <div className="bg-gradient-hero">
            <div className="relative mx-auto w-full max-w-6xl px-6 py-24">
              <SectionHeading
                eyebrow={<Eyebrow><Lock size={11} />Unusually transparent</Eyebrow>}
                title={<>Built for <span className="italic text-gradient-teal">trust</span>, not compliance theater</>}
                subtitle="We believe patients deserve clear answers about what happens to their data, not 40-page privacy policies."
              />
              <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: Lock,
                    title: "No data sold, ever",
                    description: "Your health data is never shared with advertisers, insurers, or data brokers. Full stop.",
                  },
                  {
                    icon: Shield,
                    title: "Demo mode works",
                    description: "Explore every feature without entering any personal information. Real privacy, not a checkbox.",
                  },
                  {
                    icon: Bot,
                    title: "AI you can audit",
                    description: "Powered by Claude. Your messages are not used to train models. Every agent decision is logged.",
                  },
                  {
                    icon: Wallet,
                    title: "No emails, no passwords",
                    description: "Wallet-based identity means no account to breach. Disconnect and your link is gone.",
                  },
                ].map((item, i) => (
                  <div key={item.title} className={`reveal reveal-delay-${i + 1} text-center`}>
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50/60">
                      <item.icon size={18} className="text-teal" strokeWidth={1.5} />
                    </div>
                    <h3 className="mt-3 text-[14px] font-semibold text-primary">{item.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Testimonial ─── */}
        <section className="border-t border-border/30 bg-white">
          <div className="mx-auto w-full max-w-6xl px-6 py-24">
            <div className="reveal surface-elevated mx-auto max-w-2xl overflow-hidden">
              <div className="p-8 sm:p-12 text-center">
                <div className="flex justify-center gap-0.5 mb-5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="text-amber fill-amber" />
                  ))}
                </div>
                <blockquote className="text-[17px] font-medium leading-relaxed text-primary">
                  &ldquo;I spent months juggling portals for appointments, prescriptions, and insurance. OpenRx replaced all of them with one conversation.&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-teal flex items-center justify-center text-white text-xs font-bold">
                    A
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] font-semibold text-primary">Anonymous Patient</p>
                    <p className="text-[11px] text-muted">Wallet-verified user</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="border-t border-border/30">
          <div className="bg-gradient-hero bg-mesh">
            <div className="relative reveal mx-auto w-full max-w-6xl px-6 py-24 text-center">
              <h2 className="font-serif text-display-lg text-primary">
                Ready to see healthcare{" "}
                <span className="italic text-gradient-teal">make sense?</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-body-lg text-secondary">
                Connect a wallet, build your profile, and let your AI care team handle the coordination.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4">
                <Link href="/onboarding" className="btn-primary group text-[15px] px-8 py-4">
                  Get Started Free
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <span className="text-[12px] text-muted">No sign-up forms. No credit card. Just connect and go.</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/30 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <span className="text-sm font-semibold text-primary">OpenRx</span>
          </div>
          <nav className="flex flex-wrap gap-6 text-[13px] text-secondary" aria-label="Footer navigation">
            <Link href="/dashboard" className="transition hover:text-teal">Dashboard</Link>
            <Link href="/providers" className="transition hover:text-teal">Providers</Link>
            <Link href="/privacy-explained" className="transition hover:text-teal">Privacy</Link>
            <Link href="/join-network" className="transition hover:text-teal">Join Network</Link>
          </nav>
        </div>
        <div className="border-t border-border/30">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-[11px] text-muted">
            <span>&copy; {year} OpenRx &middot; Powered by OpenClaw</span>
            <span>Not a substitute for professional medical advice.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
