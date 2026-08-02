"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, CalendarCheck, Loader2, ShieldCheck } from "lucide-react"
import type { CommitmentSnapshot } from "@/lib/commitments/types"

function statusLabel(status: CommitmentSnapshot["commitment"]["status"]): string {
  const labels: Record<CommitmentSnapshot["commitment"]["status"], string> = {
    created: "Setup not finished",
    funded: "In progress",
    extended: "Extended",
    condition_verified: "Completion verified",
    refunded: "Completed and returned",
    cancelled: "Cancelled",
    expired: "Expired",
  }
  return labels[status]
}

export default function CommitmentsPage() {
  const [items, setItems] = useState<CommitmentSnapshot[]>([])
  const [pilotEnabled, setPilotEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/commitments/config", { cache: "no-store" })
      .then(async (response) => {
        const config = (await response.json()) as { enabled?: boolean }
        if (!response.ok) throw new Error("Screening reservations are unavailable.")
        const enabled = config.enabled === true
        setPilotEnabled(enabled)
        if (!enabled) return { commitments: [] as CommitmentSnapshot[] }
        const commitmentsResponse = await fetch("/api/commitments", { cache: "no-store" })
        const data = (await commitmentsResponse.json()) as {
          commitments?: CommitmentSnapshot[]
          error?: { message?: string }
        }
        if (!commitmentsResponse.ok) {
          throw new Error(data.error?.message || "Screening reservations are unavailable.")
        }
        return { commitments: data.commitments || [] }
      })
      .then((data) => setItems(data.commitments))
      .catch((issue) => setError(issue instanceof Error ? issue.message : "Commitments are unavailable."))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main data-openrx-warm className="mx-auto w-full max-w-4xl px-0 py-5 sm:py-9">
      <header className="border-b border-border pb-6">
        <p className="flex items-center gap-2 text-xs font-semibold text-teal-dark">
          <CalendarCheck size={15} />
          Screening commitments
        </p>
        <h1 className="orx-display-heading mt-3 text-3xl text-primary">Your screening reservations</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
          Track optional refundable commitments. Your screening recommendations and access to care never depend on
          participation.
        </p>
      </header>

      {loading ? (
        <p className="flex items-center gap-2 py-10 text-sm text-secondary">
          <Loader2 size={16} className="animate-spin" />
          Loading reservations...
        </p>
      ) : error ? (
        <p role="alert" className="my-6 rounded-[12px] border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100">
          {error}
        </p>
      ) : pilotEnabled === false ? (
        <section data-testid="commitment-pilot-preview" className="py-9 sm:py-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-amber-300/40 bg-amber-100 text-amber-800">Preview only</span>
            <span className="text-xs text-muted">No deposits are accepted on this website.</span>
          </div>
          <h2 className="orx-section-heading mt-5 max-w-2xl text-2xl text-primary">
            A small, optional deposit that comes back after verified completion
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">
            Eligible screening plans may offer a 90-day reservation. A trusted provider or laboratory confirms
            completion, then the deposit is returned. Declining never changes care or scheduling priority.
          </p>
          <ol className="mt-7 grid border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-border">
            {[
              ["01", "Choose", "Accept clear terms only after a sourced screening recommendation."],
              ["02", "Complete", "Finish within 90 days, with one scheduling extension available."],
              ["03", "Receive", "Get the deposit back after a trusted completion signal."],
            ].map(([number, title, description]) => (
              <li key={number} className="py-5 sm:px-5 first:sm:pl-0 last:sm:pr-0">
                <span className="font-data text-[10px] text-muted">{number}</span>
                <p className="mt-2 text-sm font-semibold text-primary">{title}</p>
                <p className="mt-1 text-xs leading-5 text-secondary">{description}</p>
              </li>
            ))}
          </ol>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link href="/screening" className="control-button-primary">
              Check my screening
              <ArrowRight size={14} />
            </Link>
            <span className="text-xs text-muted">Sandbox validation and partner review are still in progress.</span>
          </div>
        </section>
      ) : items.length === 0 ? (
        <section className="py-12 text-center">
          <ShieldCheck className="mx-auto text-teal" size={28} />
          <h2 className="mt-4 text-lg font-semibold text-primary">No screening reservations</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">
            Eligible recommendations show an optional “Reserve my screening” action.
          </p>
          <Link href="/screening" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal">
            View my screening plan
            <ArrowRight size={14} />
          </Link>
        </section>
      ) : (
        <ul className="divide-y divide-border">
          {items.map(({ commitment }) => (
            <li key={commitment.id}>
              <Link
                href={`/commitments/${encodeURIComponent(commitment.id)}`}
                className="grid gap-3 py-5 transition hover:bg-surface sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3"
              >
                <div>
                  <p className="font-semibold text-primary">{commitment.screeningLabel}</p>
                  <p className="mt-1 text-xs text-secondary">
                    {statusLabel(commitment.status)}
                    {commitment.currentDeadline
                      ? ` · due ${new Date(commitment.currentDeadline).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal">
                  View
                  <ArrowRight size={13} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
