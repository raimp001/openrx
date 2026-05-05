"use client"

import Link from "next/link"
import {
  CheckCircle2,
  HeartPulse,
  MapPin,
  Receipt,
  ShieldCheck,
  Stethoscope,
} from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import { CareAskPanel } from "@/components/care-ask-panel"
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal"

const serviceRoutes = [
  {
    label: "Screening",
    detail: "Guideline-based next steps for colon, breast, cervical, lung, prostate, and inherited-risk questions.",
    href: "/screening",
    icon: HeartPulse,
  },
  {
    label: "Find care",
    detail: "Primary care, specialists, imaging, labs, and caregiver options from one plain-language request.",
    href: "/providers",
    icon: MapPin,
  },
  {
    label: "Bills",
    detail: "Explain claims, coverage questions, prior-authorization status, and what to ask before care stalls.",
    href: "/billing",
    icon: Receipt,
  },
]

const trustNotes = [
  "Explore anonymously first",
  "No account before the first answer",
  "Clinicians still diagnose and order care",
]

export default function LandingPage() {
  const scrollRef = useScrollReveal()

  return (
    <div ref={scrollRef} className="relative min-h-screen overflow-hidden bg-surface">
      <div className="pointer-events-none absolute left-1/2 top-[-12rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(29,78,216,0.14),transparent_64%)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-16rem] left-1/2 h-[36rem] w-[58rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(8,126,139,0.10),transparent_66%)] blur-3xl" />

      <header className="sticky top-0 z-50 border-b border-[rgba(82,108,139,0.10)] bg-[rgba(247,250,255,0.74)] backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="OpenRx home">
            <BrandMark size="sm" />
            <BrandWordmark titleClassName="text-[15px] font-semibold text-primary" subtitle={false} />
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-medium text-secondary sm:flex">
            <Link href="/screening" className="rounded-full px-3 py-2 transition hover:bg-white hover:text-primary">
              Screening
            </Link>
            <Link href="/providers" className="rounded-full px-3 py-2 transition hover:bg-white hover:text-primary">
              Find care
            </Link>
            <Link href="/privacy-explained" className="rounded-full px-3 py-2 transition hover:bg-white hover:text-primary">
              Privacy
            </Link>
          </nav>
          <Link
            href="#ask-openrx"
            className="rounded-full border border-[rgba(82,108,139,0.12)] bg-white/72 px-4 py-2 text-sm font-semibold text-primary shadow-[0_12px_30px_rgba(8,24,46,0.07)] transition hover:bg-white"
          >
            Ask OpenRx
          </Link>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col px-5 pb-16 pt-10 sm:px-6 lg:pt-16">
        <section id="ask-openrx" className="mx-auto w-full max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(82,108,139,0.12)] bg-white/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            <Stethoscope size={13} className="text-accent" />
            Built for the handoff
          </div>
          <h1 className="mx-auto mt-7 max-w-5xl font-serif text-[clamp(3.4rem,8.8vw,8rem)] leading-[0.84] tracking-[-0.08em] text-primary">
            Ask OpenRx.
            <br />
            Get the next step.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-secondary sm:text-lg">
            Start with one sentence. OpenRx routes you to screening, care search, bills, medications, or follow-up without making you pick the portal first.
          </p>

          <div className="mt-8">
            <CareAskPanel
              eyebrow="Patient ask"
              title="What are you trying to finish?"
              description="Ask naturally. Clear screening and care-search requests open the right service with your question already attached."
              placeholder="Example: I am 55, my father had colon cancer, and I need to know what screening to book..."
              showLanes
              className="mx-auto border-[rgba(82,108,139,0.16)] bg-white/84 text-left shadow-[0_34px_110px_rgba(8,24,46,0.12)]"
            />
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {trustNotes.map((note) => (
              <span key={note} className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs font-semibold text-secondary">
                <CheckCircle2 size={13} className="text-accent" />
                {note}
              </span>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-12 grid w-full max-w-5xl gap-3 md:grid-cols-3">
          {serviceRoutes.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="surface-card reveal group p-5 transition hover:-translate-y-1 hover:border-accent/20 hover:shadow-[0_24px_70px_rgba(8,24,46,0.10)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(47,107,255,0.08)] text-accent transition group-hover:bg-primary group-hover:text-white">
                <item.icon size={17} strokeWidth={1.8} />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-primary">{item.label}</h2>
              <p className="mt-2 text-sm leading-6 text-secondary">{item.detail}</p>
            </Link>
          ))}
        </section>

        <section className="mx-auto mt-12 w-full max-w-5xl">
          <div className="surface-card reveal grid gap-6 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white">
                <ShieldCheck size={19} />
              </div>
              <h2 className="mt-5 max-w-xl text-[clamp(2rem,4vw,3.5rem)] leading-[0.95] tracking-[-0.055em] text-primary">
                A calmer front door for healthcare work.
              </h2>
            </div>
            <div className="space-y-4 text-sm leading-7 text-secondary">
              <p>
                Patients should not need to know whether a question belongs to prevention, scheduling, billing, referrals, or prior authorization.
              </p>
              <p>
                OpenRx starts like chat, then turns clear asks into executable handoffs: run the screening check, search care options, explain the bill, or prepare the follow-up.
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Informational guidance only. OpenRx does not replace clinicians or guarantee orders, coverage, or approvals.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-[rgba(82,108,139,0.12)] pt-6 text-xs text-muted sm:flex-row">
          <div className="flex items-center gap-2">
            <BrandMark size="sm" />
            <span>OpenRx</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/dashboard" className="hover:text-primary">
              Demo
            </Link>
            <Link href="/join-network" className="hover:text-primary">
              Join network
            </Link>
            <Link href="/privacy-explained" className="hover:text-primary">
              Privacy
            </Link>
          </div>
        </footer>
      </main>
    </div>
  )
}
