import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Search } from "lucide-react"

import { BrandMark } from "@/components/brand-logo"
import { nextStepLabel, recommendScreenings, screeningIntakeFromLegacy } from "@/lib/screening/recommend"
import { getGuidelineSource } from "@/lib/screening/sources"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "OpenRx | Clinical evidence into auditable care actions",
  description:
    "OpenRx turns source-linked clinical evidence into inspectable recommendations, missing-data questions, and next care workflows for human review.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "OpenRx | Evidence to action for clinical workflows",
    description:
      "Ask a clinical or coverage question. OpenRx shows the evidence, the rule, what could change it, and the next workflow to review.",
    url: "https://openrx.health",
    siteName: "OpenRx",
    type: "website",
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
    "OpenRx turns version-stamped guideline logic and evidence metadata into auditable care-navigation and prior-authorization workflows.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free guideline-based screening preview",
  },
}

const workflowPrompt =
  "58-year-old man, father diagnosed with prostate cancer at 52, known BRCA2 carrier. What screening and referral steps should be considered?"

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Clinicians", href: "#clinicians" },
  { label: "Patients", href: "#patients" },
  { label: "Health systems", href: "#health-systems" },
  { label: "Trust", href: "/trust" },
]

const pillars = [
  {
    title: "Evidence you can inspect",
    text: "Source organization, version, publication date, grade, and direct links stay attached to the recommendation.",
  },
  {
    title: "Logic you can audit",
    text: "OpenRx shows which structured facts triggered which rule, which inputs were missing, and where uncertainty remains.",
  },
  {
    title: "Actions you can complete",
    text: "Prepare the screening plan, referral draft, prior-authorization packet, appeal, or care-navigation handoff for review.",
  },
]

const audiencePaths = [
  {
    id: "clinicians",
    label: "Clinicians",
    text: "Start with a sourced answer, inspect the rule and missing data, then review a concise action checklist or appeal draft.",
    href: "/demo",
    cta: "Open the clinician sandbox",
  },
  {
    id: "patients",
    label: "Patients",
    text: "Ask what screening may be due, see what information could change the answer, and leave with a message or care-search next step.",
    href: "/chat",
    cta: "Ask OpenRx",
  },
  {
    id: "health-systems",
    label: "Health systems",
    text: "Use deterministic rules, PHI-minimized logs, consent snapshots, and audit events as a workflow layer over FHIR and prior authorization.",
    href: "/trust",
    cta: "Review governance",
  },
]

function buildHeroExample() {
  const result = recommendScreenings(screeningIntakeFromLegacy({
    age: 58,
    gender: "male",
    familyHistory: ["father prostate cancer at 52"],
    conditions: ["BRCA2 pathogenic variant"],
    reportedHistory: {
      personalCancer: "no",
      familyCancer: "yes",
      symptoms: "no",
    },
  }))
  const recommendation =
    result.recommendations.find((item) => item.id === "hereditary-prostate-screening-review") ||
    result.recommendations[0]
  const source = getGuidelineSource(recommendation?.sourceId)

  return {
    result,
    recommendation,
    source,
    facts: [
      { label: "Age", value: "58", source: "synthetic demo text" },
      { label: "Screening context", value: "male", source: "synthetic demo text" },
      { label: "Family history", value: "father prostate cancer at 52", source: "synthetic demo text" },
      { label: "Known variant", value: "BRCA2 pathogenic variant", source: "synthetic demo text" },
    ],
  }
}

export default function HomePage() {
  const heroExample = buildHeroExample()
  const recommendation = heroExample.recommendation
  const source = heroExample.source
  const missingInfo = heroExample.result.clarificationQuestions.slice(0, 3)
  const actionLabels = recommendation?.nextSteps.slice(0, 3).map((step) => nextStepLabel(step)) || []

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
            <BrandMark size="sm" tone="dark" />
            <span className="text-sm font-semibold text-white">OpenRx</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-zinc-300 lg:flex" aria-label="Main">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href={{ pathname: "/chat", query: { topic: "screening", autorun: "1", prompt: "What clinical workflow should OpenRx help me start?" } }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-cyan-200 px-4 text-sm font-semibold text-black transition hover:bg-cyan-100"
          >
            Try OpenRx
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(27rem,1.1fr)] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                Evidence to action
              </p>
              <h1 className="orx-display-heading mt-5 max-w-4xl text-[clamp(2.75rem,7vw,5.75rem)] text-white">
                Clinical evidence is only useful when it becomes action.
              </h1>
              <p className="mt-5 max-w-2xl text-[16px] leading-8 text-zinc-300 sm:text-[18px]">
                OpenRx gives clinicians and patients source-linked answers, shows what information could change them,
                and prepares the next screening, referral, prior-authorization, or appeal workflow for human review.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={{ pathname: "/chat", query: { topic: "screening", autorun: "1", prompt: workflowPrompt } }}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-200 px-5 text-sm font-semibold text-black transition hover:bg-cyan-100"
                >
                  Try a clinical workflow
                  <ArrowRight size={15} />
                </Link>
                <Link
                  href="#product"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/12 px-5 text-sm font-semibold text-zinc-100 transition hover:border-cyan-200/32 hover:bg-white/[0.06]"
                >
                  See how OpenRx works
                </Link>
              </div>

              <form
                action="/chat"
                method="get"
                className="mt-7 flex max-w-2xl items-center gap-2 rounded-[28px] border border-white/14 bg-[#0d0d0d]/92 p-2 shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl focus-within:border-cyan-200/40"
              >
                <input type="hidden" name="topic" value="screening" />
                <input type="hidden" name="autorun" value="1" />
                <label htmlFor="home-prompt" className="sr-only">
                  Ask OpenRx
                </label>
                <Search size={18} className="ml-2 hidden shrink-0 text-zinc-400 sm:block" />
                <input
                  id="home-prompt"
                  name="prompt"
                  placeholder="Ask what evidence says and what to do next..."
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

              <p className="mt-4 max-w-2xl text-xs leading-6 text-zinc-400">
                Public workflows use synthetic or user-entered context. OpenRx does not claim HIPAA compliance or SOC 2
                certification today; PHI persistence and model access remain gated deployment decisions.
              </p>
            </div>

            <aside
              aria-label="Synthetic evidence to action example"
              className="rounded-[28px] border border-white/12 bg-[#0d0f0f]/95 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.45)] sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                    Synthetic scenario
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">
                    Rendered from the existing screening rules engine. Educational, not medical advice.
                  </p>
                </div>
                <span className="rounded-full border border-amber-200/25 bg-amber-200/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100">
                  Clinician review
                </span>
              </div>

              <div className="mt-4 rounded-[20px] border border-white/10 bg-black/28 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Question</p>
                <p className="mt-2 text-sm leading-6 text-zinc-100">{workflowPrompt}</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {heroExample.facts.map((fact) => (
                  <div key={fact.label} className="rounded-[16px] border border-white/10 bg-white/[0.035] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-zinc-500">{fact.label}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{fact.value}</p>
                    <p className="mt-1 text-[11px] text-zinc-400">{fact.source}</p>
                  </div>
                ))}
              </div>

              {recommendation ? (
                <div className="mt-4 rounded-[20px] border border-cyan-200/16 bg-cyan-200/[0.055] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-cyan-200/24 bg-cyan-200/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-100">
                      {recommendation.status.replaceAll("_", " ")}
                    </span>
                    <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-300">
                      {heroExample.result.engineVersion}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
                    {recommendation.screeningName}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-200">
                    {recommendation.patientFriendlyExplanation}
                  </p>
                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-[14px] border border-white/10 bg-black/24 p-3">
                      <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500">Evidence</p>
                      <p className="mt-1 leading-5 text-zinc-200">
                        {source ? `${source.organization}: ${source.topic}` : recommendation.sourceSystem}
                      </p>
                      <p className="mt-1 text-zinc-400">
                        {recommendation.evidenceGrade ? `Grade ${recommendation.evidenceGrade}` : "Grade not supplied"}
                        {recommendation.sourceVersion ? ` - ${recommendation.sourceVersion}` : source ? ` - ${source.versionOrDate}` : ""}
                      </p>
                      {source?.url ? (
                        <Link
                          href={source.url}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-100 underline decoration-cyan-200/30 underline-offset-4 transition hover:text-white"
                        >
                          Review source <ArrowRight size={11} />
                        </Link>
                      ) : null}
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-black/24 p-3">
                      <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500">Rule</p>
                      <p className="mt-1 break-words font-mono text-[11px] leading-5 text-zinc-200">
                        {recommendation.id}
                      </p>
                      <p className="mt-1 text-zinc-400">{recommendation.requiresClinicianReview ? "Human review required" : "Rules-supported"}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-[18px] border border-amber-200/18 bg-amber-200/[0.045] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                    What could change this answer
                  </p>
                  <ul className="mt-3 space-y-2">
                    {(missingInfo.length ? missingInfo : [{
                      id: "confirm-prior-psa",
                      question: "Prior PSA results, prostate symptoms, and the exact variant report should be confirmed before action.",
                    }]).map((item) => (
                      <li key={item.id} className="text-sm leading-6 text-zinc-200">
                        {item.question}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    Next actions
                  </p>
                  <div className="mt-3 space-y-2">
                    {actionLabels.map((label) => (
                      <span key={label} className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-sm font-semibold text-zinc-100">
                        {label}
                        <ArrowRight size={13} className="shrink-0 text-cyan-100" />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section id="product" aria-labelledby="product-heading" className="border-t border-white/[0.08] px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">
              Why OpenRx is different
            </p>
            <h2 id="product-heading" className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              One workflow: question, evidence, decision, review, action.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {pillars.map((pillar) => (
                <article key={pillar.title} className="rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-5">
                  <h3 className="text-sm font-semibold text-white">{pillar.title}</h3>
                  <p className="mt-2 text-[14px] leading-7 text-zinc-400">{pillar.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="method-heading" className="border-t border-white/[0.08] px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">Operating contract</p>
            <h2 id="method-heading" className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Rules decide. Models explain. Clinicians approve.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <article className="rounded-[20px] border border-white/[0.08] bg-black/25 p-5">
                <p className="text-sm font-semibold text-white">1. Deterministic rules decide</p>
                <p className="mt-2 text-[14px] leading-7 text-zinc-400">
                  Screening status comes from version-stamped guideline rules. Each answer carries a source,
                  date, grade, and rule id when encoded.
                </p>
              </article>
              <article className="rounded-[20px] border border-white/[0.08] bg-black/25 p-5">
                <p className="text-sm font-semibold text-white">2. Models parse and explain</p>
                <p className="mt-2 text-[14px] leading-7 text-zinc-400">
                  Language models can structure user text and phrase an answer. They do not invent screening
                  intervals, eligibility, or clinical certainty.
                </p>
              </article>
              <article className="rounded-[20px] border border-white/[0.08] bg-black/25 p-5">
                <p className="text-sm font-semibold text-white">3. Human review gates action</p>
                <p className="mt-2 text-[14px] leading-7 text-zinc-400">
                  Referrals, prior-auth submissions, and uncertain decisions route to review before external action.
                  Uncertainty is stated, never smoothed over.
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

        <section aria-labelledby="audience-heading" className="border-t border-white/[0.08] px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <h2 id="audience-heading" className="max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Three doors into the same evidence-to-action workflow.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {audiencePaths.map((item) => (
                <article key={item.id} id={item.id} className="flex scroll-mt-24 flex-col rounded-[20px] border border-white/[0.08] bg-black/25 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/80">{item.label}</p>
                  <p className="mt-3 text-[15px] leading-7 text-zinc-200">{item.text}</p>
                  <Link href={item.href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-100 transition hover:text-white">
                    {item.cta} <ArrowRight size={13} />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
