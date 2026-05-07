"use client"

import Link from "next/link"
import { ShieldCheck, FileText, Sparkles } from "lucide-react"
import { BrandMark } from "@/components/brand-logo"
import { CareAskPanel } from "@/components/care-ask-panel"

const trustNotes: Array<{ icon: typeof Sparkles; label: string }> = [
  { icon: Sparkles, label: "Answer-first chat — no extra forms" },
  { icon: FileText, label: "Sources from USPSTF, CDC, ACS, NCCN" },
  { icon: ShieldCheck, label: "Decision support, not a diagnosis" },
]

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-surface">
      <header className="border-b border-border/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="OpenRx home">
            <BrandMark size="sm" />
            <span className="text-[15px] font-semibold tracking-tight text-primary">OpenRx</span>
          </Link>
          <nav className="flex items-center gap-1 text-[13px] font-medium text-muted">
            <Link
              href="/privacy-explained"
              className="rounded-md px-3 py-1.5 transition hover:bg-surface-2 hover:text-primary"
            >
              Privacy
            </Link>
            <Link
              href="/dashboard"
              className="hidden rounded-md px-3 py-1.5 transition hover:bg-surface-2 hover:text-primary sm:inline-flex"
            >
              Dashboard
            </Link>
            <Link
              href="/chat"
              className="ml-1 inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-1.5 text-white transition hover:bg-navy-hover"
            >
              Open chat
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col px-5 pb-12 pt-12 sm:px-6 sm:pt-16 lg:justify-center lg:pt-0">
        <section
          id="ask-openrx"
          aria-labelledby="landing-heading"
          className="mx-auto w-full text-center"
        >
          <span className="eyebrow-pill mx-auto">
            <Sparkles size={11} className="text-teal" />
            Clinical answers, in chat
          </span>
          <h1
            id="landing-heading"
            className="mx-auto mt-5 max-w-2xl text-balance text-display-lg font-semibold text-primary"
          >
            Ask a clinical question. Get the answer in chat — with sources.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-muted">
            OpenRx answers screening, medication, and preventive-care questions directly in the
            conversation. Guideline links inline. No extra forms unless they&apos;re truly needed.
          </p>

          <div className="mt-7">
            <CareAskPanel
              eyebrow=""
              title=""
              description=""
              placeholder="Ask about screening, medications, a bill, or what to do next…"
              minimal
              className="mx-auto"
            />
          </div>

          <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-x-5 gap-y-2 text-[12px] text-muted">
            {trustNotes.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <Icon size={12} className="text-teal" />
                {label}
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-auto flex flex-col items-center justify-between gap-4 pt-16 text-[12px] text-secondary sm:flex-row">
          <div className="flex items-center gap-2">
            <BrandMark size="sm" tone="light" />
            <span className="font-medium text-primary">OpenRx</span>
            <span aria-hidden className="text-muted">·</span>
            <span className="text-muted">{new Date().getFullYear()}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-muted">
            <Link href="/dashboard" className="hover:text-primary">Demo dashboard</Link>
            <Link href="/join-network" className="hover:text-primary">For clinicians</Link>
            <Link href="/privacy-explained" className="hover:text-primary">Privacy</Link>
          </div>
        </footer>
      </main>
    </div>
  )
}
