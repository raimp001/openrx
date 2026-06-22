import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"

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

export default function TrustPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <header className="border-b border-white/[0.08] bg-[#050505]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5 sm:px-8">
          <Link href="/chat" className="flex items-center gap-3" aria-label="OpenRx chat">
            <BrandMark size="sm" tone="dark" />
            <BrandWordmark tone="dark" subtitle={false} />
          </Link>
          <Link href="/demo" className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm font-medium hover:border-white/25">
            Open PA demo <ArrowRight size={14} />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <Link href="/demo" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft size={14} /> Back to demo
        </Link>
        <section className="mt-8 max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">Trust and evidence</p>
          <h1 className="orx-display-heading mt-5 text-[clamp(2.4rem,5vw,4.25rem)] text-white">
            Clear boundaries before clinical workflow.
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-400">
            OpenRx is building an evidence-linked workflow layer for clinical questions and prior authorization preparation. The public experience is a sandbox, not clinical care or a payer portal.
          </p>
        </section>

        <section className="mt-12 grid gap-5 lg:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 sm:p-7">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <ShieldCheck size={17} className="text-cyan-200" /> Current posture
            </div>
            <div className="mt-5 space-y-4">
              {currentPosture.map((item) => (
                <div key={item} className="flex gap-3 text-sm leading-6 text-zinc-300">
                  <CheckCircle2 size={15} className="mt-1 shrink-0 text-cyan-200" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border border-amber-200/15 bg-amber-200/[0.035] p-6 sm:p-7">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <LockKeyhole size={17} className="text-amber-200" /> Before any PHI pilot
            </div>
            <div className="mt-5 space-y-4">
              {beforePhi.map((item) => (
                <p key={item} className="text-sm leading-6 text-zinc-300">{item}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.025] p-6 sm:p-8">
          <h2 className="text-xl font-medium text-white">Citation provenance policy</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {evidencePolicy.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/[0.08] bg-[#09090b] p-5">
                <h3 className="text-sm font-medium text-zinc-100">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 border-t border-white/[0.08] pt-8 text-sm leading-6 text-zinc-400 sm:grid-cols-2">
          <div>
            <h2 className="font-medium text-zinc-100">Regulatory timing</h2>
            <p className="mt-3">
              CMS-0057-F generally requires impacted payers to implement prior authorization APIs beginning January 1, 2027 for applicable covered items and services. Its final-rule API scope excludes drugs. CMS proposed separate drug requirements in April 2026.
            </p>
          </div>
          <div>
            <h2 className="font-medium text-zinc-100">Product boundary</h2>
            <p className="mt-3">
              OpenRx may prepare workflow drafts and show sandbox traces. It does not diagnose, order treatment, guarantee coverage, or represent a live authorization submission in the public demo.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
