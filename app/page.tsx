import type { CSSProperties } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileText,
  GitBranch,
  HeartPulse,
  MapPinned,
  ShieldCheck,
  Stethoscope,
} from "lucide-react"

import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import { openRxCssVariableThemes, openRxDesignTokens } from "@/lib/design-tokens"

const landingStyle = {
  ...openRxCssVariableThemes.patientLight,
  fontFamily: openRxDesignTokens.typography.fontFamily.patient,
} as CSSProperties

const proofPoints = [
  { label: "Deterministic guideline engine", icon: DatabaseZap },
  { label: "USPSTF source and grade links", icon: BookOpen },
  { label: "Provider and referral gates", icon: ShieldCheck },
  { label: "PHI-minimal navigation", icon: BadgeCheck },
]

const handoffSteps = [
  {
    label: "Patient input",
    detail: "age 45 male",
    icon: HeartPulse,
  },
  {
    label: "Rules engine",
    detail: "USPSTF 2021, Grade B",
    icon: GitBranch,
  },
  {
    label: "Care navigation",
    detail: "provider, lab, trial, prior auth",
    icon: MapPinned,
  },
]

function CareInfrastructureVisual() {
  return (
    <div
      className="relative min-h-[420px] overflow-hidden rounded-[1rem] border border-[var(--orx-border)] bg-[var(--orx-background-raised)] p-4 shadow-[var(--orx-shadow-card)] sm:p-5 lg:min-h-[520px]"
      aria-label="OpenRx source-linked care navigation flow"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(10, 28, 46, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(10, 28, 46, 0.07) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      <div className="relative z-10 flex h-full flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--orx-text-muted)]">
              Auditable care layer
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--orx-text-primary)]">
              One input, deterministic plan, consented handoff
            </p>
          </div>
          <span className="rounded-full border border-[var(--orx-trust-border)] bg-[var(--orx-trust-muted)] px-3 py-1 text-xs font-bold text-[var(--orx-trust)]">
            Live rails ready
          </span>
        </div>

        <div className="grid gap-3">
          {handoffSteps.map((step, index) => {
            const Icon = step.icon

            return (
              <div
                key={step.label}
                className="relative rounded-[0.75rem] border border-[var(--orx-border)] bg-[rgba(255,255,255,0.82)] p-4 shadow-[0_1px_2px_rgba(6,17,29,0.04)] backdrop-blur"
              >
                {index < handoffSteps.length - 1 ? (
                  <div
                    aria-hidden
                    className="absolute left-8 top-full h-3 w-px bg-[var(--orx-border-strong)]"
                  />
                ) : null}
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.5rem] bg-[var(--orx-surface-accent)] text-[var(--orx-action)]">
                    <Icon size={18} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--orx-text-primary)]">{step.label}</p>
                    <p className="mt-1 text-sm text-[var(--orx-text-secondary)]">{step.detail}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded-[0.75rem] border border-[var(--orx-border-strong)] bg-[var(--orx-surface)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--orx-surface-accent)] px-2.5 py-1 text-xs font-bold text-[var(--orx-action)]">
              Colorectal screening
            </span>
            <span className="rounded-full bg-[var(--orx-trust-muted)] px-2.5 py-1 text-xs font-bold text-[var(--orx-trust)]">
              Due
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--orx-text-secondary)]">
            For average-risk adults, colorectal cancer screening begins at age 45.
          </p>
          <a
            href="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--orx-action)] underline-offset-4 hover:underline"
          >
            USPSTF 2021, Grade B
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div style={landingStyle} className="min-h-screen bg-[var(--orx-background)] text-[var(--orx-text-primary)]">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--orx-border)] bg-[rgba(247,248,244,0.86)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="OpenRx home">
            <BrandMark tone="light" />
            <BrandWordmark
              subtitle
              titleAs="span"
              titleClassName="text-[var(--orx-text-primary)]"
              subtitleClassName="text-[var(--orx-text-muted)]"
            />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-[var(--orx-text-secondary)] md:flex" aria-label="Main">
            <Link href="/demo" className="transition hover:text-[var(--orx-action)]">
              API/docs
            </Link>
            <Link href="/trust" className="transition hover:text-[var(--orx-action)]">
              Trust
            </Link>
            <Link href="/providers" className="transition hover:text-[var(--orx-action)]">
              Providers
            </Link>
          </nav>

          <Link
            href="/screening"
            className="inline-flex min-h-11 items-center justify-center rounded-[0.5rem] bg-[var(--orx-action)] px-4 text-sm font-bold text-[var(--orx-action-text)] shadow-[var(--orx-shadow-card)] transition hover:bg-[var(--orx-action-hover)] focus-visible:shadow-[var(--orx-shadow-focus)]"
          >
            Check screening
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(115deg, rgba(238,246,255,0.96) 0%, rgba(247,248,244,0.94) 42%, rgba(224,240,236,0.72) 100%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(rgba(10, 28, 46, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(10, 28, 46, 0.05) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "linear-gradient(to bottom, black 0%, black 72%, transparent 100%)",
            }}
          />

          <div className="relative mx-auto grid min-h-[86svh] w-full max-w-7xl gap-10 px-4 pb-12 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,0.78fr)] lg:items-center lg:px-8 lg:pb-16">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-[var(--orx-border)] bg-[rgba(255,255,255,0.74)] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--orx-text-secondary)]">
                <ShieldCheck size={14} />
                Guideline-grounded care navigation + prior-auth automation
              </p>

              <h1 className="mt-6 font-serif text-[clamp(4rem,16vw,8.5rem)] font-semibold leading-[0.86] tracking-[-0.04em] text-[var(--orx-text-primary)]">
                OpenRx
              </h1>

              <p className="mt-6 max-w-2xl text-[clamp(1.35rem,4vw,2rem)] font-semibold leading-tight text-[var(--orx-text-primary)]">
                Prior-auth infrastructure and cancer screening navigation in one auditable care layer.
              </p>

              <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--orx-text-secondary)] sm:text-lg">
                Patients get a plain-language path from profile to screening, providers, labs, imaging, and trials.
                Developers get deterministic recommendations, source links, audit logs, and MCP-ready workflow rails.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/demo"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.5rem] bg-[var(--orx-action)] px-5 text-sm font-bold text-[var(--orx-action-text)] shadow-[var(--orx-shadow-card)] transition hover:bg-[var(--orx-action-hover)] focus-visible:shadow-[var(--orx-shadow-focus)]"
                >
                  View API/docs
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/screening"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.5rem] border border-[var(--orx-border-strong)] bg-[var(--orx-surface)] px-5 text-sm font-bold text-[var(--orx-text-primary)] shadow-[var(--orx-shadow-card)] transition hover:border-[var(--orx-action)] focus-visible:shadow-[var(--orx-shadow-focus)]"
                >
                  Check my screening
                  <HeartPulse size={16} />
                </Link>
              </div>

              <div className="mt-8 hidden max-w-2xl gap-3 sm:grid sm:grid-cols-3">
                {[
                  ["LLM boundary", "Models parse and explain. Rules decide."],
                  ["Clinical provenance", "Every recommendation shows source, grade, and version."],
                  ["Navigation handoff", "Consent before referral. Minimum necessary fields only."],
                ].map(([label, detail]) => (
                  <div key={label} className="rounded-[0.5rem] border border-[var(--orx-border)] bg-[rgba(255,255,255,0.62)] p-3">
                    <p className="text-xs font-bold text-[var(--orx-text-primary)]">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--orx-text-muted)]">{detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <CareInfrastructureVisual />
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--orx-border)] bg-[var(--orx-background-raised)]">
          <div className="mx-auto grid w-full max-w-7xl gap-3 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {proofPoints.map((item) => {
              const Icon = item.icon

              return (
                <div key={item.label} className="flex items-center gap-3 text-sm font-semibold text-[var(--orx-text-secondary)]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.5rem] bg-[var(--orx-surface-muted)] text-[var(--orx-trust)]">
                    <Icon size={17} strokeWidth={1.8} />
                  </span>
                  {item.label}
                </div>
              )
            })}
          </div>
        </section>

        <section className="bg-[var(--orx-background)]">
          <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1fr] lg:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--orx-text-muted)]">
                Safety boundary
              </p>
              <h2 className="mt-3 max-w-xl font-serif text-3xl font-semibold leading-tight text-[var(--orx-text-primary)]">
                Useful without pretending to be the clinician.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: ClipboardCheck,
                  title: "Screening plans are deterministic",
                  body: "Guideline data produces the recommendation. The model never invents clinical guidance.",
                },
                {
                  icon: Stethoscope,
                  title: "Clinical decisions stay human",
                  body: "OpenRx educates, navigates, and prepares handoffs. It does not diagnose or place orders.",
                },
                {
                  icon: FileText,
                  title: "Referral data is consented",
                  body: "Disclosure scopes are fixed by recommendation type and shown before consent.",
                },
                {
                  icon: CheckCircle2,
                  title: "Built for audit trails",
                  body: "Recommendations, versions, consent, BAA gates, and handoff state transitions are logged.",
                },
              ].map((item) => {
                const Icon = item.icon

                return (
                  <article key={item.title} className="rounded-[0.5rem] border border-[var(--orx-border)] bg-[var(--orx-surface)] p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[0.5rem] bg-[var(--orx-surface-accent)] text-[var(--orx-action)]">
                        <Icon size={17} />
                      </span>
                      <h3 className="text-sm font-bold text-[var(--orx-text-primary)]">{item.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--orx-text-secondary)]">{item.body}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
