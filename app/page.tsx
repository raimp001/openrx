"use client"

import Link from "next/link"
import {
  CheckCircle2,
  Stethoscope,
} from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import { CareAskPanel } from "@/components/care-ask-panel"
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal"

const trustNotes = [
  "No account first",
  "Clinical answers in chat",
  "Sources included inline",
]

export default function LandingPage() {
  const scrollRef = useScrollReveal()

  return (
    <div ref={scrollRef} className="relative min-h-screen overflow-hidden bg-surface">
      <div className="pointer-events-none absolute left-1/2 top-[-18rem] h-[48rem] w-[48rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(29,78,216,0.11),transparent_68%)] blur-3xl" />

      <header className="relative z-50">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="OpenRx home">
            <BrandMark size="sm" />
            <BrandWordmark titleClassName="text-[15px] font-semibold text-primary" subtitle={false} />
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium text-secondary">
            <Link href="/privacy-explained" className="rounded-full px-3 py-2 transition hover:bg-white hover:text-primary">
              Privacy
            </Link>
            <Link href="/dashboard" className="hidden rounded-full px-3 py-2 transition hover:bg-white hover:text-primary sm:inline-flex">
              Demo
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col px-5 pb-10 pt-8 sm:px-6 lg:justify-center lg:pt-0">
        <section id="ask-openrx" className="mx-auto w-full max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(82,108,139,0.12)] bg-white/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            <Stethoscope size={13} className="text-accent" />
            Ask. Answer. Act.
          </div>
          <h1 className="mx-auto mt-7 max-w-4xl font-serif text-[clamp(3.8rem,10vw,8.8rem)] leading-[0.82] tracking-[-0.085em] text-primary">
            Ask OpenRx.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-secondary">
            Clinical questions answered directly. Care actions when you ask for them.
          </p>

          <div className="mt-7">
            <CareAskPanel
              eyebrow=""
              title=""
              description=""
              placeholder="Ask about screening, finding care, a bill, or what to do next..."
              minimal
              className="mx-auto border-[rgba(82,108,139,0.14)] bg-white/88 text-left shadow-[0_24px_80px_rgba(8,24,46,0.10)]"
            />
          </div>

          <div className="mx-auto mt-4 flex max-w-xl flex-wrap justify-center gap-2">
            {trustNotes.map((note) => (
              <span key={note} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-muted">
                <CheckCircle2 size={12} className="text-accent" />
                {note}
              </span>
            ))}
          </div>
        </section>

        <footer className="mt-auto flex flex-col items-center justify-between gap-4 pt-12 text-xs text-muted sm:flex-row">
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
