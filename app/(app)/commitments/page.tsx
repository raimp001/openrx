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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/commitments", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          commitments?: CommitmentSnapshot[]
          error?: { message?: string }
        }
        if (!response.ok) throw new Error(data.error?.message || "Commitments are unavailable.")
        setItems(data.commitments || [])
      })
      .catch((issue) => setError(issue instanceof Error ? issue.message : "Commitments are unavailable."))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="border-b border-white/10 pb-6">
        <p className="flex items-center gap-2 text-xs font-semibold text-teal">
          <CalendarCheck size={15} />
          Screening commitments
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-primary">Your screening reservations</h1>
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
        <ul className="divide-y divide-white/10">
          {items.map(({ commitment }) => (
            <li key={commitment.id}>
              <Link
                href={`/commitments/${encodeURIComponent(commitment.id)}`}
                className="grid gap-3 py-5 transition hover:bg-white/[0.025] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3"
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
