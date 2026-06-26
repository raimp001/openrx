import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  FileCheck2,
  HeartPulse,
  LockKeyhole,
  MapPinned,
  ShieldCheck,
  Stethoscope,
} from "lucide-react"

import { BrandMark } from "@/components/brand-logo"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "OpenRx | Guideline-grounded screening and prior-auth workflows",
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

const audiences = [
  {
    eyebrow: "Patient",
    title: "See what screening may be due.",
    body: "Answer in plain language, review the source and grade, then find the right clinician, lab, or imaging center.",
    href: "/screening",
    label: "Check my screening",
    icon: HeartPulse,
    primary: true,
  },
  {
    eyebrow: "Clinician",
    title: "Turn a question into a sourced next step.",
    body: "Prepare concise summaries, clarify missing history, and draft messages without letting a model invent a recommendation.",
    href: "/chat",
    label: "Open clinician workspace",
    icon: Stethoscope,
    primary: false,
  },
  {
    eyebrow: "Health system or builder",
    title: "Evaluate the workflow infrastructure.",
    body: "Inspect deterministic rules, audit traces, consent gates, and prior-auth preparation through the working sandbox.",
    href: "/demo",
    label: "View API and workflow demo",
    icon: Code2,
    primary: false,
  },
]

const workflows = [
  {
    title: "Consumer screening check",
    input: "Age, sex used for screening, history, smoking exposure, and prior tests.",
    decision: "The rules engine returns only the recommendations it can support.",
    action: "Clarify missing details or connect to nearby care.",
    icon: HeartPulse,
  },
  {
    title: "Pre-visit planning",
    input: "Family cancer history, diagnosis ages, and known inherited-risk variants.",
    decision: "Average-risk certainty is suppressed when a high-risk pathway may apply.",
    action: "Prepare genetic-counseling or specialist review.",
    icon: ClipboardCheck,
  },
  {
    title: "Denial-to-appeal preparation",
    input: "Payer denial, requested treatment, prior therapies, and supporting records.",
    decision: "OpenRx organizes source metadata and missing documentation.",
    action: "Create a clinician-reviewable appeal packet, never an approval guarantee.",
    icon: FileCheck2,
  },
]

const standards = [
  {
    label: "USPSTF",
    detail: "Average-risk preventive screening",
    href: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-a-and-b-recommendations",
  },
  {
    label: "CMS",
    detail: "Prior-authorization interoperability",
    href: "https://www.cms.gov/priorities/key-initiatives/burden-reduction/interoperability",
  },
  {
    label: "NPPES",
    detail: "Public provider-directory data",
    href: "https://npiregistry.cms.hhs.gov/",
  },
  {
    label: "ClinicalTrials.gov",
    detail: "Candidate trial discovery",
    href: "https://clinicaltrials.gov/",
  },
]

function SourcedPreview() {
  return (
    <section
      aria-labelledby="preview-heading"
      className="border-y border-white/10 bg-[#080a0a] px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] lg:items-start">
        <div className="pt-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">Working example</p>
          <h2 id="preview-heading" className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">
            A recommendation you can inspect before you act.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-zinc-300">
            OpenRx shows what it understood, what rule fired, and what information could change the answer. The
            example is educational, not personal medical advice.
          </p>
        </div>

        <div className="overflow-hidden rounded-[20px] border border-white/12 bg-[#050707] shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
              Source-stamped screening output
            </span>
            <span className="text-[11px] font-medium text-zinc-400">Deterministic response</span>
          </div>

          <div className="grid gap-0 md:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-white/10 p-5 md:border-b-0 md:border-r">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">Plain-English input</p>
              <p className="mt-3 text-sm leading-7 text-zinc-100">
                45 male, no symptoms, no personal or family cancer history, never screened for colorectal cancer.
              </p>
            </div>
            <div className="bg-cyan-200/[0.045] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-100">Recommendation</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Colorectal cancer screening</h3>
                </div>
                <span className="rounded-full bg-cyan-200 px-2.5 py-1 text-[10px] font-bold uppercase text-black">
                  Due
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                For an average-risk adult who reports no prior colorectal screening, screening begins at age 45.
              </p>
              <a
                href="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-200/24 bg-cyan-200/[0.08] px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/45"
              >
                USPSTF 2021, Grade B
                <ArrowRight size={13} />
              </a>
            </div>
          </div>

          <div className="grid border-t border-white/10 sm:grid-cols-3">
            {[
              { label: "Find a clinician", icon: Stethoscope },
              { label: "Find a screening site", icon: MapPinned },
              { label: "Draft a clinician message", icon: Bot },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center gap-3 border-b border-white/10 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                  <Icon size={15} className="shrink-0 text-cyan-100" />
                  <p className="text-xs font-semibold text-zinc-200">{item.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

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
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="OpenRx home">
            <BrandMark size="sm" />
            <span className="text-sm font-semibold text-white">OpenRx</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-zinc-300 md:flex" aria-label="Main">
            <a href="#how-it-works" className="transition hover:text-white">
              How it works
            </a>
            <a href="#health-systems" className="transition hover:text-white">
              For health systems
            </a>
            <Link href="/trust" className="transition hover:text-white">
              Trust
            </Link>
            <Link href="/demo" className="transition hover:text-white">
              API and demo
            </Link>
          </nav>
          <Link
            href="/screening"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-cyan-200 px-4 text-sm font-semibold text-black transition hover:bg-cyan-100"
          >
            Patient screening
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="relative px-4 pb-9 pt-11 sm:px-6 sm:pb-11 sm:pt-14 lg:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.055] px-3 py-1 text-[12px] font-medium text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
              Screening, care navigation, and prior authorization
            </span>
            <h1 className="orx-display-heading mx-auto mt-5 max-w-5xl text-[clamp(3rem,7vw,5.7rem)] text-white">
              OpenRx turns guidelines into care.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-[17px] leading-8 text-zinc-300 sm:text-xl">
              Guideline-grounded cancer screening and prior-auth workflows for patients, clinicians, and health
              systems. Recommendations come from version-stamped rules, not model guesses.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/screening"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-cyan-200 px-6 text-sm font-bold text-black transition hover:bg-cyan-100 sm:w-auto"
              >
                I am a patient: check my screening
                <HeartPulse size={16} />
              </Link>
              <Link
                href="/chat"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/14 bg-white/[0.055] px-5 text-sm font-semibold text-white transition hover:border-cyan-200/35 hover:bg-white/[0.08] sm:w-auto"
              >
                I am a clinician
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/demo"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm font-semibold text-zinc-300 transition hover:text-white sm:w-auto"
              >
                Health systems and API
                <ArrowRight size={15} />
              </Link>
            </div>

          </div>
        </section>

        <SourcedPreview />

        <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-labelledby="audience-heading">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">Choose your path</p>
              <h2 id="audience-heading" className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                One product, three focused entry points.
              </h2>
            </div>
            <div className="mt-8 grid gap-3 lg:grid-cols-3">
              {audiences.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.eyebrow}
                    href={item.href}
                    className={`group flex min-h-[250px] flex-col justify-between rounded-[20px] border p-5 transition sm:p-6 ${
                      item.primary
                        ? "border-cyan-200/28 bg-cyan-200/[0.075] hover:border-cyan-200/48"
                        : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100">{item.eyebrow}</span>
                        <Icon size={18} className="text-zinc-300" />
                      </div>
                      <h3 className="mt-6 text-xl font-semibold leading-snug text-white">{item.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-zinc-400">{item.body}</p>
                    </div>
                    <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100">
                      {item.label}
                      <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-white/10 bg-white/[0.025] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">How it works</p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">From a question to the next useful action.</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                Each workflow separates the information supplied, the deterministic decision, and the action that
                follows.
              </p>
            </div>
            <div className="mt-9 grid gap-4 lg:grid-cols-3">
              {workflows.map((item) => {
                const Icon = item.icon
                return (
                  <article key={item.title} className="rounded-[20px] border border-white/10 bg-[#080a0a] p-5 sm:p-6">
                    <Icon size={19} className="text-cyan-100" />
                    <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                    <dl className="mt-5 space-y-4 text-sm leading-6">
                      <div>
                        <dt className="font-semibold text-zinc-200">Input</dt>
                        <dd className="mt-1 text-zinc-400">{item.input}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-zinc-200">Decision</dt>
                        <dd className="mt-1 text-zinc-400">{item.decision}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-zinc-200">Action</dt>
                        <dd className="mt-1 text-zinc-400">{item.action}</dd>
                      </div>
                    </dl>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section id="health-systems" className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.48fr)_minmax(0,0.52fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">For health systems</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Add an auditable action layer without replacing the clinical record.
              </h2>
              <p className="mt-5 text-sm leading-7 text-zinc-300">
                OpenRx is designed to sit above existing systems: interpret a patient question, run versioned rules,
                prepare the minimum necessary handoff, and preserve the evidence trail.
              </p>
              <Link
                href="/demo"
                className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/[0.08] px-4 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/45"
              >
                Explore the workflow sandbox
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {[
                {
                  title: "Deterministic clinical boundary",
                  body: "The model can parse and explain. It cannot create or alter a screening recommendation.",
                  icon: ShieldCheck,
                },
                {
                  title: "Consent and minimum necessary disclosure",
                  body: "Referral fields come from a fixed, versioned template and are shown before consent.",
                  icon: LockKeyhole,
                },
                {
                  title: "Audit-ready workflow",
                  body: "Recommendation source, rule version, consent scope, and state transitions remain inspectable.",
                  icon: BadgeCheck,
                },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-5">
                    <Icon size={18} className="mt-0.5 text-cyan-100" />
                    <div>
                      <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#080a0a] px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-labelledby="trust-heading">
          <div className="mx-auto grid w-full max-w-6xl gap-9 lg:grid-cols-[minmax(0,0.43fr)_minmax(0,0.57fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">Data and clinical trust</p>
              <h2 id="trust-heading" className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                Concrete boundaries, stated plainly.
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                OpenRx does not claim HIPAA compliance or SOC 2 certification today. The public screening path is
                stateless by default, and PHI persistence remains a gated deployment decision.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/trust" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-100 hover:text-cyan-50">
                  Read the current trust posture
                  <ArrowRight size={14} />
                </Link>
                <Link href="/privacy-explained" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-white">
                  Privacy in plain English
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Patient screening can run without an account or stored profile.",
                "Clinical model access for PHI is disabled unless the server is explicitly configured for a BAA-governed mode.",
                "Recommendations carry a source, evidence grade, and rule version.",
                "Encryption, retention, access controls, incident response, and vendor BAAs are deployment gates before any PHI pilot.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-[16px] border border-white/10 bg-white/[0.035] p-4">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-cyan-100" />
                  <p className="text-sm leading-6 text-zinc-300">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 lg:px-8" aria-labelledby="standards-heading">
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Public foundations</p>
                <h2 id="standards-heading" className="mt-2 text-xl font-semibold text-white">
                  Grounded in inspectable standards and sources.
                </h2>
              </div>
              <p className="text-xs text-zinc-500">Source use does not imply endorsement.</p>
            </div>
            <div className="mt-6 grid gap-px overflow-hidden rounded-[16px] border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
              {standards.map((standard) => (
                <a
                  key={standard.label}
                  href={standard.href}
                  className="group bg-[#080a0a] p-4 transition hover:bg-white/[0.055]"
                >
                  <p className="flex items-center justify-between gap-3 text-sm font-semibold text-white">
                    {standard.label}
                    <ArrowRight size={13} className="text-zinc-500 transition group-hover:text-cyan-100" />
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-400">{standard.detail}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 pt-6 sm:px-6 sm:pb-20 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-center">
            <div>
              <p className="text-xl font-semibold text-white">Start with one patient question.</p>
              <p className="mt-2 text-sm text-zinc-400">Get the source, the uncertainty, and the next useful action.</p>
            </div>
            <Link
              href="/screening"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-cyan-200 px-5 text-sm font-bold text-black transition hover:bg-cyan-100"
            >
              Check my screening
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
