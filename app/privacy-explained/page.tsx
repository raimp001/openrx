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
  "Your session behavior is meant to be explorable before you commit any persistent identity.",
  "Clearing local browser state removes the temporary client-side session context used for demo flows.",
]

const walletStorage = [
  "Connected wallet mode stores profile preferences against a pseudonymous wallet address.",
  "We do not intentionally write identifiers like Social Security numbers or insurance IDs on-chain.",
  "Wallet-linked preferences are meant for continuity of care coordination, not public disclosure.",
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_16%_0%,rgba(47,107,255,0.08),transparent_26%),radial-gradient(circle_at_86%_12%,rgba(47,107,255,0.08),transparent_22%),linear-gradient(180deg,#f7faff_0%,#edf4ff_46%,#ffffff_100%)]">
      <header className="sticky top-0 z-50 border-b border-[rgba(82,108,139,0.12)] bg-[rgba(247,250,255,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark size="sm" />
            <BrandWordmark subtitle />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="chip hover:border-teal/30 hover:text-primary">
              Home
            </Link>
            <Link href="/dashboard" className="control-button-primary px-4 py-2">
              Open Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <section className="surface-hero relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(47,107,255,0.12),transparent_24%),radial-gradient(circle_at_88%_16%,rgba(47,107,255,0.09),transparent_20%)]" />
          <div className="relative max-w-4xl">
            <span className="eyebrow-pill">Privacy explained</span>
            <h1 className="mt-5 max-w-4xl text-[clamp(3rem,6vw,5.4rem)] font-serif text-primary">
              How OpenRx handles data, in plain English.
            </h1>
            <p className="mt-5 max-w-3xl text-[15px] leading-8 text-secondary">
              This page exists so you can understand the product without reading a legal maze. OpenRx is designed to
              help people coordinate care, screening, medication access, and provider matching without turning every
              click into a hidden data transaction.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <span className="chip">demo-first workflows</span>
              <span className="chip">wallet optional</span>
              <span className="chip">minimal-context AI routing</span>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="surface-card p-6">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-accent" />
              <div className="section-title">Short version</div>
            </div>
            <div className="mt-5 space-y-3">
              {shortVersion.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[18px] bg-[rgba(255,255,255,0.74)] px-4 py-3">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-accent" />
                  <p className="text-sm leading-6 text-primary">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_58%,#173B83_100%)] px-6 py-6 text-white shadow-[0_26px_70px_rgba(8,24,46,0.16)]">
            <div className="section-title text-white/55">Trust posture</div>
            <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.8rem)] font-semibold tracking-[-0.05em]">
              We built OpenRx to reduce healthcare friction, not to monetize patient exposure.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72">
              The design principle is simple: use the minimum information needed to move a workflow forward, keep the
              user in control of when identity becomes persistent, and avoid hiding sensitive behavior behind vague copy.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4">
                <div className="section-title text-white/50">Default mode</div>
                <p className="mt-2 text-sm leading-6 text-white/78">
                  Demo-safe exploration is a first-class path. The product should be understandable before you trust it.
                </p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4">
                <div className="section-title text-white/50">Persistent mode</div>
                <p className="mt-2 text-sm leading-6 text-white/78">
                  When you connect identity, the app should explain what is being stored, why, and what still stays out.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="surface-card p-6">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-teal" />
              <div className="section-title">What stays local in demo mode</div>
            </div>
            <div className="mt-5 space-y-3">
              {demoStorage.map((item) => (
                <div key={item} className="rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-[rgba(255,255,255,0.74)] px-4 py-3 text-sm leading-6 text-secondary">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card p-6">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-teal" />
              <div className="section-title">What changes if you connect a wallet</div>
            </div>
            <div className="mt-5 space-y-3">
              {walletStorage.map((item) => (
                <div key={item} className="rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-[rgba(255,255,255,0.74)] px-4 py-3 text-sm leading-6 text-secondary">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 surface-card p-6">
          <div className="flex items-center gap-2">
            <EyeOff size={16} className="text-soft-red" />
            <div className="section-title">What we do not do</div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {neverDo.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-[20px] border border-soft-red/12 bg-soft-red/5 px-4 py-4"
              >
                <XCircle size={15} className="mt-0.5 shrink-0 text-soft-red" />
                <p className="text-sm leading-6 text-primary">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="surface-card p-6">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-accent" />
              <div className="section-title">How AI is routed</div>
            </div>
            <div className="mt-5 space-y-4">
              <div className="rounded-[20px] bg-[rgba(255,255,255,0.78)] px-5 py-4">
                <h3 className="text-sm font-semibold text-primary">Safety layer first, provider second</h3>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  OpenRx routes AI requests through a safety and workflow layer before they reach any model provider.
                  The exact provider behind a workflow may change over time as reliability, safety, and cost settings
                  change, so we do not treat any one model vendor as permanent product infrastructure.
                </p>
              </div>
              <div className="rounded-[20px] bg-[rgba(255,255,255,0.78)] px-5 py-4">
                <h3 className="text-sm font-semibold text-primary">Minimum context only</h3>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  We only send the prompt and the smallest amount of structured context needed for the task. We do not
                  intentionally include Social Security numbers, insurance IDs, or wallet addresses in model requests.
                </p>
              </div>
              <div className="rounded-[20px] bg-[rgba(255,255,255,0.78)] px-5 py-4">
                <h3 className="text-sm font-semibold text-primary">Retention is provider-dependent</h3>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  Where a provider offers no-training or reduced-retention controls, OpenRx is configured to prefer
                  them. Provider-side policies can still differ by workflow, so we avoid promising that every provider
                  behaves identically.
                </p>
              </div>
            </div>
          </div>

          <div className="surface-card p-6">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-teal" />
              <div className="section-title">What the assistant cannot do</div>
            </div>
            <div className="mt-5 space-y-3">
              {assistantLimits.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[18px] bg-[rgba(239,246,255,0.84)] px-4 py-3">
                  <XCircle size={14} className="mt-0.5 shrink-0 text-muted" />
                  <p className="text-sm leading-6 text-secondary">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[28px] border border-amber-300/28 bg-[linear-gradient(180deg,rgba(120,81,0,0.09),rgba(255,255,255,0.76))] p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <div className="section-title text-amber-800/80">Clinical boundary</div>
              <h2 className="mt-3 text-2xl font-serif text-primary">OpenRx is not your doctor.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
                OpenRx is a personal coordination and decision-support product. It can help you organize questions,
                surface likely next steps, and reduce friction across care workflows. It does not replace a licensed
                clinician, hospital, or health plan, and it should not be treated like a legal medical record.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-teal" />
            <div className="section-title">Your rights in the product</div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {rights.map((item) => (
              <div key={item.title} className="surface-card p-5">
                <CheckCircle2 size={16} className="text-accent" />
                <h3 className="mt-4 text-base font-semibold text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-secondary">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-12 border-t border-[rgba(82,108,139,0.12)] py-8 text-center">
          <p className="text-sm text-secondary">
            Questions about privacy or data handling?{" "}
            <a href="mailto:privacy@openrx.health" className="font-semibold text-teal hover:underline">
              privacy@openrx.health
            </a>
          </p>
          <p className="mt-2 text-xs text-muted">Last updated April 2026</p>
        </footer>
      </main>
    </div>
  )
}
