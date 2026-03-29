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
} from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal"

function FloatingOrb({ className }: { className?: string }) {
  return (
    <div
      className={`absolute rounded-full blur-3xl opacity-30 animate-float ${className}`}
      aria-hidden="true"
    />
  )
}

function AgentAvatar({ icon: Icon, color, delay = "0s" }: { icon: typeof Bot; color: string; delay?: string }) {
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white shadow-card transition-transform hover:scale-110"
      style={{ animationDelay: delay }}
    >
      <Icon size={18} className={color} strokeWidth={1.5} />
    </div>
  )
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-white/80 backdrop-blur-sm px-4 py-2 shadow-card">
      <span className="text-sm font-bold text-teal">{value}</span>
      <span className="text-xs text-secondary">{label}</span>
    </div>
  )
}

export default function LandingPage() {
  const year = new Date().getFullYear()
  const scrollRef = useScrollReveal()

  return (
    <div className="min-h-screen" ref={scrollRef}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <BrandMark />
            <BrandWordmark titleClassName="text-sm font-semibold text-primary" subtitleClassName="text-muted" />
          </div>
          <nav className="flex items-center gap-5" aria-label="Main navigation">
            <Link
              href="/privacy-explained"
              className="hidden text-[13px] font-medium text-secondary transition hover:text-teal sm:inline"
            >
              Privacy
            </Link>
            <Link
              href="/providers"
              className="hidden text-[13px] font-medium text-secondary transition hover:text-teal sm:inline"
            >
              Providers
            </Link>
            <Link
              href="/dashboard"
              className="btn-primary rounded-full px-5 py-2.5 text-[13px]"
            >
              Open Dashboard
              <ArrowRight size={13} />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="bg-gradient-hero bg-mesh">
            <FloatingOrb className="h-72 w-72 bg-teal-200 -top-20 -left-20" />
            <FloatingOrb className="h-64 w-64 bg-violet-50 top-20 right-0 [animation-delay:1s]" />
            <FloatingOrb className="h-48 w-48 bg-teal-100 bottom-0 left-1/3 [animation-delay:2s]" />

            <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-20 lg:pb-32 lg:pt-28">
              <div className="grid gap-16 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
                <div className="animate-hero-fade">
                  <div className="badge-teal mb-6">
                    <Sparkles size={12} />
                    AI-Powered Healthcare
                  </div>
                  <h1 className="font-serif text-display-xl text-primary">
                    Healthcare that{" "}
                    <span className="italic text-gradient-teal">works for you</span>,{" "}
                    not against you.
                  </h1>
                  <p className="mt-6 max-w-lg text-lg leading-relaxed text-secondary">
                    12 AI agents coordinate your care, screening, billing, and follow-ups
                    in one calm workspace. No accounts, no passwords.
                  </p>
                  <div className="mt-10 flex flex-wrap items-center gap-4 animate-hero-fade [animation-delay:0.2s]">
                    <Link href="/onboarding" className="btn-primary group text-[15px]">
                      Get Started Free
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link href="/dashboard" className="btn-secondary text-[15px]">
                      See the Dashboard
                    </Link>
                  </div>
                  <div className="mt-8 flex flex-wrap gap-3 animate-hero-fade [animation-delay:0.4s]">
                    <StatPill value="12" label="AI agents" />
                    <StatPill value="24/7" label="availability" />
                    <StatPill value="HIPAA" label="compliant" />
                  </div>
                </div>

                {/* Agent constellation */}
                <div className="relative hidden lg:block animate-hero-fade [animation-delay:0.3s]">
                  <div className="relative mx-auto h-80 w-80">
                    {/* Central hub */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-teal shadow-glow-teal">
                        <Bot size={32} className="text-white" strokeWidth={1.5} />
                      </div>
                      <p className="mt-2 text-center text-[11px] font-semibold text-teal">Atlas</p>
                    </div>
                    {/* Orbiting agents */}
                    {[
                      { icon: Heart, color: "text-teal", x: -80, y: -100, label: "Sage" },
                      { icon: Clock, color: "text-violet", x: 80, y: -90, label: "Cal" },
                      { icon: Pill, color: "text-amber", x: 110, y: 20, label: "Maya" },
                      { icon: Shield, color: "text-soft-blue", x: 60, y: 100, label: "Vera" },
                      { icon: Activity, color: "text-accent", x: -70, y: 90, label: "Ivy" },
                      { icon: FileCheck, color: "text-coral", x: -110, y: 0, label: "Rex" },
                    ].map((agent) => (
                      <div
                        key={agent.label}
                        className="absolute left-1/2 top-1/2 animate-float"
                        style={{
                          transform: `translate(calc(-50% + ${agent.x}px), calc(-50% + ${agent.y}px))`,
                          animationDelay: `${Math.random() * 2}s`,
                        }}
                      >
                        <AgentAvatar icon={agent.icon} color={agent.color} />
                        <p className="mt-1 text-center text-[9px] font-medium text-muted">{agent.label}</p>
                      </div>
                    ))}
                    {/* Connection lines (decorative) */}
                    <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                      {[
                        { x1: "50%", y1: "50%", x2: "25%", y2: "18%" },
                        { x1: "50%", y1: "50%", x2: "75%", y2: "22%" },
                        { x1: "50%", y1: "50%", x2: "84%", y2: "56%" },
                        { x1: "50%", y1: "50%", x2: "69%", y2: "81%" },
                        { x1: "50%", y1: "50%", x2: "28%", y2: "78%" },
                        { x1: "50%", y1: "50%", x2: "16%", y2: "50%" },
                      ].map((line, i) => (
                        <line
                          key={i}
                          {...line}
                          stroke="url(#line-gradient)"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                          opacity="0.3"
                        />
                      ))}
                      <defs>
                        <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#0D9488" />
                          <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof strip */}
        <section className="border-b border-border/40 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-8 px-6 py-6 text-[13px] text-muted">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-accent" />
              <span>USPSTF screening guidelines</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-accent" />
              <span>NPI Registry verified</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-accent" />
              <span>Powered by Claude AI</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-accent" />
              <span>No data sold, ever</span>
            </div>
          </div>
        </section>

        {/* Value propositions */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24" aria-label="Key features">
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {[
              {
                icon: Bot,
                color: "bg-teal-50 text-teal",
                title: "AI Care Team",
                description: "Twelve specialized agents coordinate scheduling, billing, prescriptions, and screening behind the scenes.",
              },
              {
                icon: Shield,
                color: "bg-violet-50 text-violet",
                title: "One Workspace",
                description: "Appointments, medications, labs, claims, and messages live in one place instead of five disconnected portals.",
              },
              {
                icon: Heart,
                color: "bg-teal-50 text-accent",
                title: "Prevention First",
                description: "Age-appropriate screening, risk stratification, and follow-up prompts surface before things become urgent.",
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className={`reveal reveal-delay-${i + 1} surface-card-interactive p-6`}
              >
                <div className={`icon-container-sm rounded-xl ${item.color.split(" ")[0]}`}>
                  <item.icon size={18} className={item.color.split(" ")[1]} strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="relative overflow-hidden border-t border-border/40">
          <div className="bg-gradient-hero">
            <FloatingOrb className="h-96 w-96 bg-teal-100 -top-40 right-0" />
            <div className="relative mx-auto w-full max-w-6xl px-6 py-24">
              <div className="text-center">
                <span className="reveal badge-teal">
                  <Zap size={12} />
                  The OpenClaw Engine
                </span>
                <h2 className="reveal mt-4 font-serif text-display-lg text-primary">
                  How <span className="italic text-gradient-teal">OpenClaw</span> works
                </h2>
                <p className="reveal mx-auto mt-4 max-w-lg text-base text-secondary">
                  Twelve AI agents handle the tedious parts of healthcare — each one a specialist, all working together.
                </p>
              </div>
              <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    icon: Clock,
                    color: "bg-violet-50 text-violet",
                    gradient: "from-violet-50 to-white",
                    title: "Smart Scheduling",
                    agent: "Cal",
                    description: "Insurance-aware booking, automatic reminders, and no-show follow-up.",
                  },
                  {
                    icon: FileCheck,
                    color: "bg-teal-50 text-teal",
                    gradient: "from-teal-50 to-white",
                    title: "Prior Authorization",
                    agent: "Rex",
                    description: "Automates submissions, tracks status, and drafts appeals when claims are denied.",
                  },
                  {
                    icon: Pill,
                    color: "bg-amber-50 text-amber",
                    gradient: "from-amber-50 to-white",
                    title: "Medication Management",
                    agent: "Maya",
                    description: "Reconciles prescriptions, checks adherence, and sends refill reminders before you run out.",
                  },
                  {
                    icon: Activity,
                    color: "bg-teal-50 text-accent",
                    gradient: "from-teal-50 to-white",
                    title: "Triage & Screening",
                    agent: "Nova & Quinn",
                    description: "After-hours symptom assessment and preventive screening based on USPSTF guidelines.",
                  },
                  {
                    icon: Wallet,
                    color: "bg-violet-50 text-violet",
                    gradient: "from-violet-50 to-white",
                    title: "Billing & Claims",
                    agent: "Vera",
                    description: "Analyzes claims for errors, detects overbilling, and helps you understand your EOBs.",
                  },
                  {
                    icon: Users,
                    color: "bg-teal-50 text-teal-dark",
                    gradient: "from-teal-50 to-white",
                    title: "Second Opinions",
                    agent: "Orion",
                    description: "Reviews diagnoses and care plans so you can feel confident in your treatment path.",
                  },
                ].map((item, i) => (
                  <div
                    key={item.title}
                    className={`reveal reveal-delay-${(i % 3) + 1} group surface-card-interactive overflow-hidden`}
                  >
                    <div className={`bg-gradient-to-b ${item.gradient} px-6 pt-6 pb-4`}>
                      <div className={`icon-container-sm rounded-xl ${item.color.split(" ")[0]}`}>
                        <item.icon size={18} className={item.color.split(" ")[1]} strokeWidth={1.5} aria-hidden="true" />
                      </div>
                      <h3 className="mt-3 text-[15px] font-semibold text-primary">{item.title}</h3>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-soft" />
                        <span className="text-[11px] font-medium text-teal">{item.agent}</span>
                      </div>
                    </div>
                    <div className="px-6 pb-6 pt-2">
                      <p className="text-sm leading-relaxed text-secondary">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How it works steps */}
        <section className="border-t border-border/40 bg-white">
          <div className="mx-auto w-full max-w-6xl px-6 py-24">
            <h2 className="reveal text-center font-serif text-display-lg text-primary">
              Get started in <span className="italic text-gradient-teal">3 steps</span>
            </h2>
            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Connect your wallet",
                  description: "Use a Coinbase Smart Wallet as your pseudonymous login. No passwords, no emails — disconnect anytime.",
                  icon: Wallet,
                },
                {
                  step: "02",
                  title: "Chat with Sage",
                  description: "Our onboarding agent sets up your care profile in a 2-minute conversation. Find your PCP, pharmacy, and medications.",
                  icon: Heart,
                },
                {
                  step: "03",
                  title: "Your team gets to work",
                  description: "12 agents start coordinating — scheduling screenings, checking adherence, reviewing claims, and more.",
                  icon: Zap,
                },
              ].map((item, i) => (
                <div key={item.step} className={`reveal reveal-delay-${i + 1} text-center`}>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-teal shadow-glow-sm">
                    <item.icon size={24} className="text-white" strokeWidth={1.5} />
                  </div>
                  <div className="mt-1 text-[11px] font-bold text-teal">{item.step}</div>
                  <h3 className="mt-2 text-[16px] font-semibold text-primary">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust signals */}
        <section className="relative overflow-hidden border-t border-border/40">
          <div className="bg-gradient-hero">
            <FloatingOrb className="h-64 w-64 bg-violet-50 top-10 left-10 [animation-delay:0.5s]" />
            <div className="relative mx-auto w-full max-w-6xl px-6 py-24">
              <div className="text-center">
                <span className="reveal badge-teal">
                  <Lock size={12} />
                  Security & Privacy
                </span>
                <h2 className="reveal mt-4 font-serif text-display-lg text-primary">
                  Built for <span className="italic text-gradient-teal">trust</span>
                </h2>
              </div>
              <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: Lock,
                    color: "bg-teal-50 text-teal",
                    title: "No data sold, ever",
                    description: "Your health information is never shared with advertisers, insurers, or data brokers.",
                  },
                  {
                    icon: Shield,
                    color: "bg-violet-50 text-violet",
                    title: "Privacy by design",
                    description: "Works in demo mode with zero personal data. No account required to explore.",
                  },
                  {
                    icon: Bot,
                    color: "bg-teal-50 text-teal-dark",
                    title: "AI that respects you",
                    description: "Powered by Claude (Anthropic). Your messages are not used to train AI models.",
                  },
                  {
                    icon: Wallet,
                    color: "bg-amber-50 text-amber",
                    title: "Wallet-based identity",
                    description: "No passwords or emails. A Coinbase Smart Wallet is your pseudonymous login.",
                  },
                ].map((item, i) => (
                  <div key={item.title} className={`reveal reveal-delay-${i + 1} text-center`}>
                    <div className={`mx-auto icon-container-md rounded-2xl ${item.color.split(" ")[0]} shadow-card`}>
                      <item.icon size={20} className={item.color.split(" ")[1]} strokeWidth={1.5} aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-[14px] font-semibold text-primary">{item.title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-secondary">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Testimonial / social proof */}
        <section className="border-t border-border/40 bg-white">
          <div className="mx-auto w-full max-w-6xl px-6 py-24">
            <div className="reveal surface-elevated mx-auto max-w-3xl overflow-hidden">
              <div className="bg-gradient-to-r from-teal-50 via-white to-violet-50 p-8 sm:p-12 text-center">
                <div className="flex justify-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="text-amber fill-amber" />
                  ))}
                </div>
                <blockquote className="text-lg font-medium leading-relaxed text-primary italic">
                  &ldquo;I spent months juggling portals for appointments, prescriptions, and insurance. OpenRx replaced all of them with one conversation.&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-teal flex items-center justify-center text-white text-sm font-bold">
                    A
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-primary">Anonymous Patient</p>
                    <p className="text-xs text-muted">Wallet-verified user</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden border-t border-border/40">
          <div className="bg-gradient-hero bg-mesh">
            <FloatingOrb className="h-80 w-80 bg-teal-200 top-0 right-1/4 [animation-delay:1s]" />
            <div className="relative reveal mx-auto w-full max-w-6xl px-6 py-24 text-center">
              <h2 className="font-serif text-display-lg text-primary">
                Ready to <span className="italic text-gradient-teal">take control?</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base text-secondary">
                Connect a wallet, build your health profile, and let your AI care team handle the coordination.
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

      <footer className="border-t border-border/40 bg-white">
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
        <div className="border-t border-border/40">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-[11px] text-muted">
            <span>&copy; {year} OpenRx &middot; Powered by OpenClaw</span>
            <span>Not a substitute for professional medical advice.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
