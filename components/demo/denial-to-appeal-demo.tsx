"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  LockKeyhole,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import {
  DEMO_SCENARIOS,
  type DemoAction,
  type DemoScenario,
  type DemoScenarioId,
  type DemoSource,
} from "@/lib/demo/prior-auth"
import { trackWorkflowEvent } from "@/lib/product-analytics"
import { cn } from "@/lib/utils"

type EvidenceResult = {
  sources: DemoSource[]
  boundary: string
  retrievedAt: string
}

type AppealResult = {
  subject: string
  paragraphs: string[]
  documentChecklist: string[]
  citations: DemoSource[]
  reviewRequired: string
}

type SubmissionResult = {
  trackingNumber: string
  status: string
  liveSubmission: false
  notice: string
  mcpCall: {
    tool: string
    adapterStatus: string
    transport: string
    endpoint: string
    payload: Record<string, string>
  }
}

type DemoResponse = EvidenceResult | AppealResult | SubmissionResult

const STEPS = [
  { label: "Ask", description: "Select a denied synthetic case." },
  { label: "Cite", description: "Retrieve versioned evidence." },
  { label: "Draft", description: "Prepare an appeal for review." },
  { label: "Submit", description: "View a simulated FHIR trace." },
]

async function executeAction<T extends DemoResponse>(scenarioId: DemoScenarioId, action: DemoAction): Promise<T> {
  const response = await fetch("/api/demo/prior-auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId, action }),
  })
  const body = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(body.error || "The sandbox could not complete this step.")
  return body
}

function SourceBadge({ source }: { source: DemoSource }) {
  const statusLabel = source.status === "public_source"
    ? "Public source"
    : source.status === "regulatory_context"
      ? "Regulatory context"
      : "Licensed verification required"
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-2 py-1 font-medium text-cyan-100">
          {source.organization}
        </span>
        <span className="text-zinc-400">{source.version}</span>
        <span className="text-zinc-600">|</span>
        <span className="text-zinc-300">{statusLabel}</span>
      </div>
      <a
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-200 hover:text-cyan-100"
        href={source.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackWorkflowEvent("demo_source_opened", { surface: "demo", scenario: source.id })}
      >
        {source.label}
        <ExternalLink size={13} />
      </a>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{source.relevance}</p>
    </div>
  )
}

function ScenarioCard({
  scenario,
  selected,
  onSelect,
}: {
  scenario: DemoScenario
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      data-testid={`demo-scenario-${scenario.id}`}
      onClick={onSelect}
      className={cn(
        "group w-full rounded-2xl border p-4 text-left transition",
        selected
          ? "border-cyan-300/45 bg-cyan-300/[0.07]"
          : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.045]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">{scenario.specialty}</p>
          <p className="mt-2 text-sm font-medium leading-6 text-white">{scenario.title}</p>
        </div>
        <ChevronRight size={16} className={cn("mt-1 shrink-0 text-zinc-600 transition", selected && "text-cyan-200")} />
      </div>
    </button>
  )
}

export function DenialToAppealDemo() {
  const [selectedId, setSelectedId] = useState<DemoScenarioId | null>(null)
  const [evidence, setEvidence] = useState<EvidenceResult | null>(null)
  const [appeal, setAppeal] = useState<AppealResult | null>(null)
  const [submission, setSubmission] = useState<SubmissionResult | null>(null)
  const [loading, setLoading] = useState<DemoAction | null>(null)
  const [error, setError] = useState("")
  const scenario = DEMO_SCENARIOS.find((entry) => entry.id === selectedId) ?? null

  useEffect(() => {
    trackWorkflowEvent("demo_viewed", { surface: "demo" })
  }, [])

  function chooseScenario(next: DemoScenarioId) {
    setSelectedId(next)
    setEvidence(null)
    setAppeal(null)
    setSubmission(null)
    setError("")
    trackWorkflowEvent("demo_scenario_selected", { surface: "demo", scenario: next })
  }

  async function runAction(action: DemoAction) {
    if (!scenario) return
    setLoading(action)
    setError("")
    try {
      if (action === "retrieve_evidence") {
        const result = await executeAction<EvidenceResult>(scenario.id, action)
        setEvidence(result)
        trackWorkflowEvent("demo_evidence_retrieved", { surface: "demo", scenario: scenario.id, stage: "evidence" })
      } else if (action === "draft_appeal") {
        const result = await executeAction<AppealResult>(scenario.id, action)
        setAppeal(result)
        trackWorkflowEvent("demo_appeal_generated", { surface: "demo", scenario: scenario.id, stage: "appeal" })
      } else {
        trackWorkflowEvent("demo_fhir_stub_opened", { surface: "demo", scenario: scenario.id, adapter: "simulated" })
        const result = await executeAction<SubmissionResult>(scenario.id, action)
        setSubmission(result)
        trackWorkflowEvent("demo_fhir_stub_completed", { surface: "demo", scenario: scenario.id, adapter: "simulated" })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The sandbox could not complete this step.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <header className="border-b border-white/[0.08] bg-[#050505]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link href="/chat" className="flex items-center gap-3" aria-label="OpenRx chat">
            <BrandMark size="sm" tone="dark" />
            <BrandWordmark tone="dark" subtitle={false} />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-400" aria-label="Demo navigation">
            <Link href="/trust" className="hidden hover:text-white sm:block">Trust</Link>
            <Link href="/chat" className="rounded-full border border-white/12 px-4 py-2 font-medium text-white transition hover:border-white/25">
              Open clinical chat
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-5 pb-14 pt-10 sm:px-8 sm:pt-16">
        <section className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div className="lg:sticky lg:top-10">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">Prior authorization sandbox</p>
            <h1 className="orx-display-heading mt-5 text-[clamp(2.35rem,4.5vw,3.7rem)] text-white">
              From clinical answer to submission-ready appeal, in one chat.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-zinc-400">
              Choose a synthetic denial. OpenRx assembles cited evidence, drafts an appeal, and shows the FHIR submission handoff without transmitting patient data.
            </p>
            <div className="mt-7 flex flex-wrap gap-2 text-xs text-zinc-300">
              {["Synthetic cases only", "Clinician review required", "No live payer transmission"].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-10 grid gap-3">
              {DEMO_SCENARIOS.map((entry) => (
                <ScenarioCard
                  key={entry.id}
                  scenario={entry}
                  selected={entry.id === selectedId}
                  onSelect={() => chooseScenario(entry.id)}
                />
              ))}
            </div>
            <Link href="/trust" className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
              Review privacy and evidence posture <ArrowRight size={14} />
            </Link>
          </div>

          <section
            aria-label="Denial to appeal conversation"
            className="overflow-hidden rounded-[28px] border border-white/10 bg-[#09090b] shadow-[0_24px_90px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-7">
              <div>
                <p className="text-sm font-medium text-zinc-100">Denial-to-appeal workspace</p>
                <p className="mt-0.5 text-xs text-zinc-500">FHIR PA handoff demo</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                sandbox
              </div>
            </div>

            <div className="grid grid-cols-4 border-b border-white/[0.07]">
              {STEPS.map((step, index) => (
                <div key={step.label} className="border-r border-white/[0.06] px-3 py-3 last:border-r-0 sm:px-5">
                  <p className="text-[11px] font-semibold text-cyan-200">{String(index + 1).padStart(2, "0")} {step.label}</p>
                  <p className="mt-1 hidden text-xs leading-5 text-zinc-500 sm:block">{step.description}</p>
                </div>
              ))}
            </div>

            {!scenario ? (
              <div className="flex min-h-[570px] flex-col items-center justify-center px-8 text-center">
                <MessageSquareText size={30} className="text-zinc-600" />
                <h2 className="mt-5 text-xl font-medium text-white">Pick a denial scenario</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">
                  The conversation will arrive preloaded with a synthetic clinical summary and denial reason.
                </p>
              </div>
            ) : (
              <div className="space-y-6 p-5 sm:p-7">
                <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-white/[0.09] px-5 py-4">
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-400">Denial received</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-100">{scenario.denialReason}</p>
                  <p className="mt-3 text-sm font-medium text-white">{scenario.request}</p>
                </div>

                <div className="max-w-[96%] rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.025] p-5">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-cyan-200">
                    <Sparkles size={13} /> Patient summary
                  </div>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                    {scenario.patientSummary.map((item) => (
                      <li key={item} className="flex gap-2"><span className="text-cyan-300">+</span>{item}</li>
                    ))}
                  </ul>
                  {!evidence ? (
                    <button
                      type="button"
                      data-testid="demo-retrieve-evidence"
                      disabled={loading !== null}
                      onClick={() => void runAction("retrieve_evidence")}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60"
                    >
                      <FileText size={15} />
                      {loading === "retrieve_evidence" ? "Retrieving evidence..." : "Retrieve evidence"}
                    </button>
                  ) : null}
                </div>

                {error ? (
                  <div data-testid="demo-error" className="rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100">
                    {error}
                  </div>
                ) : null}

                {evidence ? (
                  <div data-testid="demo-evidence" className="max-w-[96%] rounded-2xl rounded-bl-md border border-cyan-300/15 bg-cyan-300/[0.025] p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <ShieldCheck size={16} className="text-cyan-200" /> Evidence retrieved
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">{evidence.boundary}</p>
                    <div className="mt-4 space-y-3">
                      {evidence.sources.map((source) => <SourceBadge key={source.id} source={source} />)}
                    </div>
                    {!appeal ? (
                      <button
                        type="button"
                        data-testid="demo-generate-appeal"
                        disabled={loading !== null}
                        onClick={() => void runAction("draft_appeal")}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-200 px-4 py-2.5 text-sm font-medium text-[#041014] transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
                      >
                        <FileText size={15} />
                        {loading === "draft_appeal" ? "Drafting appeal..." : "Generate appeal letter"}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {appeal ? (
                  <div data-testid="demo-appeal" className="max-w-[96%] rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.025] p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.15em] text-cyan-200">Appeal draft</p>
                    <h2 className="mt-3 text-base font-medium leading-6 text-white">{appeal.subject}</h2>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
                      {appeal.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                    </div>
                    <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#050505] p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Required packet items</p>
                      <ul className="mt-3 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
                        {appeal.documentChecklist.map((item) => (
                          <li key={item} className="flex items-start gap-2"><CheckCircle2 size={14} className="mt-1 shrink-0 text-cyan-200" />{item}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-amber-200">{appeal.reviewRequired}</p>
                    {!submission ? (
                      <button
                        type="button"
                        data-testid="demo-submit-fhir"
                        disabled={loading !== null}
                        onClick={() => void runAction("submit_fhir")}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60"
                      >
                        <Send size={15} />
                        {loading === "submit_fhir" ? "Opening sandbox trace..." : "Submit via FHIR PA"}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {submission ? (
                  <div data-testid="demo-submission-success" className="max-w-[96%] rounded-2xl rounded-bl-md border border-emerald-300/20 bg-emerald-300/[0.045] p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-200">
                      <CheckCircle2 size={17} /> Sandbox handoff accepted
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-200">{submission.notice}</p>
                    <div className="mt-4 flex flex-wrap gap-4 text-xs">
                      <div>
                        <p className="text-zinc-500">Tracking number</p>
                        <p className="mt-1 font-mono text-zinc-100">{submission.trackingNumber}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Transmission</p>
                        <p className="mt-1 text-emerald-200">Simulated only</p>
                      </div>
                    </div>
                    <pre className="mt-5 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#050505] p-4 text-xs leading-6 text-zinc-300">
                      {JSON.stringify(submission.mcpCall, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </section>

        <section className="mt-16 grid gap-4 border-t border-white/[0.08] pt-7 text-sm text-zinc-400 sm:grid-cols-3">
          <div className="flex gap-3">
            <LockKeyhole size={17} className="shrink-0 text-zinc-300" />
            <p>No PHI, account, or wallet is required in the sandbox.</p>
          </div>
          <div className="flex gap-3">
            <ShieldCheck size={17} className="shrink-0 text-zinc-300" />
            <p>Sources are linked and licensed-content boundaries are visible.</p>
          </div>
          <div className="flex gap-3">
            <FileText size={17} className="shrink-0 text-zinc-300" />
            <p>The draft supports review. It is not an approval guarantee.</p>
          </div>
        </section>
      </main>
    </div>
  )
}
