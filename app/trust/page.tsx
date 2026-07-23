import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Trust and evidence posture | OpenRx",
  description:
    "OpenRx privacy, citation provenance, demo boundaries, prior authorization posture, and requirements before handling PHI.",
}

const currentPosture = [
  "The public demo uses synthetic data and does not make a live payer submission.",
  "Clinical answers and appeal drafts require clinician review before external action.",
  "Wallet identity is optional. Patient health information is not written on-chain.",
  "OpenRx does not claim HIPAA compliance or SOC 2 certification today.",
]

const beforePhi = [
  "Complete a documented HIPAA applicability and data-flow review with counsel.",
  "Execute BAAs with vendors that create, receive, maintain, or transmit ePHI where required.",
  "Validate least privilege access, audit logging, encryption, incident response, retention, and deletion.",
  "Define who clinically reviews output and who is authorized to submit prior authorization work.",
]

const evidencePolicy = [
  {
    title: "Public sources",
    text: "FDA, CMS, USPSTF, CDC, and other public sources may be linked with publication or access dates.",
  },
  {
    title: "Licensed guidelines",
    text: "NCCN material is shown only as guideline metadata in the public demo unless current licensed retrieval is implemented and verified.",
  },
  {
    title: "Version pinning",
    text: "Submission-ready work must identify the source organization and version or retrieval date before clinician review.",
  },
]

const navigationControls = [
  {
    title: "Model boundary",
    text: "Models parse and explain. Screening recommendations come from deterministic, version-stamped rules with source, grade, link, and rule id.",
  },
  {
    title: "Published benchmark",
    text: "Every release is scored against a public 50-scenario clinical-answer benchmark covering citations, version pinning, correctness, sycophancy, and fabrication. Results are published, including the yellow cells.",
  },
  {
    title: "PHI-minimized logs",
    text: "Operational logs keep request ids, error codes, versions, hashes, and state transitions. Raw patient text is scrubbed or excluded.",
  },
  {
    title: "Referral disclosure",
    text: "Provider handoffs use deterministic scope templates, patient consent snapshots, BAA gates, and audit rows tied to the recommendation.",
  },
  {
    title: "Interop path",
    text: "OpenRx is designed as a navigation layer over FHIR, SMART launch, provider directories, pharmacies, labs, imaging, and prior-auth workflows.",
  },
]

const externalResources = [
  { label: "HHS Security Rule", href: "https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html" },
  { label: "HHS de-identification", href: "https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html" },
  { label: "FDA CDS guidance", href: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software" },
  { label: "HL7 FHIR R4", href: "https://hl7.org/fhir/R4/" },
]

export default function TrustPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5 sm:px-8">
          <Link href="/chat" className="flex items-center gap-3" aria-label="OpenRx chat">
            <BrandMark size="sm" tone="light" />
            <BrandWordmark tone="light" subtitle={false} />
          </Link>
          <Link href="/demo" className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-400">
            Open PA demo <ArrowRight size={14} />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <Link href="/demo" className="inline-flex min-h-[44px] items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800">
          <ArrowLeft size={14} /> Back to demo
        </Link>
        <section className="mt-8 max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-700">Trust and evidence</p>
          <h1 className="mt-5 text-[clamp(2.4rem,5vw,4.25rem)] font-medium leading-[1.08] tracking-[-0.03em] text-zinc-900">
            Clear boundaries before clinical workflow.
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-600">
            OpenRx is building an evidence-linked workflow layer for clinical questions and prior authorization preparation. The public experience is a sandbox, not clinical care or a payer portal.
          </p>
        </section>

        <section className="mt-12 grid gap-5 lg:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[14px] border border-zinc-200 bg-zinc-50 p-6 sm:p-7">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
              <ShieldCheck size={17} className="text-cyan-700" /> Current posture
            </div>
            <div className="mt-5 space-y-4">
              {currentPosture.map((item) => (
                <div key={item} className="flex gap-3 text-sm leading-6 text-zinc-700">
                  <CheckCircle2 size={15} className="mt-1 shrink-0 text-cyan-700" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[14px] border border-amber-300/60 bg-amber-50 p-6 sm:p-7">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
              <LockKeyhole size={17} className="text-amber-700" /> Before any PHI pilot
            </div>
            <div className="mt-5 space-y-4">
              {beforePhi.map((item) => (
                <p key={item} className="text-sm leading-6 text-zinc-700">{item}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[14px] border border-zinc-200 p-6 sm:p-8">
          <h2 className="text-xl font-medium text-zinc-900">Citation provenance policy</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {evidencePolicy.map((item) => (
              <div key={item.title} className="border-t border-zinc-200 pt-4">
                <h3 className="text-sm font-medium text-zinc-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[14px] border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
          <h2 className="text-xl font-medium text-zinc-900">Patient-navigation safety controls</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            The screening and referral surface is built around an explicit operating contract: deterministic clinical rules, PHI-minimized logs, consented handoffs, and clinician review when the engine is uncertain.
          </p>
          <div className="mt-6 grid gap-x-8 md:grid-cols-2">
            {navigationControls.map((item) => (
              <div key={item.title} className="border-t border-zinc-200 py-4">
                <h3 className="text-sm font-medium text-zinc-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-200 pt-5 text-sm font-medium">
            <Link href="/benchmark" className="text-cyan-700 hover:text-cyan-900">
              Published accuracy benchmark
            </Link>
            {externalResources.map((resource) => (
              <a
                key={resource.href}
                href={resource.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-700 hover:text-cyan-900"
              >
                {resource.label} ↗
              </a>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 border-t border-zinc-200 pt-8 text-sm leading-6 text-zinc-600 sm:grid-cols-2">
          <div>
            <h2 className="font-medium text-zinc-900">Regulatory timing</h2>
            <p className="mt-3">
              CMS-0057-F generally requires impacted payers to implement prior authorization APIs beginning January 1, 2027 for applicable covered items and services. Its final-rule API scope excludes drugs. CMS proposed separate drug requirements in April 2026.
            </p>
          </div>
          <div>
            <h2 className="font-medium text-zinc-900">Product boundary</h2>
            <p className="mt-3">
              OpenRx may prepare workflow drafts and show sandbox traces. It does not diagnose, order treatment, guarantee coverage, or represent a live authorization submission in the public demo.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
