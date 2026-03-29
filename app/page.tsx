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
} from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal"

export default function LandingPage() {
  const year = new Date().getFullYear()
  const scrollRef = useScrollReveal()

  return (
    <div className="min-h-screen" ref={scrollRef}>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-[rgba(250,250,248,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <BrandMark />
            <BrandWordmark titleClassName="text-sm font-semibold text-primary" subtitleClassName="text-muted" />
          </div>
          <nav className="flex items-center gap-3" aria-label="Main navigation">
            <Link
              href="/privacy-explained"
              className="hidden text-[13px] font-medium text-secondary transition hover:text-primary sm:inline"
            >
              Privacy
            </Link>
            <Link
              href="/providers"
              className="hidden text-[13px] font-medium text-secondary transition hover:text-primary sm:inline"
            >
              Providers
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-button bg-teal px-4 py-2 text-[13px] font-medium text-white transition hover:bg-teal-dark"
            >
              Open Dashboard
              <ArrowRight size={13} />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-24 lg:pt-32">
          <div className="max-w-3xl animate-hero-fade">
            <h1 className="font-serif text-display-xl text-primary">
              Healthcare that stays{" "}
              <span className="italic text-gradient-teal">out of your way.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-secondary">
              AI-coordinated care, screening, and follow-up in one calm workspace.
              No accounts, no passwords — just connect a wallet and go.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4 animate-hero-fade [animation-delay:0.2s]">
              <Link
                href="/onboarding"
                className="group inline-flex items-center gap-2 rounded-button bg-teal px-6 py-3 text-[15px] font-medium text-white transition hover:bg-teal-dark"
              >
                Get Started
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/dashboard"
                className="text-[15px] font-medium text-secondary transition hover:text-primary"
              >
                See the dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* Value strip */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-24" aria-label="Key features">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
            {[
              {
                icon: Bot,
                title: "AI Care Team",
                description: "Twelve specialized agents coordinate scheduling, billing, prescriptions, and screening behind the scenes.",
              },
              {
                icon: Shield,
                title: "One Workspace",
                description: "Appointments, medications, labs, claims, and messages live in one place instead of five disconnected portals.",
              },
              {
                icon: Heart,
                title: "Prevention First",
                description: "Age-appropriate screening, risk stratification, and follow-up prompts surface before things become urgent.",
              },
            ].map((item) => (
              <div key={item.title} className="reveal">
                <item.icon size={20} className="text-teal" strokeWidth={1.5} aria-hidden="true" />
                <h3 className="mt-3 text-[15px] font-semibold text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border/60 bg-white">
          <div className="mx-auto w-full max-w-6xl px-6 py-24">
            <h2 className="reveal font-serif text-display-lg text-primary text-center">
              How <span className="italic text-gradient-teal">OpenClaw</span> works
            </h2>
            <p className="reveal mx-auto mt-4 max-w-lg text-center text-base text-secondary">
              Twelve AI agents handle the tedious parts of healthcare — each one a specialist, all working together.
            </p>
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Clock,
                  title: "Smart Scheduling",
                  agent: "Cal",
                  description: "Insurance-aware booking, automatic reminders, and no-show follow-up.",
                },
                {
                  icon: FileCheck,
                  title: "Prior Authorization",
                  agent: "Rex",
                  description: "Automates submissions, tracks status, and drafts appeals when claims are denied.",
                },
                {
                  icon: Pill,
                  title: "Medication Management",
                  agent: "Maya",
                  description: "Reconciles prescriptions, checks adherence, and sends refill reminders before you run out.",
                },
                {
                  icon: Activity,
                  title: "Triage & Screening",
                  agent: "Nova & Quinn",
                  description: "After-hours symptom assessment and preventive screening based on USPSTF guidelines.",
                },
                {
                  icon: Wallet,
                  title: "Billing & Claims",
                  agent: "Vera",
                  description: "Analyzes claims for errors, detects overbilling, and helps you understand your EOBs.",
                },
                {
                  icon: Shield,
                  title: "Second Opinions",
                  agent: "Orion",
                  description: "Reviews diagnoses and care plans so you can feel confident in your treatment path.",
                },
              ].map((item) => (
                <div key={item.title} className="reveal rounded-2xl border border-border/60 bg-surface p-5">
                  <item.icon size={18} className="text-teal" strokeWidth={1.5} aria-hidden="true" />
                  <h3 className="mt-3 text-[15px] font-semibold text-primary">{item.title}</h3>
                  <p className="mt-0.5 text-[11px] font-medium text-teal">{item.agent}</p>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust signals */}
        <section className="border-t border-border/60">
          <div className="mx-auto w-full max-w-6xl px-6 py-24">
            <h2 className="reveal font-serif text-display-lg text-primary text-center">
              Built for <span className="italic text-gradient-teal">trust</span>
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Lock,
                  title: "No data sold, ever",
                  description: "Your health information is never shared with advertisers, insurers, or data brokers.",
                },
                {
                  icon: Shield,
                  title: "Privacy by design",
                  description: "Works in demo mode with zero personal data. No account required to explore.",
                },
                {
                  icon: Bot,
                  title: "AI that doesn't train on you",
                  description: "Powered by Claude (Anthropic). Your messages are not used to train AI models.",
                },
                {
                  icon: Wallet,
                  title: "Wallet-based identity",
                  description: "No passwords or emails. A Coinbase Smart Wallet is your pseudonymous login — disconnect anytime.",
                },
              ].map((item) => (
                <div key={item.title} className="reveal text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10">
                    <item.icon size={18} className="text-teal" strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <h3 className="mt-3 text-[14px] font-semibold text-primary">{item.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/60 bg-white">
          <div className="reveal mx-auto w-full max-w-6xl px-6 py-24 text-center">
            <h2 className="font-serif text-display-lg text-primary">
              Ready to <span className="italic text-gradient-teal">start?</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base text-secondary">
              Connect a Coinbase Smart Wallet, build your health profile, and let OpenRx handle the coordination. No sign-up forms, no passwords.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Link
                href="/onboarding"
                className="group inline-flex items-center gap-2 rounded-button bg-teal px-7 py-3.5 text-[15px] font-medium text-white transition hover:bg-teal-dark"
              >
                Get Started
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <span className="text-[12px] text-muted">Free to use · No credit card required</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <span className="text-sm font-medium text-primary">OpenRx</span>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm text-secondary" aria-label="Footer navigation">
            <Link href="/dashboard" className="transition hover:text-primary">Dashboard</Link>
            <Link href="/providers" className="transition hover:text-primary">Providers</Link>
            <Link href="/privacy-explained" className="transition hover:text-primary">Privacy</Link>
            <Link href="/join-network" className="transition hover:text-primary">Join Network</Link>
          </nav>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-[11px] text-muted">
            <span>© {year} OpenRx · Powered by OpenClaw</span>
            <span>Not a substitute for professional medical advice.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
