import type { Metadata } from "next"
import Link from "next/link"

import benchmark from "@/lib/benchmark/published.json"
import { BrandMark } from "@/components/brand-logo"
import { providerSearchHrefFromHandoff } from "@/lib/care-handoff"
import { careSearchQueryForRecommendation } from "@/lib/screening/care-search"
import { recommendScreenings, screeningIntakeFromLegacy } from "@/lib/screening/recommend"
import { getGuidelineSource, guidelineSources } from "@/lib/screening/sources"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "OpenRx | Health answers, built for verification",
  description:
    "Ask a clinical or coverage question. OpenRx shows the source, the rule, what could change the answer, and the next care workflow for human review.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "OpenRx | Health answers, built for verification",
    description:
      "One question returns the answer, the guideline behind it, and the next care step — source-linked and auditable.",
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

const ink = "#211c16"
const paper = "#f7f4ee"
const ember = "#ba421c"

const exampleQuestions = [
  "What cancer screening does a 50-year-old woman need?",
  "45, male, never screened for colorectal cancer — what's due?",
  "Does Medicare cover an annual wellness visit?",
  "My father had colon cancer at 48. When should I start screening?",
]

const demoPrompt =
  "“45, male, no symptoms, no family cancer history, never screened for colorectal cancer. What's due?”"

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Validation", href: "/benchmark" },
  { label: "Trust", href: "/trust" },
]

const screeningExamplePrompt =
  "45 male, no symptoms, no personal or family cancer history, never screened for colorectal cancer."

const encodedGuidelineOrganizations = Array.from(
  new Set(
    Object.values(guidelineSources)
      .map((source) => source.organization)
      .filter((organization) => organization !== "PENDING")
  )
)

type PublishedColor = "green" | "yellow" | "red"
type PublishedResult = {
  citation: PublishedColor
  version: PublishedColor
  correctness: PublishedColor
  sycophancy: PublishedColor
  fabrication: PublishedColor
  overall: PublishedColor
}

const publishedResults = benchmark.results as PublishedResult[]
const benchmarkDimensions: Array<{ label: string; key: keyof Pick<PublishedResult, "citation" | "version" | "correctness" | "sycophancy" | "fabrication"> }> = [
  { label: "Citation specificity", key: "citation" },
  { label: "Version pinning", key: "version" },
  { label: "Correctness", key: "correctness" },
  { label: "Sycophancy resistance", key: "sycophancy" },
  { label: "Refusal vs fabrication", key: "fabrication" },
]

function publishedCount(
  key: keyof PublishedResult,
  color: PublishedColor
) {
  return publishedResults.filter((result) => result[key] === color).length
}

function buildDemoExample() {
  const result = recommendScreenings(
    screeningIntakeFromLegacy({
      age: 45,
      gender: "male",
      reportedHistory: {
        personalCancer: "no",
        familyCancer: "no",
        symptoms: "no",
        colorectalScreening: "no",
      },
    })
  )
  const recommendation =
    result.recommendations.find((item) => item.id === "uspstf-average-risk-colorectal") ||
    result.recommendations[0]

  const careQuery = recommendation
    ? careSearchQueryForRecommendation(recommendation)
    : "colorectal cancer screening"
  const changeSentence = recommendation?.patientFriendlyExplanation
    .split(". ")
    .map((part) => part.trim())
    .find((part) => /would change|could change/i.test(part))
    ?.replace(/\.$/, "")

  return {
    result,
    recommendation,
    source: getGuidelineSource(recommendation?.sourceId),
    careHref: providerSearchHrefFromHandoff(careQuery, "screening"),
    screeningHref: `/screening?${new URLSearchParams({
      handoff: "link",
      autorun: "1",
      prompt: screeningExamplePrompt,
    }).toString()}`,
    changeNote: changeSentence || "Symptoms, family history, or a prior abnormal result would change the pathway",
    facts: [
      ["age", "45"],
      ["screening_context", "male"],
      ["family_history", "none reported"],
      ["prior_screening", "none"],
    ] as const,
  }
}

function MonoLabel({ children, tone = "dark" }: { children: React.ReactNode; tone?: "dark" | "light" }) {
  return (
    <span
      className="font-landing-mono text-[11px] uppercase tracking-[0.08em]"
      style={{ color: tone === "dark" ? "rgba(33,28,22,.65)" : "rgba(247,244,238,.6)" }}
    >
      {children}
    </span>
  )
}

export default function HomePage() {
  const example = buildDemoExample()
  const recommendation = example.recommendation
  const sourceYear = example.source?.versionOrDate?.slice(0, 4)

  return (
    <div
      className="min-h-screen font-landing-sans"
      style={{ background: paper, color: ink }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Announce bar */}
      <Link
        href="/benchmark"
        className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-4 py-2 text-center font-landing-mono text-[12px]"
        style={{ background: ink, color: paper }}
      >
        <span style={{ color: "#e0704a" }} aria-hidden>
          ●
        </span>
        <span>Introducing the OpenRx Benchmark: published 50-scenario regression results</span>
        <span className="underline">Learn more</span>
      </Link>

      {/* Nav */}
      <header className="border-b" style={{ borderColor: "rgba(33,28,22,.14)" }}>
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-4 sm:px-10">
          <div className="flex items-center gap-9">
            <Link href="/" className="flex items-center gap-2.5" aria-label="OpenRx home">
              {/* Shared brand mark so landing (light) and app shell (dark) read as one product */}
              <BrandMark size="sm" tone="light" className="h-[26px] w-[26px] rounded-[6px]" />
              <span className="text-[17px] font-semibold tracking-[-0.01em]">OpenRx</span>
            </Link>
            <nav className="hidden items-center gap-6 text-[14px] md:flex" aria-label="Main" style={{ color: "rgba(33,28,22,.75)" }}>
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="transition hover:text-[#211c16]" style={{ color: "inherit" }}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2.5">
            <details className="relative md:hidden">
              <summary
                className="flex min-h-11 cursor-pointer list-none items-center rounded-md border px-3 text-[14px] font-medium [&::-webkit-details-marker]:hidden"
                style={{ borderColor: "rgba(33,28,22,.25)", color: ink }}
              >
                Menu
              </summary>
              <nav
                aria-label="Sections"
                className="absolute right-0 z-20 mt-2 flex w-52 flex-col rounded-md border bg-white p-2 shadow-lg"
                style={{ borderColor: "rgba(33,28,22,.14)" }}
              >
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-[14px]" style={{ color: ink }}>
                    {item.label}
                  </Link>
                ))}
                <Link href="/demo" className="rounded-md px-3 py-2 text-[14px]" style={{ color: ink }}>
                  For clinicians
                </Link>
              </nav>
            </details>
            <Link
              href="/demo"
              className="hidden rounded-md border px-4 py-2 text-[14px] font-medium sm:inline-block"
              style={{ borderColor: "rgba(33,28,22,.25)", color: ink }}
            >
              For clinicians
            </Link>
            <Link
              href="/chat"
              className="rounded-md px-4 py-2 text-[14px] font-medium"
              style={{ background: ink, color: paper }}
            >
              Try OpenRx
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* Hero */}
        <section
          className="px-4 pb-14 pt-16 sm:px-10 sm:pt-[88px]"
          style={{ background: paper }}
        >
          <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center gap-6 text-center">
            <h1
              className="max-w-[18ch] text-[clamp(2.5rem,6vw,4rem)] font-medium leading-[1.06] tracking-[-0.035em]"
              style={{ textWrap: "balance", color: ink }}
            >
              Health answers,
              <br />
              built for <span style={{ color: ember }}>verification</span>
            </h1>
            <p className="max-w-[46ch] text-[17px] leading-relaxed sm:text-[19px]" style={{ color: "rgba(33,28,22,.7)" }}>
              One question returns the answer, the guideline behind it, and the next care step
            </p>

            {/* Ask input — the product is the hero */}
            <form action="/chat" method="get" className="w-full max-w-[680px]">
              <input type="hidden" name="autorun" value="1" />
              <div
                className="flex items-center gap-2 rounded-[12px] border bg-white p-2"
                style={{ borderColor: "rgba(33,28,22,.2)" }}
              >
                <label htmlFor="hero-ask" className="sr-only">
                  Ask a clinical or coverage question
                </label>
                <input
                  id="hero-ask"
                  name="prompt"
                  type="text"
                  required
                  minLength={3}
                  placeholder="Ask a clinical or coverage question…"
                  className="min-h-[44px] min-w-0 flex-1 bg-transparent px-3 text-[16px] outline-none"
                  style={{ color: ink }}
                />
                <button
                  type="submit"
                  className="min-h-[44px] shrink-0 rounded-[9px] px-5 text-[15px] font-medium text-white"
                  style={{ background: ember }}
                >
                  Ask
                </button>
              </div>
            </form>
            <div className="flex max-w-[720px] flex-wrap items-center justify-center gap-2">
              {exampleQuestions.map((question) => (
                <Link
                  key={question}
                  href={{ pathname: "/chat", query: { prompt: question, autorun: "1" } }}
                  className="rounded-full border bg-white px-3.5 py-2 text-left text-[13px] leading-snug"
                  style={{ borderColor: "rgba(33,28,22,.16)", color: "rgba(33,28,22,.72)" }}
                >
                  {question}
                </Link>
              ))}
            </div>
            <p className="max-w-[52ch] text-[13.5px] leading-relaxed" style={{ color: "rgba(33,28,22,.68)" }}>
              Average-risk screening answers come from version-stamped USPSTF rules. Every recommendation names its
              source, grade, and publication date. High-risk intervals that are not encoded route to clinician review.
            </p>
            <Link
              href="/screening"
              className="rounded-lg px-6 py-3 text-[15px] font-medium text-white"
              style={{ background: ember, boxShadow: "0 1px 0 rgba(33,28,22,.15)" }}
            >
              Check my screening — free
            </Link>

            {/* Demo panel */}
            <div
              className="mt-8 w-full max-w-[920px] overflow-hidden rounded-[14px] border bg-white text-left"
              style={{ borderColor: "rgba(33,28,22,.14)", boxShadow: "0 12px 32px -24px rgba(33,28,22,.22)" }}
            >
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-[18px]"
                style={{ borderColor: "rgba(33,28,22,.1)" }}
              >
                <div className="flex gap-1.5 font-landing-mono text-[12.5px]">
                  <span className="rounded-md px-3 py-1.5 font-medium" style={{ background: ink, color: paper }}>
                    Screening
                  </span>
                  <Link href={{ pathname: "/chat", query: { topic: "coverage" } }} className="rounded-md px-3 py-1.5" style={{ color: "rgba(33,28,22,.7)" }}>
                    Coverage
                  </Link>
                  <Link href="/providers" className="rounded-md px-3 py-1.5" style={{ color: "rgba(33,28,22,.7)" }}>
                    Find care
                  </Link>
                </div>
                <div className="hidden items-center gap-2 font-landing-mono text-[11.5px] sm:flex" style={{ color: "rgba(33,28,22,.65)" }}>
                  <span>input</span>
                  <span className="flex overflow-hidden rounded-md border" style={{ borderColor: "rgba(33,28,22,.15)" }}>
                    <span className="px-2.5 py-1" style={{ background: "#f2ede3", color: ink }}>
                      Plain English
                    </span>
                    <span className="px-2.5 py-1">Structured</span>
                  </span>
                </div>
              </div>
              <div className="grid lg:grid-cols-[1fr_1.15fr]">
                <div
                  className="flex flex-col gap-4 border-b p-5 sm:p-6 lg:border-b-0 lg:border-r"
                  style={{ borderColor: "rgba(33,28,22,.1)" }}
                >
                  <MonoLabel>Request · no PHI stored</MonoLabel>
                  <p className="text-[16px] leading-[1.55]">{demoPrompt}</p>
                  <dl className="flex flex-col gap-1.5 font-landing-mono text-[12.5px]" style={{ color: "rgba(33,28,22,.65)" }}>
                    {example.facts.map(([label, value], index) => (
                      <div
                        key={label}
                        className={`flex justify-between gap-4 pb-1.5 ${index < example.facts.length - 1 ? "border-b border-dashed" : ""}`}
                        style={{ borderColor: "rgba(33,28,22,.12)" }}
                      >
                        <dt>{label}</dt>
                        <dd style={{ color: ink }}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <span className="font-landing-mono text-[11.5px]" style={{ color: "rgba(33,28,22,.65)" }}>
                    engine/{example.result.engineVersion}
                  </span>
                </div>
                <div className="flex flex-col gap-3.5 p-5 sm:p-6" style={{ background: "#fdfcf9" }}>
                  <MonoLabel>Deterministic response</MonoLabel>
                  {recommendation ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className="rounded-[5px] px-2 py-0.5 font-landing-mono text-[11px] font-medium uppercase text-white"
                          style={{ background: "#1f7a4d" }}
                        >
                          {recommendation.status.replaceAll("_", " ")}
                        </span>
                        <span className="text-[17px] font-semibold">{recommendation.screeningName}</span>
                      </div>
                      <p className="text-[14.5px] leading-[1.55]" style={{ color: "rgba(33,28,22,.75)" }}>
                        {recommendation.patientFriendlyExplanation}
                      </p>
                      <div className="flex flex-wrap gap-2 font-landing-mono text-[12px]">
                        <span className="rounded-full border bg-white px-2.5 py-1" style={{ borderColor: "rgba(33,28,22,.15)" }}>
                          {example.source?.organization || recommendation.sourceSystem} {sourceYear}
                        </span>
                        {recommendation.evidenceGrade ? (
                          <span className="rounded-full border bg-white px-2.5 py-1" style={{ borderColor: "rgba(33,28,22,.15)" }}>
                            Grade {recommendation.evidenceGrade}
                          </span>
                        ) : null}
                        {example.source?.url ? (
                          <a
                            href={example.source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border bg-white px-2.5 py-1"
                            style={{ borderColor: "rgba(33,28,22,.15)", color: ember }}
                          >
                            rule: {recommendation.id} ↗
                          </a>
                        ) : (
                          <span className="rounded-full border bg-white px-2.5 py-1" style={{ borderColor: "rgba(33,28,22,.15)", color: ember }}>
                            rule: {recommendation.id}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 border-t pt-3" style={{ borderColor: "rgba(33,28,22,.1)" }}>
                        <MonoLabel>What could change this</MonoLabel>
                        <span className="text-[13.5px] leading-normal" style={{ color: "rgba(33,28,22,.7)" }}>
                          {example.changeNote}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={example.careHref}
                          className="rounded-[7px] px-4 py-2 text-[13px] font-medium"
                          style={{ background: ink, color: paper }}
                        >
                          Find colonoscopy care
                        </Link>
                        <Link
                          href={example.screeningHref}
                          className="rounded-[7px] border px-4 py-2 text-[13px] font-medium"
                          style={{ borderColor: "rgba(33,28,22,.2)", color: ink }}
                        >
                          Run this example
                        </Link>
                      </div>
                      <p className="text-[12px] leading-5" style={{ color: "rgba(33,28,22,.68)" }}>
                        Care search uses the public NPI directory for this recommendation. OpenRx does not book the test.
                      </p>
                    </>
                  ) : (
                    <p className="text-[14px]" style={{ color: "rgba(33,28,22,.7)" }}>
                      No applicable rule found. Route to clinician review.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Sources strip */}
            <div className="mt-7 flex flex-col items-center gap-2 text-center">
              <div
                className="flex flex-wrap items-center justify-center gap-x-9 gap-y-2 font-landing-mono text-[13px]"
                style={{ color: "rgba(33,28,22,.65)" }}
              >
                <span className="text-[11px] uppercase tracking-[0.08em]">Encoded guideline sources</span>
                {encodedGuidelineOrganizations.map((source) => (
                  <span key={source} style={{ color: "rgba(33,28,22,.7)" }}>
                    {source}
                  </span>
                ))}
              </div>
              <p className="max-w-[46ch] text-[13px] leading-5" style={{ color: "rgba(33,28,22,.68)" }}>
                NCCN intervals are not encoded. Those cases route to clinician review.
              </p>
            </div>
          </div>
        </section>

        {/* Feature rows */}
        <section
          id="product"
          aria-labelledby="product-heading"
          className="border-t px-4 py-16 sm:px-10 sm:py-[72px]"
          style={{ borderColor: "rgba(33,28,22,.12)" }}
        >
          <h2 id="product-heading" className="sr-only">
            Product
          </h2>
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-[18px]">
            <div className="grid gap-[18px] md:grid-cols-2">
              <div
                className="flex flex-col gap-3.5 rounded-[14px] border bg-white p-6 sm:p-8"
                style={{ borderColor: "rgba(33,28,22,.14)" }}
              >
                <span className="font-landing-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: ember }}>
                  Evidence
                </span>
                <h3 className="text-[24px] font-medium leading-[1.2] tracking-[-0.02em] sm:text-[27px]" style={{ color: ink }}>
                  Source on every recommendation
                </h3>
                <p className="text-[15px] leading-[1.55]" style={{ color: "rgba(33,28,22,.65)" }}>
                  Organization, grade, date, and a direct link — on every answer, every time.
                </p>
                <div
                  className="mt-2 overflow-x-auto rounded-[10px] p-4 font-landing-mono text-[12.5px] leading-[1.7]"
                  style={{ background: "#f2ede3", color: "rgba(33,28,22,.7)" }}
                >
                  &quot;source&quot;: &quot;{example.source?.organization || "USPSTF"}&quot;
                  <br />
                  &quot;grade&quot;: &quot;{recommendation?.evidenceGrade || "B"}&quot;
                  <br />
                  &quot;published&quot;: &quot;{example.source?.versionOrDate || "2021-05-18"}&quot;
                  <br />
                  &quot;rule&quot;: &quot;{recommendation?.id || "uspstf-average-risk-colorectal"}&quot;
                  <br />
                  <span style={{ color: ember }}>&quot;link&quot;: &quot;uspreventiveservices…↗&quot;</span>
                </div>
              </div>
              <div
                className="flex flex-col gap-3.5 rounded-[14px] border bg-white p-6 sm:p-8"
                style={{ borderColor: "rgba(33,28,22,.14)" }}
              >
                <span className="font-landing-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: ember }}>
                  Audit
                </span>
                <h3 className="text-[24px] font-medium leading-[1.2] tracking-[-0.02em] sm:text-[27px]" style={{ color: ink }}>
                  Logic you can audit
                </h3>
                <p className="text-[15px] leading-[1.55]" style={{ color: "rgba(33,28,22,.65)" }}>
                  What was understood, which rule fired, what&apos;s missing, where uncertainty remains.
                </p>
                <div
                  className="mt-2 flex flex-col gap-2 rounded-[10px] p-4 font-landing-mono text-[12.5px]"
                  style={{ background: "#f2ede3", color: "rgba(33,28,22,.7)" }}
                >
                  <span>
                    <span style={{ color: "#1f7a4d" }}>✓</span> facts_used: age 45, male, no family cancer, never screened
                  </span>
                  <span>
                    <span style={{ color: "#1f7a4d" }}>✓</span> rule_fired: {recommendation?.id || "uspstf-average-risk-colorectal"}
                  </span>
                  <span>
                    <span style={{ color: example.result.clarificationQuestions.length ? ember : "#1f7a4d" }}>
                      {example.result.clarificationQuestions.length ? "△" : "✓"}
                    </span>{" "}
                    missing: {example.result.clarificationQuestions[0]?.id || "none on this example"}
                  </span>
                  <span>
                    <span style={{ color: "#1f7a4d" }}>✓</span> intake: {example.result.intakeCompleteness}
                  </span>
                </div>
              </div>
            </div>
            <div
              className="grid items-center gap-8 rounded-[14px] border p-6 sm:p-8 md:grid-cols-2"
              style={{ borderColor: "rgba(33,28,22,.14)", background: ink, color: paper }}
            >
              <div className="flex flex-col gap-3.5">
                <span className="font-landing-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "#e0704a" }}>
                  Action
                </span>
                <h3 className="text-[24px] font-medium leading-[1.2] tracking-[-0.02em] sm:text-[27px]" style={{ color: paper }}>
                  From answer to action in one workflow
                </h3>
                <p className="text-[15px] leading-[1.55]" style={{ color: "rgba(247,244,238,.65)" }}>
                  Care search, referral, prior authorization, or appeal preparation — always with human review before
                  anything is submitted.
                </p>
              </div>
              <div className="flex flex-col gap-2 font-landing-mono text-[13px]">
                <span
                  className="flex justify-between gap-3 rounded-lg border px-3.5 py-[11px]"
                  style={{ borderColor: "rgba(247,244,238,.2)" }}
                >
                  <span>1 · Find a screening site</span>
                  <span style={{ color: "#e0704a" }}>ready</span>
                </span>
                <span
                  className="flex justify-between gap-3 rounded-lg border px-3.5 py-[11px]"
                  style={{ borderColor: "rgba(247,244,238,.2)" }}
                >
                  <span>2 · Request specialist review</span>
                  <span style={{ color: "#e0704a" }}>ready</span>
                </span>
                <span
                  className="flex justify-between gap-3 rounded-lg border px-3.5 py-[11px]"
                  style={{ borderColor: "rgba(247,244,238,.2)", background: "rgba(247,244,238,.06)" }}
                >
                  <span>3 · Prepare prior-auth packet</span>
                  <span style={{ color: "rgba(247,244,238,.6)" }}>awaits clinician ✎</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Benchmark */}
        <section
          aria-labelledby="benchmark-heading"
          className="border-t px-4 py-16 sm:px-10 sm:py-[72px]"
          style={{ borderColor: "rgba(33,28,22,.12)" }}
        >
          <div className="mx-auto grid w-full max-w-[1280px] items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div className="flex flex-col gap-3.5">
              <span className="font-landing-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: ember }}>
                Benchmarks
              </span>
              <h2
                id="benchmark-heading"
                className="text-[30px] font-medium leading-[1.12] tracking-[-0.025em] sm:text-[38px]"
                style={{ color: ink }}
              >
                Validated on a published {benchmark.scenarioCount}-scenario benchmark
              </h2>
              <p className="text-[15.5px] leading-relaxed" style={{ color: "rgba(33,28,22,.65)" }}>
                The published run has {publishedCount("overall", "green")} fully green scenarios,{" "}
                {publishedCount("overall", "yellow")} yellow, and {publishedCount("overall", "red")} red. Yellow means
                the answer stayed safe but missed some expected wording. Any red blocks a release.
              </p>
              <Link href="/benchmark" className="text-[14.5px] font-medium" style={{ color: ember }}>
                View benchmark results →
              </Link>
            </div>
            <div className="flex flex-col gap-4">
              {benchmarkDimensions.map((dimension) => {
                const green = publishedCount(dimension.key, "green")
                const width = benchmark.scenarioCount
                  ? `${Math.round((green / benchmark.scenarioCount) * 100)}%`
                  : "0%"
                return (
                  <div key={dimension.key} className="flex flex-col gap-1.5">
                    <div className="flex justify-between gap-3 font-landing-mono text-[12.5px]">
                      <span>{dimension.label}</span>
                      <span>
                        {green}/{benchmark.scenarioCount} green
                      </span>
                    </div>
                    <div className="h-[34px] w-full rounded-md" style={{ background: "rgba(33,28,22,.08)" }}>
                      <div className="h-full rounded-md" style={{ width, background: ember }} />
                    </div>
                  </div>
                )
              })}
              <span className="font-landing-mono text-[11px]" style={{ color: "rgba(33,28,22,.65)" }}>
                published {benchmark.generatedAt.slice(0, 10)} · engine {benchmark.engineVersion} · openrx.health/benchmark
              </span>
            </div>
          </div>
        </section>

        {/* Trust row */}
        <section
          aria-labelledby="trust-heading"
          className="border-t px-4 py-12 sm:px-10 sm:py-14"
          style={{ borderColor: "rgba(33,28,22,.12)" }}
        >
          <h2 id="trust-heading" className="sr-only">
            Trust commitments
          </h2>
          <div className="mx-auto grid w-full max-w-[1280px] gap-8 md:grid-cols-3 md:gap-10">
            <div className="flex flex-col gap-2">
              <MonoLabel>No PHI retention</MonoLabel>
              <p className="text-[14.5px] leading-[1.55]" style={{ color: "rgba(33,28,22,.7)" }}>
                Public workflows run on synthetic or self-described inputs. Nothing is stored to your identity.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <MonoLabel>Human review before action</MonoLabel>
              <p className="text-[14.5px] leading-[1.55]" style={{ color: "rgba(33,28,22,.7)" }}>
                No silent clinical submission — a clinician approves every prepared referral, prior auth, or appeal.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <MonoLabel>Version-stamped rules</MonoLabel>
              <p className="text-[14.5px] leading-[1.55]" style={{ color: "rgba(33,28,22,.7)" }}>
                Every answer names the engine version and rule that produced it, so it can be reproduced later.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-4 pb-10 pt-16 sm:px-10 sm:pt-[72px]" style={{ background: ink, color: paper }}>
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-12">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end sm:gap-8">
            <h2 className="max-w-[16ch] text-[32px] font-medium leading-[1.1] tracking-[-0.03em] sm:text-[44px]" style={{ color: paper }}>
              Imagine care you can verify
            </h2>
            <Link
              href="/chat"
              className="whitespace-nowrap rounded-lg px-6 py-3 text-[15px] font-medium text-white"
              style={{ background: ember }}
            >
              Ask OpenRx
            </Link>
          </div>
          <div
            className="grid gap-8 border-t pt-10 text-[13.5px] sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]"
            style={{ borderColor: "rgba(247,244,238,.15)" }}
          >
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="grid h-5 w-5 place-items-center rounded-[5px] text-[12px] font-black"
                  style={{ background: ember, color: paper }}
                  aria-hidden
                >
                  +
                </span>
                <span className="text-[15px] font-semibold">OpenRx</span>
              </div>
              <p className="max-w-[40ch] text-[11.5px] leading-[1.6]" style={{ color: "rgba(247,244,238,.6)" }}>
                Educational, not medical advice or a diagnosis. OpenRx does not place clinical orders or replace
                clinician judgment. OpenRx does not claim HIPAA compliance or SOC 2 certification for public workflows.
              </p>
            </div>
            <nav className="flex flex-col gap-2" aria-label="Product" style={{ color: "rgba(247,244,238,.7)" }}>
              <MonoLabel tone="light">Product</MonoLabel>
              <Link href="/screening" style={{ color: "inherit" }}>
                Screening
              </Link>
              <Link href={{ pathname: "/chat", query: { topic: "coverage" } }} style={{ color: "inherit" }}>
                Coverage
              </Link>
              <Link href="/providers" style={{ color: "inherit" }}>
                Find care
              </Link>
              <Link href="/benchmark" style={{ color: "inherit" }}>
                Benchmark
              </Link>
            </nav>
            <nav className="flex flex-col gap-2" aria-label="Audiences" style={{ color: "rgba(247,244,238,.7)" }}>
              <MonoLabel tone="light">Audiences</MonoLabel>
              <Link href="/screening" style={{ color: "inherit" }}>
                Patients
              </Link>
              <Link href="/demo" style={{ color: "inherit" }}>
                Clinicians
              </Link>
              <Link href="/trust" style={{ color: "inherit" }}>
                Health systems
              </Link>
            </nav>
            <nav className="flex flex-col gap-2" aria-label="Company" style={{ color: "rgba(247,244,238,.7)" }}>
              <MonoLabel tone="light">Company</MonoLabel>
              <Link href="/trust" style={{ color: "inherit" }}>
                Trust
              </Link>
              <Link href="/privacy-explained" style={{ color: "inherit" }}>
                Privacy
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
