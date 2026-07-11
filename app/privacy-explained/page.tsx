import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Server,
  Shield,
  XCircle,
} from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"

export const metadata: Metadata = {
  title: "Privacy explained | OpenRx",
  description:
    "Plain-language OpenRx privacy boundaries for demo data, wallet identity, workflow analytics, AI routing, and patient control.",
  alternates: {
    canonical: "/privacy-explained",
  },
}

const shortVersion = [
  "In demo mode, the app uses sample patient data and does not need a personal account.",
  "We do not sell your data to advertisers, insurers, pharmacies, or data brokers.",
  "We only send the minimum context needed to answer a question or complete a workflow.",
  "Wallet connection is optional and used as a pseudonymous profile identifier, not as your name.",
  "You can use the product without creating a permanent identity in the app shell.",
  "OpenRx is a personal health workflow tool, not a hospital, insurer, or clinician.",
]

const demoStorage = [
  "The interface can run on seeded demo records without requiring personal health information.",
  "Care Plan tasks saved in demo mode stay in this browser and contain concise next-step summaries, not a full medical record.",
  "Your session behavior is meant to be explorable before you commit any persistent identity.",
  "Clearing local browser state removes the temporary client-side session context used for demo flows.",
]

const walletStorage = [
  "Connected wallet mode stores profile preferences against a pseudonymous wallet address.",
  "Optional USDC tips on Base record only a payment transaction. Prompts, recommendations, names, insurance IDs, and patient identifiers are not written on-chain.",
  "Wallet-linked preferences are meant for continuity of care coordination, not public disclosure.",
]

const workflowAnalytics = [
  "We track workflow events such as chat started, answer generated, source opened, care plan created, provider saved, tip completed, and red-flag safety triggered.",
  "Events use a temporary pseudonymous session identifier and a small allowlist of status/category fields.",
  "We do not log clinical prompts, names, phone numbers, medical-record numbers, insurance IDs, Social Security numbers, or full addresses in product analytics by default.",
]

const neverDo = [
  "Sell patient data to third parties",
  "Hand your information to insurers for underwriting",
  "Share your workflow history with employers",
  "Use your prompts as ad-targeting inventory",
  "Store full insurance IDs or Social Security numbers by design",
  "Treat product analytics as a substitute for care consent",
]

const assistantLimits = [
  "Diagnose conditions or replace a licensed clinician",
  "Log directly into payer portals or hospital systems on your behalf",
  "Interpret every workflow as a permanent medical record",
  "Guarantee that a provider, insurer, or trial site will accept your case",
]

const rights = [
  {
    title: "Use it without a full profile",
    description: "You can explore much of OpenRx in demo mode before connecting a wallet or saving preferences.",
  },
  {
    title: "Disconnect and minimize",
    description: "You can disconnect the wallet-linked profile path and reduce what is associated with your session.",
  },
  {
    title: "Ask how a workflow uses data",
    description: "We owe you plain-language explanations of what a workflow needs and what leaves the browser.",
  },
]

export default function PrivacyExplainedPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#050505]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="OpenRx home">
            <BrandMark size="sm" tone="dark" />
            <BrandWordmark tone="dark" subtitle />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="hidden rounded-full border border-white/12 px-4 py-2 font-medium text-zinc-300 transition hover:border-white/25 hover:text-white sm:inline-flex">
              Home
            </Link>
            <Link href="/chat" className="inline-flex min-h-10 items-center justify-center rounded-full bg-cyan-200 px-4 font-semibold text-black transition hover:bg-cyan-100">
              Ask OpenRx
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="border-b border-white/10 pb-10">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Privacy explained</p>
            <h1 className="orx-display-heading mt-5 max-w-4xl text-[clamp(2.7rem,6vw,5.3rem)] text-white">
              Plain data boundaries before care navigation.
            </h1>
            <p className="mt-5 max-w-3xl text-[15px] leading-8 text-zinc-300">
              OpenRx should be understandable before it asks for trust. This page explains what can stay local, what
              changes when identity is connected, and what the assistant is not allowed to do.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/12 px-3 py-1.5 text-[12px] font-medium text-zinc-300">demo-first workflows</span>
            <span className="rounded-full border border-white/12 px-3 py-1.5 text-[12px] font-medium text-zinc-300">wallet optional</span>
            <span className="rounded-full border border-white/12 px-3 py-1.5 text-[12px] font-medium text-zinc-300">minimum context AI routing</span>
          </div>
        </section>

        <section className="mt-10 grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-cyan-100">
              <Lock size={16} />
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">Short version</h2>
            </div>
            <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
              {shortVersion.map((item) => (
                <div key={item} className="flex items-start gap-3 py-3">
                  <CheckCircle2 size={15} className="mt-1 shrink-0 text-cyan-200" />
                  <p className="text-sm leading-6 text-zinc-200">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-y border-white/10 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Trust posture</p>
            <h2 className="orx-section-heading mt-3 text-[clamp(1.9rem,3vw,2.85rem)] text-white">
              Reduce healthcare friction without monetizing patient exposure.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300">
              The design principle is simple: use the minimum information needed to move a workflow forward, keep the
              user in control of when identity becomes persistent, and avoid hiding sensitive behavior behind vague copy.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-white">Default mode</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Demo-safe exploration is a first-class path. The product should be understandable before you trust it.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Persistent mode</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  When you connect identity, the app should explain what is being stored, why, and what still stays out.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-cyan-100">
              <Server size={16} />
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">What stays local in demo mode</h2>
            </div>
            <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
              {demoStorage.map((item) => (
                <p key={item} className="py-3 text-sm leading-6 text-zinc-300">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-cyan-100">
              <Shield size={16} />
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">What changes if you connect a wallet</h2>
            </div>
            <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
              {walletStorage.map((item) => (
                <p key={item} className="py-3 text-sm leading-6 text-zinc-300">
                  {item}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[24px] border border-rose-300/16 bg-rose-300/[0.035] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-rose-100">
            <EyeOff size={16} />
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">What we do not do</h2>
          </div>
          <div className="mt-5 grid gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
            {neverDo.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 border-t border-white/10 pt-3"
              >
                <XCircle size={15} className="mt-1 shrink-0 text-rose-200" />
                <p className="text-sm leading-6 text-zinc-200">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-cyan-100">
            <Eye size={16} />
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">Workflow analytics</h2>
          </div>
          <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
            {workflowAnalytics.map((item) => (
              <p key={item} className="py-3 text-sm leading-6 text-zinc-300">
                {item}
              </p>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-cyan-100">
              <Bot size={16} />
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">How AI is routed</h2>
            </div>
            <div className="mt-5 space-y-5">
              <div className="border-t border-white/10 pt-4">
                <h3 className="text-sm font-semibold text-white">Safety layer first, provider second</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  OpenRx routes AI requests through a safety and workflow layer before they reach any model provider.
                  The exact provider behind a workflow may change over time as reliability, safety, and cost settings
                  change, so we do not treat any one model vendor as permanent product infrastructure.
                </p>
              </div>
              <div className="border-t border-white/10 pt-4">
                <h3 className="text-sm font-semibold text-white">Minimum context only</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  We only send the prompt and the smallest amount of structured context needed for the task. We do not
                  intentionally include Social Security numbers, insurance IDs, or wallet addresses in model requests.
                </p>
              </div>
              <div className="border-t border-white/10 pt-4">
                <h3 className="text-sm font-semibold text-white">Retention is provider-dependent</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Where a provider offers no-training or reduced-retention controls, OpenRx is configured to prefer
                  them. Provider-side policies can still differ by workflow, so we avoid promising that every provider
                  behaves identically.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-cyan-100">
              <Eye size={16} />
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">What the assistant cannot do</h2>
            </div>
            <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
              {assistantLimits.map((item) => (
                <div key={item} className="flex items-start gap-3 py-3">
                  <XCircle size={14} className="mt-1 shrink-0 text-zinc-500" />
                  <p className="text-sm leading-6 text-zinc-300">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[24px] border border-amber-200/20 bg-amber-200/[0.045] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-1 shrink-0 text-amber-200" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">Clinical boundary</p>
              <h2 className="orx-section-heading mt-3 text-[1.7rem] text-white">OpenRx is not your doctor.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
                OpenRx is a personal coordination and decision-support product. It can help you organize questions,
                surface likely next steps, and reduce friction across care workflows. It does not replace a licensed
                clinician, hospital, or health plan, and it should not be treated like a legal medical record.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-2 text-cyan-100">
            <Shield size={16} />
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">Your rights in the product</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {rights.map((item) => (
              <div key={item.title} className="rounded-[20px] border border-white/10 bg-white/[0.035] p-5">
                <CheckCircle2 size={16} className="text-cyan-200" />
                <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-12 border-t border-white/10 py-8 text-center">
          <p className="text-sm text-zinc-300">
            Questions about privacy or data handling?{" "}
            <a href="mailto:privacy@openrx.health" className="font-semibold text-cyan-100 hover:text-white">
              privacy@openrx.health
            </a>
          </p>
          <p className="mt-2 text-xs text-zinc-500">Last updated April 2026</p>
        </footer>
      </main>
    </div>
  )
}
