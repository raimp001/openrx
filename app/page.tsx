"use client"

import Link from "next/link"
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  MapPin,
  ShieldCheck,
} from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import { CareAskPanel } from "@/components/care-ask-panel"
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal"

const screeningPath = [
  {
    label: "Check what is due",
    detail: "Start with age, location, prior screening, symptoms, and family history.",
    icon: ClipboardCheck,
  },
  {
    label: "Choose the right path",
    detail: "FIT, colonoscopy, primary care referral, or urgent clinician follow-up.",
    icon: HeartPulse,
  },
  {
    label: "Find a realistic option",
    detail: "Surface nearby care options, access caveats, and the questions to ask.",
    icon: MapPin,
  },
  {
    label: "Track follow-up",
    detail: "Keep the next action visible until the screening and results are complete.",
    icon: CalendarCheck,
  },
]

const outcomes = [
  "Screening due",
  "Referral or order path",
  "Coverage questions",
  "Follow-up reminders",
]

export default function LandingPage() {
  const scrollRef = useScrollReveal()

  return (
    <div ref={scrollRef} className="relative min-h-screen overflow-hidden bg-surface">
      <div className="pointer-events-none absolute left-1/2 top-14 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(29,78,216,0.15),transparent_63%)] blur-3xl" />
      <div className="pointer-events-none absolute right-[-8rem] top-1/3 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(8,126,139,0.11),transparent_62%)] blur-3xl" />

      <header className="sticky top-0 z-50 border-b border-[rgba(82,108,139,0.12)] bg-[rgba(247,250,255,0.82)] backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="OpenRx home">
            <BrandMark size="sm" />
            <BrandWordmark titleClassName="text-[15px] font-semibold text-primary" subtitle={false} />
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-[rgba(82,108,139,0.12)] bg-white/60 p-1 text-sm font-medium text-secondary sm:flex">
            <Link href="/screening" className="rounded-full px-4 py-2 transition hover:bg-white hover:text-primary">
              Screening
            </Link>
            <Link href="/providers" className="rounded-full px-4 py-2 transition hover:bg-white hover:text-primary">
              Find care
            </Link>
            <Link href="/dashboard" className="rounded-full px-4 py-2 transition hover:bg-white hover:text-primary">
              Demo
            </Link>
          </nav>
          <Link
            href="/chat"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(7,17,31,0.16)] transition hover:bg-[#12213a]"
          >
            Ask
          </Link>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-7xl flex-col px-5 pb-20 pt-12 sm:px-6 lg:pt-20">
        <section className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(82,108,139,0.13)] bg-white/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            <CheckCircle2 size={13} className="text-accent" />
            Preventive screening, start to finish
          </div>
          <h1 className="mt-7 font-serif text-[clamp(3.6rem,9vw,8.7rem)] leading-[0.82] tracking-[-0.085em] text-primary">
            Finish the
            <br />
            screening.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-secondary">
            OpenRx helps patients understand which preventive screening is due, find the next real-world step, and keep follow-up from getting lost.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/screening" className="control-button-primary px-5 py-3.5 text-sm">
              Check my screening
              <ArrowRight size={15} />
            </Link>
            <Link href="/chat" className="control-button-secondary px-5 py-3.5 text-sm">
              Ask a question first
            </Link>
          </div>
          <p className="mx-auto mt-4 max-w-xl text-xs leading-6 text-muted">
            Explore without an account. Add personal details only when you want a more specific care plan.
          </p>
        </section>

        <section className="mx-auto mt-10 grid w-full max-w-6xl gap-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <div className="surface-card reveal p-5 sm:p-6">
            <p className="section-title">Example journey</p>
            <h2 className="mt-4 max-w-xl text-[clamp(2.1rem,4vw,4rem)] text-primary">
              47, overdue, not sure who orders it.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-secondary">
              The product should answer the patient&apos;s actual question: what screening is appropriate, who can help, what to ask insurance, and what happens after the appointment.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {outcomes.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-full bg-white/72 px-3 py-2 text-sm font-semibold text-primary">
                  <CheckCircle2 size={14} className="text-accent" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <CareAskPanel
            eyebrow="Ask OpenRx"
            title="One question is enough."
            description="Try: I am 55 and overdue for colon cancer screening. What should I book first?"
            placeholder="Ask about screenings, referrals, coverage, or follow-up..."
            className="reveal reveal-delay-1 border-[rgba(82,108,139,0.16)] bg-white/82 shadow-[0_28px_90px_rgba(8,24,46,0.10)]"
          />
        </section>

        <section className="mx-auto mt-14 grid w-full max-w-6xl gap-3 md:grid-cols-4">
          {screeningPath.map((item, index) => (
            <div key={item.label} className="execution-step reveal">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white">
                  <item.icon size={17} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">0{index + 1}</span>
              </div>
              <p className="mt-5 text-lg font-semibold text-primary">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-secondary">{item.detail}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto mt-14 w-full max-w-4xl text-center">
          <div className="surface-card reveal p-6 sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white">
              <ShieldCheck size={19} />
            </div>
            <h2 className="mx-auto mt-5 max-w-2xl text-[clamp(2rem,4vw,3.7rem)] text-primary">
              Built for the handoff, not the hype.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-secondary">
              AI can draft, route, and remind. Clinicians still diagnose, order, treat, and confirm eligibility. OpenRx keeps that boundary visible.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/screening" className="control-button-primary px-5 py-3.5 text-sm">
                Start screening check
              </Link>
              <Link href="/privacy-explained" className="control-button-secondary px-5 py-3.5 text-sm">
                Read privacy notes
              </Link>
            </div>
          </div>
        </section>

        <footer className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[rgba(82,108,139,0.12)] pt-6 text-xs text-muted sm:flex-row">
          <div className="flex items-center gap-2">
            <BrandMark size="sm" />
            <span>OpenRx</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/dashboard" className="hover:text-primary">
              Dashboard
            </Link>
            <Link href="/providers" className="hover:text-primary">
              Providers
            </Link>
            <Link href="/privacy-explained" className="hover:text-primary">
              Privacy
            </Link>
            <Link href="/join-network" className="hover:text-primary">
              Join network
            </Link>
          </div>
        </footer>
      </main>
    </div>
  )
}
