"use client"

import Link from "next/link"
import { ArrowRight, Bot, Heart, Shield } from "lucide-react"
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
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-button bg-teal px-4 py-2 text-[13px] font-medium text-white transition hover:bg-teal-dark"
            >
              Open Dashboard
              <ArrowRight size={13} />
            </Link>
          </div>
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
            </p>
            <div className="mt-10 flex items-center gap-4 animate-hero-fade [animation-delay:0.2s]">
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
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="grid gap-8 md:grid-cols-3">
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
                <item.icon size={20} className="text-teal" strokeWidth={1.5} />
                <h3 className="mt-3 text-[15px] font-semibold text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/60 bg-white">
          <div className="reveal mx-auto w-full max-w-6xl px-6 py-24 text-center">
            <h2 className="font-serif text-display-lg text-primary">
              Ready to <span className="italic text-gradient-teal">start?</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base text-secondary">
              Connect your wallet, build your profile, and let OpenRx handle the coordination.
            </p>
            <div className="mt-8">
              <Link
                href="/onboarding"
                className="group inline-flex items-center gap-2 rounded-button bg-teal px-7 py-3.5 text-[15px] font-medium text-white transition hover:bg-teal-dark"
              >
                Get Started
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
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
          <div className="flex flex-wrap gap-6 text-sm text-secondary">
            <Link href="/dashboard" className="transition hover:text-primary">Dashboard</Link>
            <Link href="/providers" className="transition hover:text-primary">Providers</Link>
            <Link href="/privacy-explained" className="transition hover:text-primary">Privacy</Link>
            <Link href="/join-network" className="transition hover:text-primary">Join Network</Link>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto w-full max-w-6xl px-6 py-4 text-[11px] text-muted">
            © {year} OpenRx · Powered by OpenClaw
          </div>
        </div>
      </footer>
    </div>
  )
}
