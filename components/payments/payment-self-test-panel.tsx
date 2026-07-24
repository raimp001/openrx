"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, Loader2, LockKeyhole, PlayCircle } from "lucide-react"
import type { PaymentRailsSelfTestReport, SelfTestStatus } from "@/lib/payments-self-test"

const STORAGE_KEY = "openrx.admin.api.key"

const STATUS_STYLES: Record<SelfTestStatus, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  fail: "border-red-200 bg-red-50 text-red-700",
}

function StatusBadge({ status }: { status: SelfTestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}

export default function PaymentSelfTestPanel() {
  const [adminApiKey, setAdminApiKey] = useState("")
  const [report, setReport] = useState<PaymentRailsSelfTestReport | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) setAdminApiKey(stored)
  }, [])

  const run = useCallback(async () => {
    if (!adminApiKey.trim()) {
      setError("Enter the admin API key to run the self-test.")
      return
    }
    window.localStorage.setItem(STORAGE_KEY, adminApiKey.trim())
    setRunning(true)
    setError("")
    try {
      const response = await fetch("/api/payments/self-test", {
        headers: { "x-admin-api-key": adminApiKey.trim() },
        cache: "no-store",
      })
      const body = (await response.json()) as PaymentRailsSelfTestReport & { error?: string }
      if (response.status === 401 || response.status === 403) {
        setReport(null)
        setError(body.error || "Admin authorization failed.")
        return
      }
      if (!response.ok && !body.checks) {
        setReport(null)
        setError(body.error || `Self-test request failed (${response.status}).`)
        return
      }
      setReport(body)
    } catch (err) {
      setReport(null)
      setError(err instanceof Error ? err.message : "Self-test request failed.")
    } finally {
      setRunning(false)
    }
  }, [adminApiKey])

  return (
    <section className="surface-card space-y-4 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-cyan-700" />
          <div>
            <h2 className="text-sm font-bold text-primary">Payment rails self-test</h2>
            <p className="text-[11px] text-muted">
              Runs real, non-destructive checks against config, Base RPC, the USDC contract, and the ledger database.
            </p>
          </div>
        </div>
        {report && <StatusBadge status={report.status} />}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-[1fr_auto]">
        <label className="control-label">
          Admin API key
          <input
            type="password"
            value={adminApiKey}
            onChange={(event) => setAdminApiKey(event.target.value)}
            className="control-input"
            placeholder="OPENRX_ADMIN_API_KEY"
          />
        </label>
        <button
          onClick={() => void run()}
          disabled={!adminApiKey.trim() || running}
          className="control-button-primary inline-flex min-h-[44px] items-center gap-2 self-end"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
          {running ? "Running…" : "Run self-test"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <LockKeyhole size={12} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {report && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
            <span>
              Network: <span className="font-semibold text-cyan-700">{report.network}</span>
            </span>
            <span>
              Explorer:{" "}
              <a
                href={report.explorerRoot}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-cyan-700 underline-offset-2 hover:underline"
              >
                {report.explorerRoot}
              </a>
            </span>
            <span>Generated: {new Date(report.generatedAt).toLocaleString()}</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-semibold">Check</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Detail</th>
                  <th className="px-3 py-2 font-semibold">Fix hint</th>
                </tr>
              </thead>
              <tbody>
                {report.checks.map((check) => (
                  <tr key={check.id} className="border-b border-zinc-100 last:border-0 align-top">
                    <td className="px-3 py-2 font-semibold text-primary">{check.label}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={check.status} />
                    </td>
                    <td className="px-3 py-2 text-secondary">{check.detail}</td>
                    <td className="px-3 py-2 text-muted">{check.fixHint || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
