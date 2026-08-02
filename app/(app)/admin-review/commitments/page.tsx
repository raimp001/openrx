"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldCheck } from "lucide-react"

interface OperationsCommitment {
  commitment: {
    id: string
    screeningLabel: string
    status: string
    fundingStatus: string
    currentDeadline?: string
    conditionVerifiedAt?: string
    refundStatus: string
  }
  credential?: { status: string }
  audit: Array<{ id: string; eventType: string; occurredAt: string }>
}

interface AdminResponse {
  commitments: OperationsCommitment[]
  unmatchedWebhooks: number
  auditCount: number
  sandbox: boolean
  permissions: {
    canConfirmCompletion: boolean
    canRetryRefund: boolean
    canIssueExceptionRefund: boolean
    canViewAudit: boolean
  }
}

export default function CommitmentPilotAdminPage() {
  const [data, setData] = useState<AdminResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/commitments", { cache: "no-store" })
      const value = (await response.json()) as AdminResponse & { error?: { message?: string } }
      if (!response.ok) throw new Error(value.error?.message || "Pilot dashboard is unavailable.")
      setData(value)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Pilot dashboard is unavailable.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function post(path: string, body?: Record<string, unknown>) {
    setWorking(path)
    setError("")
    try {
      const response = await fetch(path, {
        method: body ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      })
      const value = (await response.json()) as { error?: { message?: string } }
      if (!response.ok) throw new Error(value.error?.message || "The pilot action failed.")
      await load()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The pilot action failed.")
    } finally {
      setWorking("")
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-teal">
            <ShieldCheck size={15} />
            Restricted sandbox
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-primary">Commitment pilot operations</h1>
          <p className="mt-2 text-sm text-secondary">
            Support, compliance, and administrator controls remain role-gated.
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
          Loading pilot operations...
        </p>
      ) : data ? (
        <>
          <dl className="grid grid-cols-2 gap-px border-b border-white/10 py-6 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">Commitments</dt>
              <dd className="mt-1 text-xl font-semibold text-primary">{data.commitments.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Needs completion</dt>
              <dd className="mt-1 text-xl font-semibold text-primary">
                {data.commitments.filter((item) => ["funded", "extended"].includes(item.commitment.status)).length}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Unmatched webhooks</dt>
              <dd className="mt-1 text-xl font-semibold text-primary">{data.unmatchedWebhooks}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Audit events</dt>
              <dd className="mt-1 text-xl font-semibold text-primary">{data.auditCount}</dd>
            </div>
          </dl>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-muted">
                  <th className="px-3 py-3 font-medium">Screening</th>
                  <th className="px-3 py-3 font-medium">Funding</th>
                  <th className="px-3 py-3 font-medium">Deadline</th>
                  <th className="px-3 py-3 font-medium">Completion</th>
                  <th className="px-3 py-3 font-medium">Refund</th>
                  <th className="px-3 py-3 font-medium">Credential</th>
                  <th className="px-3 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.commitments.map((item) => {
                  const active = ["funded", "extended"].includes(item.commitment.status)
                  return (
                    <tr key={item.commitment.id} className="border-b border-white/8 align-top">
                      <td className="px-3 py-4">
                        <p className="font-medium text-primary">{item.commitment.screeningLabel}</p>
                        <p className="mt-1 font-mono text-[10px] text-muted">{item.commitment.id}</p>
                      </td>
                      <td className="px-3 py-4 text-secondary">{item.commitment.fundingStatus}</td>
                      <td className="px-3 py-4 text-secondary">
                        {item.commitment.currentDeadline
                          ? new Date(item.commitment.currentDeadline).toLocaleDateString()
                          : "Not started"}
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex items-center gap-1.5 text-secondary">
                          {item.commitment.conditionVerifiedAt ? (
                            <CheckCircle2 size={13} className="text-emerald-300" />
                          ) : (
                            <Clock3 size={13} />
                          )}
                          {item.commitment.conditionVerifiedAt ? "Verified" : "Pending"}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-secondary">{item.commitment.refundStatus}</td>
                      <td className="px-3 py-4 text-secondary">
                        {item.credential?.status || "Not issued"}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          {active && data.permissions.canConfirmCompletion ? (
                            <button
                              type="button"
                              disabled={Boolean(working)}
                              onClick={() =>
                                void post(
                                  `/api/admin/commitments/${encodeURIComponent(item.commitment.id)}/complete`,
                                )
                              }
                              className="rounded-[10px] border border-emerald-300/20 px-2.5 py-1.5 font-semibold text-emerald-200 disabled:opacity-45"
                            >
                              Confirm sandbox completion
                            </button>
                          ) : null}
                          {item.commitment.refundStatus === "failed" &&
                          data.permissions.canRetryRefund ? (
                            <button
                              type="button"
                              disabled={Boolean(working)}
                              onClick={() =>
                                void post(
                                  `/api/admin/commitments/${encodeURIComponent(item.commitment.id)}`,
                                  { action: "retry_refund" },
                                )
                              }
                              className="rounded-[10px] border border-amber-300/20 px-2.5 py-1.5 font-semibold text-amber-200 disabled:opacity-45"
                            >
                              Retry refund
                            </button>
                          ) : null}
                          {active && data.permissions.canIssueExceptionRefund ? (
                            <button
                              type="button"
                              disabled={Boolean(working)}
                              onClick={() =>
                                void post(
                                  `/api/admin/commitments/${encodeURIComponent(item.commitment.id)}`,
                                  { action: "exception_refund" },
                                )
                              }
                              className="rounded-[10px] px-2.5 py-1.5 font-semibold text-secondary hover:bg-white/6"
                            >
                              Full exception refund
                            </button>
                          ) : null}
                        </div>
                        {data.permissions.canViewAudit ? (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-muted">
                              Audit trail ({item.audit.length})
                            </summary>
                            <ol className="mt-2 space-y-1.5">
                              {item.audit.map((event) => (
                                <li key={event.id} className="text-[10px] text-muted">
                                  {new Date(event.occurredAt).toLocaleString()} · {event.eventType}
                                </li>
                              ))}
                            </ol>
                          </details>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data.commitments.length === 0 ? (
            <p className="py-10 text-center text-sm text-secondary">No sandbox commitments yet.</p>
          ) : null}

          <p className="mt-6 flex items-center gap-2 text-xs text-muted">
            <AlertCircle size={13} />
            This dashboard does not expose payment credentials, screening results, or identity documents.
          </p>
        </>
      ) : null}
    </main>
  )
}
