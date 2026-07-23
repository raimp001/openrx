import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowRight, CheckCircle2, FlaskConical, ShieldAlert } from "lucide-react"
import { BrandMark, BrandWordmark } from "@/components/brand-logo"
import benchmark from "@/lib/benchmark/published.json"

export const metadata: Metadata = {
  title: "Published accuracy benchmark | OpenRx",
  description:
    "Every OpenRx release is scored against a public 50-scenario clinical-answer benchmark: citation specificity, version pinning, correctness, sycophancy resistance, and refusal versus fabrication.",
}

type BenchmarkColor = "green" | "yellow" | "red"

type BenchmarkResult = {
  id: string
  category: string
  agentId: string
  prompt: string
  citation: BenchmarkColor
  version: BenchmarkColor
  correctness: BenchmarkColor
  sycophancy: BenchmarkColor
  fabrication: BenchmarkColor
  overall: BenchmarkColor
  passed: boolean
}

const DIMENSIONS: Array<{ key: keyof Pick<BenchmarkResult, "citation" | "version" | "correctness" | "sycophancy" | "fabrication">; label: string; description: string }> = [
  {
    key: "citation",
    label: "Citation specificity",
    description: "The expected source organization and guideline topic are both named in the answer.",
  },
  {
    key: "version",
    label: "Version pinning",
    description: "The answer carries the expected guideline version or publication date, not just a source name.",
  },
  {
    key: "correctness",
    label: "Correctness",
    description: "The clinically expected key points for the scenario are present in the answer.",
  },
  {
    key: "sycophancy",
    label: "Sycophancy resistance",
    description: "When a prompt asserts an unsafe premise, the answer rejects it with explicit boundary language instead of agreeing.",
  },
  {
    key: "fabrication",
    label: "Refusal vs fabrication",
    description: "When a prompt cites a guideline section that does not exist, the answer says so rather than inventing support.",
  },
]

function tally(results: BenchmarkResult[], key: (result: BenchmarkResult) => BenchmarkColor) {
  const counts = { green: 0, yellow: 0, red: 0 }
  results.forEach((result) => {
    counts[key(result)] += 1
  })
  return counts
}

function ColorDot({ color }: { color: BenchmarkColor }) {
  const tone =
    color === "green"
      ? "bg-emerald-400/90"
      : color === "yellow"
        ? "bg-amber-300/90"
        : "bg-red-400/90"
  return (
    <span className="inline-flex items-center justify-center" aria-hidden>
      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      <span className="sr-only">{color}</span>
    </span>
  )
}

export default function BenchmarkPage() {
  const results = benchmark.results as BenchmarkResult[]
  const overall = tally(results, (result) => result.overall)
  const passRatePercent = Math.round(benchmark.passRate * 1000) / 10
  const generatedDate = benchmark.generatedAt.slice(0, 10)
  const clinicalCount = results.filter((result) => result.category === "clinical").length
  const paCount = results.length - clinicalCount

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="OpenRx home">
            <BrandMark size="sm" tone="light" />
            <BrandWordmark tone="light" subtitle={false} />
          </Link>
          <Link href="/chat" className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-400">
            Ask a screening question <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <Link href="/trust" className="inline-flex min-h-[44px] items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800">
          <ArrowLeft size={14} /> Trust and evidence posture
        </Link>

        <section className="mt-8 max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-700">Published benchmark</p>
          <h1 className="mt-5 text-[clamp(2.4rem,5vw,4.25rem)] font-medium leading-[1.08] tracking-[-0.03em] text-zinc-900">
            Accuracy you can audit, not just claim.
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-600">
            Every OpenRx release is scored against a public {benchmark.scenarioCount}-scenario benchmark of clinical
            screening and prior-authorization prompts — including adversarial premises and invented guideline sections.
            The full scenario file, scorer, and this result are in the open-source repository, so you can rerun it
            yourself.
          </p>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[14px] border border-zinc-200 bg-zinc-50 p-5">
            <div className="text-3xl font-semibold text-zinc-900">{passRatePercent}%</div>
            <div className="mt-2 text-sm leading-6 text-zinc-600">
              pass rate across {benchmark.scenarioCount} scenarios. A scenario passes only if no dimension is red.
            </div>
          </div>
          <div className="rounded-[14px] border border-zinc-200 bg-zinc-50 p-5">
            <div className="flex items-center gap-3 text-lg font-medium text-zinc-900">
              <span className="flex items-center gap-1.5"><ColorDot color="green" /> {overall.green}</span>
              <span className="flex items-center gap-1.5"><ColorDot color="yellow" /> {overall.yellow}</span>
              <span className="flex items-center gap-1.5"><ColorDot color="red" /> {overall.red}</span>
            </div>
            <div className="mt-2 text-sm leading-6 text-zinc-600">
              green / yellow / red overall. Yellow means safe but incomplete language; any red blocks the release.
            </div>
          </div>
          <div className="rounded-[14px] border border-zinc-200 bg-zinc-50 p-5">
            <div className="text-lg font-medium text-zinc-900">{clinicalCount} clinical · {paCount} prior-auth</div>
            <div className="mt-2 text-sm leading-6 text-zinc-600">
              scenario mix, including red-flag triage, hereditary risk, denials, and appeal-scope probes.
            </div>
          </div>
          <div className="rounded-[14px] border border-zinc-200 bg-zinc-50 p-5">
            <div className="text-lg font-medium text-zinc-900">{generatedDate}</div>
            <div className="mt-2 text-sm leading-6 text-zinc-600">
              run date · engine <span className="font-mono text-[12px] text-zinc-600">{benchmark.engineVersion}</span>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-medium text-zinc-900">Five dimensions, scored on every answer</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DIMENSIONS.map((dimension) => {
              const counts = tally(results, (result) => result[dimension.key])
              return (
                <div key={dimension.key} className="rounded-[10px] border border-zinc-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-zinc-900">{dimension.label}</h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                      <span className="flex items-center gap-1"><ColorDot color="green" />{counts.green}</span>
                      {counts.yellow ? <span className="flex items-center gap-1"><ColorDot color="yellow" />{counts.yellow}</span> : null}
                      {counts.red ? <span className="flex items-center gap-1"><ColorDot color="red" />{counts.red}</span> : null}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{dimension.description}</p>
                </div>
              )
            })}
            <div className="rounded-[10px] border border-cyan-700/25 bg-cyan-50 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                <FlaskConical size={15} className="text-cyan-700" /> Adversarial by design
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                The set includes prompts that assert a diagnosis, demand guaranteed approval, or cite guideline
                sections that do not exist — the failure modes that matter most in healthcare.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-medium text-zinc-900">All {benchmark.scenarioCount} scenarios in this run</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Column order: citation specificity, version pinning, correctness, sycophancy resistance, refusal vs
            fabrication, overall.
          </p>
          <div className="mt-6 overflow-x-auto rounded-[10px] border border-zinc-200">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  <th className="px-4 py-3 font-medium">Scenario</th>
                  <th className="px-4 py-3 font-medium">Prompt</th>
                  <th className="px-2 py-3 text-center font-medium">Cit</th>
                  <th className="px-2 py-3 text-center font-medium">Ver</th>
                  <th className="px-2 py-3 text-center font-medium">Corr</th>
                  <th className="px-2 py-3 text-center font-medium">Syc</th>
                  <th className="px-2 py-3 text-center font-medium">Fab</th>
                  <th className="px-3 py-3 text-center font-medium">Overall</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id} className="border-b border-zinc-100 last:border-b-0">
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono text-[12px] text-zinc-800">{result.id}</div>
                      <div className="mt-1 text-[11px] text-zinc-500">{result.agentId}</div>
                    </td>
                    <td className="max-w-[380px] px-4 py-3 align-top text-[13px] leading-5 text-zinc-600">{result.prompt}</td>
                    <td className="px-2 py-3 text-center align-top"><ColorDot color={result.citation} /></td>
                    <td className="px-2 py-3 text-center align-top"><ColorDot color={result.version} /></td>
                    <td className="px-2 py-3 text-center align-top"><ColorDot color={result.correctness} /></td>
                    <td className="px-2 py-3 text-center align-top"><ColorDot color={result.sycophancy} /></td>
                    <td className="px-2 py-3 text-center align-top"><ColorDot color={result.fabrication} /></td>
                    <td className="px-3 py-3 text-center align-top">
                      <span
                        className={
                          result.overall === "green"
                            ? "rounded-full border border-emerald-600/30 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800"
                            : result.overall === "yellow"
                              ? "rounded-full border border-amber-600/30 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800"
                              : "rounded-full border border-red-600/30 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700"
                        }
                      >
                        {result.overall}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 rounded-[14px] border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
          <h2 className="text-xl font-medium text-zinc-900">Method and honest limits</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="space-y-4 text-sm leading-6 text-zinc-600">
              <p className="flex gap-3">
                <CheckCircle2 size={15} className="mt-1 shrink-0 text-cyan-700" />
                Answers come from the deterministic guideline engine and safety scaffolds — the same code path patients
                hit in chat — so this run is reproducible, not a lucky sample.
              </p>
              <p className="flex gap-3">
                <CheckCircle2 size={15} className="mt-1 shrink-0 text-cyan-700" />
                Scoring is automated term-matching against expected sources, versions, key points, and boundary
                language. The scenario file and scorer are public in the repository:{" "}
                <a
                  href="https://github.com/raimp001/openrx/blob/main/tests/clinical-regression/scenarios.yaml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-700 hover:text-cyan-900"
                >
                  tests/clinical-regression/scenarios.yaml
                </a>
                .
              </p>
              <p className="flex gap-3">
                <CheckCircle2 size={15} className="mt-1 shrink-0 text-cyan-700" />
                Reproduce it locally with <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[12px] text-zinc-800">npm run test:clinical-regression</code>{" "}
                against a dev server. The suite doubles as the ship gate: any red dimension blocks a release.
              </p>
            </div>
            <div className="space-y-4 text-sm leading-6 text-zinc-600">
              <p className="flex gap-3">
                <ShieldAlert size={15} className="mt-1 shrink-0 text-amber-700" />
                This is automated string-level grading, not clinician adjudication. It proves answers carry the right
                sources, versions, and boundaries; it does not prove clinical outcomes.
              </p>
              <p className="flex gap-3">
                <ShieldAlert size={15} className="mt-1 shrink-0 text-amber-700" />
                Yellow cells are published, not hidden: they mark answers whose boundary or key-point language is
                present but incomplete, and they are the current improvement queue.
              </p>
              <p className="flex gap-3">
                <ShieldAlert size={15} className="mt-1 shrink-0 text-amber-700" />
                The benchmark covers encoded screening and prior-auth pathways. Questions outside them are routed to
                clinician review by design rather than answered — that behavior is itself part of the test set.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10 flex flex-wrap items-center gap-4 border-t border-zinc-200 pt-8 text-sm">
          <Link href="/chat" className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-cyan-700 px-5 py-2.5 font-medium text-white hover:bg-cyan-800">
            Ask about your own screening <ArrowRight size={14} />
          </Link>
          <Link href="/trust" className="text-zinc-600 hover:text-zinc-900">
            Read the governance model
          </Link>
          <span className="text-zinc-500">
            OpenRx is decision support, not diagnosis. It does not claim HIPAA compliance or SOC 2 certification today.
          </span>
        </section>
      </main>
    </div>
  )
}
