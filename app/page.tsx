import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, ExternalLink } from "lucide-react"

import { BrandMark } from "@/components/brand-logo"
import { ClinicalCommand } from "@/components/home/clinical-command"
import { nextStepLabel, recommendScreenings, screeningIntakeFromLegacy } from "@/lib/screening/recommend"
import { getGuidelineSource } from "@/lib/screening/sources"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "OpenRx | Clinical evidence into auditable care actions",
  description:
    "Ask a clinical or coverage question. OpenRx shows the source, the rule, what could change the answer, and the next care workflow for human review.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "OpenRx | Evidence to action for clinical workflows",
    description:
      "Source-linked clinical answers, inspectable guideline logic, and the next care action in one workflow.",
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
  { label: "Validation", href: "/benchmark" },
  { label: "Trust", href: "/trust" },
]

const audiencePaths = [
  {
    label: "For patients",
    text: "Understand what may be due and what to ask next.",
    href: "/chat",
  },
  {
    label: "For clinicians",
    text: "Inspect evidence and prepare a reviewable action.",
    href: "/demo",
  },
  {
    label: "For health systems",
    text: "Add an auditable workflow layer over existing systems.",
    href: "/trust",
  },
]

function buildWorkflowExample() {
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

  return {
    result,
    recommendation,
    source: getGuidelineSource(recommendation?.sourceId),
    facts: [
      ["Age", "58"],
      ["Screening context", "male"],
      ["Family history", "father diagnosed at 52"],
      ["Known variant", "BRCA2 pathogenic variant"],
    ],
  }
}

export default function HomePage() {
  const example = buildWorkflowExample()
  const recommendation = example.recommendation
  const missingInfo = example.result.clarificationQuestions.slice(0, 2)
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

      <header className="relative z-20 border-b border-white/[0.08] bg-[#050505]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="OpenRx home">
            <BrandMark size="sm" tone="dark" />
            <span className="text-sm font-semibold text-white">OpenRx</span>
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] font-medium text-zinc-400 md:flex" aria-label="Main">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/chat"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[9px] bg-white px-3.5 text-[13px] font-semibold text-black transition hover:bg-zinc-200"
          >
            Try OpenRx
            <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="px-4 pb-14 pt-16 sm:px-6 sm:pb-16 sm:pt-20">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
            <p className="text-[12px] font-semibold text-cyan-200">Evidence to action</p>
            <h1 className="orx-display-heading mt-5 max-w-4xl text-[clamp(2.7rem,7vw,5.4rem)] text-white">
              Ask. Verify. Act.
            </h1>
            <p className="mt-5 max-w-2xl text-[16px] leading-7 text-zinc-300 sm:text-[18px] sm:leading-8">
              OpenRx turns source-linked clinical evidence into an inspectable answer and the next care step.
            </p>

            <div className="mt-8 w-full max-w-3xl text-left">
              <ClinicalCommand />
            </div>

            <div className="mt-9 grid w-full max-w-3xl gap-px overflow-hidden border-y border-white/10 bg-white/10 text-left sm:grid-cols-3">
              <Link href="/benchmark" className="bg-[#050505] px-4 py-3 transition hover:bg-white/[0.035]">
                <span className="block text-[12px] font-semibold text-white">50-scenario benchmark</span>
                <span className="mt-1 block text-[11px] text-zinc-500">Published regression results</span>
              </Link>
              <div className="bg-[#050505] px-4 py-3">
                <span className="block text-[12px] font-semibold text-white">Source on every recommendation</span>
                <span className="mt-1 block text-[11px] text-zinc-500">Organization, grade, date, link</span>
              </div>
              <div className="bg-[#050505] px-4 py-3">
                <span className="block text-[12px] font-semibold text-white">Human review before action</span>
                <span className="mt-1 block text-[11px] text-zinc-500">No silent clinical submission</span>
              </div>
            </div>
          </div>
        </section>

        <section id="product" aria-labelledby="workflow-heading" className="border-t border-white/10 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-3xl">
              <p className="text-[12px] font-semibold text-cyan-200">One question. A complete next step.</p>
              <h2 id="workflow-heading" className="orx-section-heading mt-3 text-3xl text-white sm:text-4xl">
                The answer stays simple. The evidence stays inspectable.
              </h2>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-zinc-400">
                Models structure language and explain results. Version-stamped rules determine recommendations.
              </p>
            </div>

            <div className="mt-10 grid border-y border-white/10 lg:grid-cols-[0.82fr_1.18fr]">
              <div className="border-b border-white/10 py-7 lg:border-b-0 lg:border-r lg:pr-8">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold text-zinc-400">Synthetic input</p>
                  <span className="text-[11px] text-zinc-500">No PHI</span>
                </div>
                <p className="mt-4 text-[16px] leading-7 text-zinc-100">{workflowPrompt}</p>
                <dl className="mt-6 border-t border-white/10">
                  {example.facts.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[8.5rem_1fr] gap-4 border-b border-white/[0.08] py-3 text-[13px]">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd className="font-medium text-zinc-200">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="py-7 lg:pl-8">
                {recommendation ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1.5 text-cyan-100">
                        <Check size={13} aria-hidden />
                        {recommendation.status.replaceAll("_", " ")}
                      </span>
                      <span className="text-zinc-600">/</span>
                      <span className="text-zinc-400">{example.result.engineVersion}</span>
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-white">{recommendation.screeningName}</h3>
                    <p className="mt-3 text-[15px] leading-7 text-zinc-300">
                      {recommendation.patientFriendlyExplanation}
                    </p>

                    <div className="mt-6 border-l-2 border-cyan-200/60 pl-4">
                      <p className="text-[11px] font-semibold text-zinc-400">Evidence</p>
                      <p className="mt-1 text-sm text-zinc-200">
                        {example.source
                          ? `${example.source.organization}: ${example.source.topic}`
                          : recommendation.sourceSystem}
                      </p>
                      <p className="mt-1 text-[12px] text-zinc-500">
                        {recommendation.evidenceGrade ? `Grade ${recommendation.evidenceGrade}` : "Grade not supplied"}
                        {" / "}
                        {recommendation.sourceVersion || example.source?.versionOrDate}
                        {" / "}
                        Rule {recommendation.id}
                      </p>
                      {example.source?.url ? (
                        <Link
                          href={example.source.url}
                          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-cyan-100 transition hover:text-white"
                        >
                          Review source
                          <ExternalLink size={12} aria-hidden />
                        </Link>
                      ) : null}
                    </div>

                    <div className="mt-7 grid gap-6 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold text-amber-100">What could change this</p>
                        <ul className="mt-3 space-y-2">
                          {(missingInfo.length ? missingInfo : [{
                            id: "confirm-prior-psa",
                            question: "Confirm prior PSA results, prostate symptoms, and the exact variant report.",
                          }]).map((item) => (
                            <li key={item.id} className="text-[13px] leading-6 text-zinc-400">
                              {item.question}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-zinc-300">Next actions</p>
                        <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
                          {actionLabels.map((label) => (
                            <Link
                              key={label}
                              href={{ pathname: "/chat", query: { topic: "screening", prompt: workflowPrompt } }}
                              className="flex items-center justify-between gap-3 py-2.5 text-[13px] font-medium text-zinc-200 transition hover:text-cyan-100"
                            >
                              {label}
                              <ArrowRight size={13} aria-hidden />
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-zinc-400">No applicable rule found. Route to clinician review.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="difference-heading" className="border-t border-white/10 px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <h2 id="difference-heading" className="orx-section-heading max-w-3xl text-3xl text-white">
              Rules decide. Models explain. Clinicians approve.
            </h2>
            <div className="mt-8 grid gap-px border-y border-white/10 bg-white/10 md:grid-cols-3">
              <div className="bg-[#050505] px-5 py-6">
                <p className="text-sm font-semibold text-white">Evidence you can inspect</p>
                <p className="mt-2 text-[13px] leading-6 text-zinc-400">Source, version, grade, date, and direct link.</p>
              </div>
              <div className="bg-[#050505] px-5 py-6">
                <p className="text-sm font-semibold text-white">Logic you can audit</p>
                <p className="mt-2 text-[13px] leading-6 text-zinc-400">Facts used, rule triggered, missing inputs, uncertainty.</p>
              </div>
              <div className="bg-[#050505] px-5 py-6">
                <p className="text-sm font-semibold text-white">Actions you can complete</p>
                <p className="mt-2 text-[13px] leading-6 text-zinc-400">Care search, referral, prior authorization, or appeal preparation.</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="audience-heading" className="border-t border-white/10 px-4 py-14 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <h2 id="audience-heading" className="sr-only">OpenRx audiences</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {audiencePaths.map((item) => (
                <Link key={item.label} href={item.href} className="group">
                  <span className="flex items-center gap-2 text-sm font-semibold text-white">
                    {item.label}
                    <ArrowRight size={13} className="transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                  <span className="mt-2 block text-[13px] leading-6 text-zinc-500">{item.text}</span>
                </Link>
              ))}
            </div>
            <p className="mt-10 max-w-3xl text-[12px] leading-6 text-zinc-500">
              Educational, not medical advice or a diagnosis. OpenRx does not place clinical orders or replace clinician judgment.
              OpenRx does not claim HIPAA compliance or SOC 2 certification for public workflows.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
