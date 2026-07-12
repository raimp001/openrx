import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Search,
} from "lucide-react"

import { AnswerActionGrid, type AnswerActionItem } from "@/components/answer-action-grid"
import { BrandMark } from "@/components/brand-logo"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "OpenRx | Guideline-grounded screening and care navigation",
  description:
    "OpenRx turns version-stamped clinical guidelines into patient screening plans, care navigation, consented referrals, and auditable prior-authorization preparation.",
  alternates: {
    canonical: "/",
  },
}

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "OpenRx",
  applicationCategory: "MedicalApplication",
  operatingSystem: "Web",
  url: "https://openrx.health",
  description:
    "OpenRx provides source-linked, version-stamped screening navigation and prior-authorization workflow infrastructure from deterministic guideline and audit engines.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free guideline-based screening preview",
  },
}

const connectedActions: AnswerActionItem[] = [
  {
    id: "screening",
    label: "Screening",
    href: "/screening",
    description: "Get a sourced plan",
    icon: "screening",
    tone: "primary",
  },
  {
    id: "find-care",
    label: "Find care",
    href: "/providers",
    description: "Doctors, labs, imaging",
    icon: "care",
  },
  {
    id: "trials",
    label: "Trials",
    href: "/clinical-trials",
    description: "Surface candidates",
    icon: "trials",
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    href: "/pharmacy",
    description: "Medication access",
    icon: "pharmacy",
  },
  {
    id: "prior-auth",
    label: "Prior auth",
    href: "/prior-auth",
    description: "Prepare the packet",
    icon: "shield",
  },
  {
    id: "join-network",
    label: "Join network",
    href: "/join-network",
    description: "Providers participate",
    icon: "network",
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#050505] text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="relative z-20 border-b border-white/[0.08] bg-[#050505]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="OpenRx home">
            <BrandMark size="sm" />
            <span className="text-sm font-semibold text-white">OpenRx</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-zinc-300 md:flex" aria-label="Main">
            <Link href="/screening" className="transition hover:text-white">
              Screening
            </Link>
            <Link href="/providers" className="transition hover:text-white">
              Find care
            </Link>
            <Link href="/demo" className="transition hover:text-white">
              API
            </Link>
          </nav>
          <Link
            href="/chat"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-cyan-200 px-4 text-sm font-semibold text-black transition hover:bg-cyan-100"
          >
            Ask OpenRx
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="relative isolate overflow-hidden px-4 sm:px-6">
          <Image
            src="/images/openrx-care-navigation-hero.png"
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-[56%_center] opacity-52"
          />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#050505_0%,rgba(5,5,5,0.94)_36%,rgba(5,5,5,0.70)_68%,#050505_100%)]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(5,5,5,0.12)_0%,#050505_94%)]" />

          <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl flex-col justify-center py-12">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-3 py-1 text-[12px] font-medium text-zinc-300 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
                Guideline-grounded cancer screening and prior-auth workflows
              </span>
              <h1 className="orx-display-heading mt-5 max-w-4xl text-[clamp(3rem,8vw,6rem)] text-white">
                OpenRx turns guidelines into care.
              </h1>
              <p className="mt-5 max-w-2xl text-[17px] leading-8 text-zinc-300 sm:text-xl">
                Ask one question. Get source-stamped recommendations and links to the next care action.
                Recommendations come from version-stamped rules, not model guesses.
              </p>

              <form
                action="/chat"
                method="get"
                className="mt-8 flex max-w-3xl items-center gap-2 rounded-[28px] border border-white/14 bg-[#0d0d0d]/92 p-2 shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl focus-within:border-cyan-200/40"
              >
                <input type="hidden" name="topic" value="screening" />
                <input type="hidden" name="autorun" value="1" />
                <label htmlFor="home-prompt" className="sr-only">
                  Ask OpenRx
                </label>
                <Search size={18} className="ml-2 hidden shrink-0 text-zinc-500 sm:block" />
                <input
                  id="home-prompt"
                  name="prompt"
                  placeholder="Ask what screening is due, what it means, or who to call next..."
                  className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] text-white outline-none placeholder:text-zinc-400 sm:px-2"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-200 text-black transition hover:bg-cyan-100"
                  aria-label="Submit question"
                >
                  <ArrowRight size={17} />
                </button>
              </form>
            </div>

            <nav aria-label="Connected care actions" className="mt-8 max-w-3xl">
              <AnswerActionGrid items={connectedActions} columns="two" label="Connected care actions" />
            </nav>

            <div className="mt-8 flex max-w-3xl flex-col gap-3 border-t border-white/10 pt-5 text-xs leading-6 text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
              <p>
                USPSTF 2021, Grade B example source. The example is educational, not personal medical advice.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening"
                  className="font-semibold text-zinc-300 transition hover:text-white"
                >
                  Source
                </a>
                <Link href="/trust" className="font-semibold text-zinc-300 transition hover:text-white">
                  Trust
                </Link>
                <Link href="/privacy-explained" className="font-semibold text-zinc-300 transition hover:text-white">
                  Privacy
                </Link>
              </div>
            </div>

            <p className="mt-4 max-w-3xl text-xs leading-6 text-zinc-400">
              OpenRx does not claim HIPAA compliance or SOC 2 certification today. Public screening is stateless by
              default; PHI persistence and model access remain gated deployment decisions.
            </p>
          </div>
        </section>

        {/* A real, server-rendered specimen of the product's output. Crawlers,
            link previews, and skeptical first-time visitors all see what an
            answer actually looks like before they type anything. */}
        <section aria-labelledby="example-answer-heading" className="border-t border-white/[0.08] px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">
              What an answer looks like
            </p>
            <h2 id="example-answer-heading" className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Every recommendation names its guideline, grade, and version.
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-zinc-400">
              Example output for a sample profile — a 52-year-old woman whose mother had breast cancer at 49.
              Educational, not personal medical advice.
            </p>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <article className="rounded-[20px] border border-amber-400/20 bg-amber-950/20 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                  Needs clinician review
                </p>
                <p className="mt-3 text-[15px] leading-7 text-zinc-100">
                  Genetic counseling and BRCA-related risk assessment: a first-degree relative with breast cancer
                  before 50 may mean hereditary-risk review comes before a routine screening plan.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium">
                  <span className="rounded-full border border-cyan-200/25 bg-cyan-200/[0.08] px-2.5 py-1 text-cyan-100">
                    USPSTF: BRCA-related cancer risk assessment (2019-08-20)
                  </span>
                  <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-zinc-300">Grade B</span>
                  <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-zinc-400">Rule: brca-family-history-risk-assessment</span>
                </div>
              </article>

              <article className="rounded-[20px] border border-white/[0.08] bg-black/25 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                  Depends on your history
                </p>
                <p className="mt-3 text-[15px] leading-7 text-zinc-100">
                  Breast cancer screening mammogram: age is in the mammography range, but the engine needs the prior
                  test date and result before calling it due — it will ask, not guess.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium">
                  <span className="rounded-full border border-cyan-200/25 bg-cyan-200/[0.08] px-2.5 py-1 text-cyan-100">
                    USPSTF: Breast cancer screening (2024-04-30)
                  </span>
                  <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-zinc-300">Grade B</span>
                  <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-zinc-400">Version 2024-04-30</span>
                </div>
              </article>
            </div>

            <div className="mt-4 rounded-[20px] border border-white/[0.08] bg-black/25 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                One question that could change this plan
              </p>
              <p className="mt-3 text-[15px] leading-7 text-zinc-100">
                Have you ever been diagnosed with cancer? If yes, include the type, diagnosis age, treatment, and
                current follow-up plan.
              </p>
              <p className="mt-2 text-[13px] leading-6 text-zinc-400">
                Why this matters: personal cancer history can replace average-risk screening with surveillance,
                earlier testing, or genetic-counseling review.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                href={{ pathname: "/chat", query: { topic: "screening", autorun: "1", prompt: "What cancer screening is due for me?" } }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cyan-200 px-5 text-sm font-semibold text-black transition hover:bg-cyan-100"
              >
                Ask about your own screening
                <ArrowRight size={14} />
              </Link>
              <p className="text-xs leading-6 text-zinc-400">
                Free. No account. Nothing stored unless you opt in.
              </p>
            </div>
          </div>
        </section>

        {/* How the answer is derived — the boundary between rules, model, and
            human review, stated as product architecture rather than marketing. */}
        <section aria-labelledby="method-heading" className="border-t border-white/[0.08] px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">How OpenRx decides</p>
            <h2 id="method-heading" className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Rules decide. Models explain. Clinicians approve.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <article className="rounded-[20px] border border-white/[0.08] bg-black/25 p-5">
                <p className="text-sm font-semibold text-white">1. A deterministic rules engine decides</p>
                <p className="mt-2 text-[14px] leading-7 text-zinc-400">
                  Screening status comes from version-stamped guideline rules — each answer carries the source
                  organization, publication date, evidence grade, and the exact rule id that produced it.
                </p>
              </article>
              <article className="rounded-[20px] border border-white/[0.08] bg-black/25 p-5">
                <p className="text-sm font-semibold text-white">2. Language models only parse and explain</p>
                <p className="mt-2 text-[14px] leading-7 text-zinc-400">
                  Models help read your question and phrase the answer in plain language. They do not invent
                  screening intervals, eligibility, or clinical certainty.
                </p>
              </article>
              <article className="rounded-[20px] border border-white/[0.08] bg-black/25 p-5">
                <p className="text-sm font-semibold text-white">3. High-stakes actions wait for a human</p>
                <p className="mt-2 text-[14px] leading-7 text-zinc-400">
                  Referrals, prior-auth submissions, and anything uncertain route to clinician review before any
                  external action. Uncertainty is stated, never smoothed over.
                </p>
              </article>
            </div>
            <p className="mt-5 text-xs leading-6 text-zinc-400">
              Every release is scored against a public 50-scenario accuracy benchmark —{" "}
              <Link href="/benchmark" className="font-semibold text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-white">
                see the published results
              </Link>
              . Full operating boundaries are on the{" "}
              <Link href="/trust" className="font-semibold text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-white">
                trust and evidence page
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Audience lanes: one product, three doors. */}
        <section aria-labelledby="audience-heading" className="border-t border-white/[0.08] px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <h2 id="audience-heading" className="max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Built for the person asking — and the clinician answering.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <article className="flex flex-col rounded-[20px] border border-white/[0.08] bg-black/25 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/80">Patients</p>
                <p className="mt-3 text-[15px] leading-7 text-zinc-200">
                  Find out which preventive screening may be due, why, and who to call — with the guideline behind
                  every answer and clear questions when your history is incomplete.
                </p>
                <Link href="/chat" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-100 transition hover:text-white">
                  Ask a screening question <ArrowRight size={13} />
                </Link>
              </article>
              <article className="flex flex-col rounded-[20px] border border-white/[0.08] bg-black/25 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/80">Clinicians</p>
                <p className="mt-3 text-[15px] leading-7 text-zinc-200">
                  Source-stamped screening summaries you can verify in one tap, and prior-authorization appeal
                  preparation grounded in the payer&apos;s own criteria — drafts, never submissions.
                </p>
                <Link href="/demo" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-100 transition hover:text-white">
                  Open the sandbox <ArrowRight size={13} />
                </Link>
              </article>
              <article className="flex flex-col rounded-[20px] border border-white/[0.08] bg-black/25 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/80">Health systems &amp; developers</p>
                <p className="mt-3 text-[15px] leading-7 text-zinc-200">
                  Deterministic guideline rules, PHI-minimized logging, consent snapshots, and audit rows — designed
                  as a navigation layer over FHIR, provider directories, and prior-auth workflows.
                </p>
                <Link href="/trust" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-100 transition hover:text-white">
                  Review the governance model <ArrowRight size={13} />
                </Link>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
