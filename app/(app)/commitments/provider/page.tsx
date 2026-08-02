"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Clock3, Loader2, RefreshCw, ShieldCheck } from "lucide-react"

interface ProviderCommitment {
  id: string
  screeningLabel: string
  guidelineSource: string
  guidelineVersion: string
  status: string
  currentDeadline?: string
  conditionVerifiedAt?: string
  refundStatus: string
}

interface ProviderResponse {
  commitments: ProviderCommitment[]
  disclosure: string
  error?: { message?: string }
}

export default function CommitmentProviderPage() {
  const [data, setData] = useState<ProviderResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/commitments/provider", { cache: "no-store" })
      const value = (await response.json()) as ProviderResponse
      if (!response.ok) throw new Error(value.error?.message || "Provider commitments are unavailable.")
      setData(value)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Provider commitments are unavailable.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function confirmCompletion(id: string) {
    setWorking(id)
    setError("")
    try {
      const response = await fetch(
        `/api/admin/commitments/${encodeURIComponent(id)}/complete`,
        { method: "POST" },
      )
      const value = (await response.json()) as { error?: { message?: string } }
      if (!response.ok) throw new Error(value.error?.message || "Completion could not be confirmed.")
      await load()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Completion could not be confirmed.")
    } finally {
      setWorking("")
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-teal">
            <ShieldCheck size={15} />
            Trusted provider sandbox
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-primary">Completion confirmations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
            Confirm only that the assigned service was completed. Do not enter a result, diagnosis,
            appointment date, or patient note.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-10 items-center gap-2 rounded-[12px] border border-white/12 px-3 text-xs font-semibold text-primary"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </header>

      {error ? (
        <p role="alert" className="mt-5 rounded-[12px] border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 py-10 text-sm text-secondary">
          <Loader2 size={16} className="animate-spin" />
          Loading assigned commitments...
        </p>
      ) : data ? (
        <section aria-label="Assigned commitments" className="divide-y divide-white/10">
          {data.commitments.map((item) => {
            const active = ["funded", "extended"].includes(item.status)
            return (
              <article
                key={item.id}
                data-testid={`provider-commitment-${item.id}`}
                className="grid gap-5 py-6 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="text-base font-semibold text-primary">{item.screeningLabel}</p>
                  <p className="mt-1 text-xs text-secondary">
                    {item.guidelineSource} · {item.guidelineVersion}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                    {item.conditionVerifiedAt ? (
                      <CheckCircle2 size={14} className="text-emerald-300" />
                    ) : (
                      <Clock3 size={14} />
                    )}
                    {item.conditionVerifiedAt
                      ? "Completion confirmed"
                      : `Due by ${
                          item.currentDeadline
                            ? new Date(item.currentDeadline).toLocaleDateString()
                            : "unavailable"
                        }`}
                  </p>
                  <p className="mt-2 font-mono text-[10px] text-muted">{item.id}</p>
                </div>
                {active ? (
                  <button
                    type="button"
                    disabled={Boolean(working)}
                    onClick={() => void confirmCompletion(item.id)}
                    className="min-h-11 rounded-[12px] bg-teal px-4 text-sm font-semibold text-slate-950 transition hover:bg-teal/90 disabled:opacity-50"
                  >
                    {working === item.id ? "Confirming..." : "Confirm completion"}
                  </button>
                ) : (
                  <span className="text-xs font-medium text-emerald-300">Recorded</span>
                )}
              </article>
            )
          })}
          {data.commitments.length === 0 ? (
            <p className="py-10 text-center text-sm text-secondary">No assigned commitments need review.</p>
          ) : null}
          <p className="py-5 text-xs leading-5 text-muted">{data.disclosure}</p>
        </section>
      ) : null}
    </main>
  )
}
