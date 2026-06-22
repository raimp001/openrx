import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Bot,
  CheckCircle2,
  DatabaseZap,
  FileText,
  HeartPulse,
  MapPinned,
  ShieldCheck,
  Stethoscope,
} from "lucide-react"

import { BrandMark } from "@/components/brand-logo"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
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

const proofPoints = [
  { label: "Deterministic rules", icon: DatabaseZap },
  { label: "Source + grade links", icon: BookOpen },
  { label: "Consent before referral", icon: ShieldCheck },
  { label: "Audit-ready handoffs", icon: BadgeCheck },
]

const actionCards = [
  {
    title: "For patients",
    body: "Ask what screening is due, then move to providers, labs, imaging, trials, or a clinician message.",
    href: "/screening",
    label: "Check my screening",
    icon: HeartPulse,
  },
  {
    title: "For clinicians",
    body: "Prepare sourced summaries, referral context, and next-step messages without letting the model invent care.",
    href: "/chat",
    label: "Ask OpenRx",
    icon: Bot,
  },
  {
    title: "For builders",
    body: "Use deterministic recommendations, audit logs, and MCP-ready workflow rails for prior authorization.",
    href: "/demo",
    label: "View API/docs",
    icon: DatabaseZap,
  },
]

function SourcedPreview() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#090d0d]/95 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.38)] sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[12px] font-medium text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
          Live care plan preview
        </span>
        <span className="rounded-full border border-cyan-200/18 bg-cyan-200/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-normal text-cyan-100">
          sourced
        </span>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/10 bg-[#050707] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-normal text-zinc-400">
          Plain-English input
        </p>
        <p className="mt-3 text-base leading-7 text-zinc-100">
          45 male, no symptoms, what cancer screening is due?
        </p>
      </div>

      <div className="mt-3 rounded-[24px] border border-cyan-200/14 bg-cyan-200/[0.055] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-normal text-cyan-100">
              Recommendation
            </p>
            <h2 className="mt-2 text-xl font-semibold leading-tight text-white">
              Colorectal cancer screening
            </h2>
          </div>
          <span className="rounded-full bg-cyan-200 px-2.5 py-1 text-[10px] font-bold uppercase text-black">
            Due
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          For average-risk adults, colorectal cancer screening begins at age 45. OpenRx shows the source,
          grade, and version before any action.
        </p>
        <a
          href="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/40"
        >
          USPSTF 2021 · Grade B
          <ArrowRight size={13} />
        </a>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          { label: "Find care", icon: Stethoscope },
          { label: "Find labs", icon: MapPinned },
          { label: "Draft message", icon: FileText },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-[18px] border border-white/10 bg-white/[0.045] p-3">
              <Icon size={15} className="text-cyan-100" />
              <p className="mt-2 text-xs font-semibold text-zinc-100">{item.label}</p>
            </div>
          )
        })}
      </div>
    </div>
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

      <header className="relative z-20">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="OpenRx home">
            <BrandMark size="sm" />
            <span className="text-sm font-semibold text-white">OpenRx</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-zinc-300 md:flex" aria-label="Main">
            <Link href="/screening" className="transition hover:text-white">
              Screening
            </Link>
            <Link href="/chat" className="transition hover:text-white">
              Chat
            </Link>
            <Link href="/demo" className="transition hover:text-white">
              API/docs
            </Link>
          </nav>
          <Link
            href="/chat"
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-cyan-200 px-4 text-sm font-semibold text-black transition hover:bg-cyan-100"
          >
            Ask
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(103,232,249,0.16),transparent_34%),radial-gradient(circle_at_90%_18%,rgba(52,211,153,0.08),transparent_30%)]" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "linear-gradient(to bottom, black 0%, black 68%, transparent 100%)",
            }}
          />

          <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-7xl gap-8 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.78fr)] lg:items-center lg:px-8">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[12px] font-medium text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
                OpenRx
              </span>
              <h1 className="orx-display-heading mt-6 max-w-4xl text-[clamp(3.1rem,12vw,7.5rem)] text-white">
                Ask once. Get the next useful action.
              </h1>
              <p className="mt-6 max-w-2xl text-[17px] leading-8 text-zinc-300 sm:text-xl">
                Source-linked screening navigation, provider matching, labs, imaging, trials, and prior-auth
                workflow rails in one auditable care layer.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/screening"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-200 px-5 text-sm font-bold text-black transition hover:bg-cyan-100"
                >
                  Check my screening
                  <HeartPulse size={16} />
                </Link>
                <Link
                  href="/chat"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-5 text-sm font-bold text-white transition hover:border-cyan-200/30 hover:bg-white/[0.09]"
                >
                  Ask OpenRx
                  <Bot size={16} />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 text-sm font-bold text-zinc-200 transition hover:border-white/22 hover:bg-white/[0.08]"
                >
                  API/docs
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {proofPoints.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="rounded-[18px] border border-white/10 bg-white/[0.045] p-3">
                      <Icon size={16} className="text-cyan-100" />
                      <p className="mt-2 text-xs font-semibold text-zinc-200">{item.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <SourcedPreview />
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.025]">
          <div className="mx-auto grid w-full max-w-7xl gap-3 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
            {actionCards.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-[24px] border border-white/10 bg-[#090d0d]/86 p-5 transition hover:border-cyan-200/25 hover:bg-white/[0.055]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-200/[0.12] text-cyan-100">
                      <Icon size={18} />
                    </span>
                    <ArrowRight size={16} className="text-zinc-500 transition group-hover:text-cyan-100" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p>
                  <p className="mt-4 text-sm font-semibold text-cyan-100">{item.label}</p>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            ["LLM boundary", "The model parses and explains. Deterministic rules decide."],
            ["Clinical provenance", "Every clinical recommendation has source, grade, and version."],
            ["Consent gate", "Referral PHI is shared only after exact-scope consent."],
            ["Human decision", "OpenRx educates and navigates. Clinicians confirm care."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-[20px] border border-white/10 bg-white/[0.035] p-4">
              <CheckCircle2 size={16} className="text-cyan-100" />
              <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
