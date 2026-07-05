import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  FlaskConical,
  HeartPulse,
  Pill,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react"

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

const connectedActions = [
  {
    label: "Screening",
    href: "/screening",
    description: "Get a sourced plan",
    icon: HeartPulse,
  },
  {
    label: "Find care",
    href: "/providers",
    description: "Doctors, labs, imaging",
    icon: Stethoscope,
  },
  {
    label: "Trials",
    href: "/clinical-trials",
    description: "Surface candidates",
    icon: FlaskConical,
  },
  {
    label: "Pharmacy",
    href: "/pharmacy",
    description: "Medication access",
    icon: Pill,
  },
  {
    label: "Prior auth",
    href: "/prior-auth",
    description: "Prepare the packet",
    icon: ShieldCheck,
  },
  {
    label: "Join network",
    href: "/join-network",
    description: "Providers participate",
    icon: Building2,
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

            <nav aria-label="Connected care actions" className="mt-8 grid max-w-3xl gap-1.5 sm:grid-cols-2">
              {connectedActions.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex min-h-12 items-center justify-between gap-3 rounded-full border border-white/[0.08] bg-black/25 px-3 py-2.5 transition hover:border-cyan-200/25 hover:bg-white/[0.045]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon size={16} className="shrink-0 text-zinc-300 transition group-hover:text-cyan-100" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-5 text-white">{item.label}</span>
                        <span className="block truncate text-[11px] leading-4 text-zinc-500">{item.description}</span>
                      </span>
                    </span>
                    <ArrowRight size={13} className="shrink-0 text-zinc-600 transition group-hover:text-cyan-100" />
                  </Link>
                )
              })}
            </nav>

            <div className="mt-8 flex max-w-3xl flex-col gap-3 border-t border-white/10 pt-5 text-xs leading-6 text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
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

            <p className="mt-4 max-w-3xl text-xs leading-6 text-zinc-600">
              OpenRx does not claim HIPAA compliance or SOC 2 certification today. Public screening is stateless by
              default; PHI persistence and model access remain gated deployment decisions.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
