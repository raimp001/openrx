"use client"

import { cn, formatDate, getStatusColor } from "@/lib/utils"
import { Pill, Search, AlertTriangle, RefreshCw, PackageSearch } from "lucide-react"
import { useState, useMemo } from "react"
import Link from "next/link"
import AIAction from "@/components/ai-action"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"

const STATUS_LABELS: Record<string, string> = {
  "active": "Taking",
  "pending-refill": "Ready to Refill",
  "completed": "Completed",
  "on-hold": "On Hold",
  "discontinued": "Discontinued",
}

function statusLabel(s: string) {
  return STATUS_LABELS[s] ?? s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function PrescriptionsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const { snapshot, getPhysician } = useLiveSnapshot()

  const myPrescriptions = snapshot.prescriptions

  const statuses = useMemo(
    () => Array.from(new Set(myPrescriptions.map((p) => p.status))),
    [myPrescriptions]
  )

  const filtered = useMemo(() => {
    return myPrescriptions.filter((rx) => {
      const matchesSearch =
        !search ||
        rx.medication_name.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = !statusFilter || rx.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [search, statusFilter, myPrescriptions])

  const lowAdherenceCount = myPrescriptions.filter(
    (p) => p.status === "active" && p.adherence_pct < 80
  ).length
  const pendingRefills = myPrescriptions.filter(
    (p) => p.status === "pending-refill"
  ).length

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-warm-800">My Medications</h1>
          <p className="text-sm text-warm-500 mt-1">
            {myPrescriptions.length} prescriptions &middot;{" "}
            <span className="text-soft-red font-medium">
              {lowAdherenceCount} low adherence
            </span>{" "}
            &middot;{" "}
            <span className="text-yellow-600 font-medium">
              {pendingRefills} pending refills
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/drug-prices"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-warm-600 border border-sand hover:border-terra/30 hover:text-terra transition"
          >
            Compare Prices
          </Link>
          <AIAction
            agentId="rx"
            label="Check My Adherence"
            prompt="Review my medication adherence for all active prescriptions. For any below 80%, give me tips to stay on track."
            context={`Low adherence: ${lowAdherenceCount} medications, Pending refills: ${pendingRefills}`}
          />
          <AIAction
            agentId="rx"
            label="Refill Reminders"
            prompt="Check which of my prescriptions need refills within the next 7 days and remind me."
            variant="inline"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-cloudy"
          />
          <input
            type="text"
            placeholder="Search medication..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-sand bg-pampas text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40 focus:ring-1 focus:ring-terra/20 transition"
          />
        </div>
        <div className="flex bg-pampas border border-sand rounded-xl overflow-hidden">
          <button
            onClick={() => setStatusFilter("")}
            className={cn(
              "px-3 py-2 text-xs font-semibold transition-all",
              !statusFilter
                ? "bg-terra text-white"
                : "text-warm-600 hover:bg-sand/30"
            )}
          >
            All
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-2 text-xs font-semibold transition-all",
                statusFilter === s
                  ? "bg-terra text-white"
                  : "text-warm-600 hover:bg-sand/30"
              )}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Prescriptions List */}
      <div className="bg-pampas rounded-2xl border border-sand divide-y divide-sand/50">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <PackageSearch size={32} className="text-cloudy" />
            <p className="text-sm font-semibold text-warm-600">No medications found</p>
            <p className="text-xs text-cloudy max-w-xs">
              {search ? `No results for "${search}"` : `No ${statusFilter ? statusLabel(statusFilter).toLowerCase() : ""} medications`}
            </p>
          </div>
        )}
        {filtered.map((rx) => {
          const physician = getPhysician(rx.physician_id)
          const isLowAdherence = rx.status === "active" && rx.adherence_pct < 80

          return (
            <div
              key={rx.id}
              className={cn(
                "flex items-center gap-4 px-5 py-4 hover:bg-sand/20 transition",
                isLowAdherence && "border-l-2 border-l-soft-red"
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  isLowAdherence
                    ? "bg-soft-red/10"
                    : rx.status === "pending-refill"
                    ? "bg-yellow-900/20"
                    : rx.status === "completed"
                    ? "bg-sand/40"
                    : "bg-accent/5"
                )}
              >
                {isLowAdherence ? (
                  <AlertTriangle size={16} className="text-soft-red" />
                ) : rx.status === "pending-refill" ? (
                  <RefreshCw size={16} className="text-yellow-600" />
                ) : (
                  <Pill
                    size={16}
                    className={
                      rx.status === "completed" ? "text-gray-400" : "text-accent"
                    }
                  />
                )}
              </div>

              {/* Main */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-warm-800">
                    {rx.medication_name}
                  </span>
                  <span className="text-xs text-warm-600">{rx.dosage}</span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
                      getStatusColor(rx.status)
                    )}
                  >
                    {statusLabel(rx.status)}
                  </span>
                </div>
                <p className="text-xs text-warm-500 mt-0.5">
                  {rx.frequency} &middot; Prescribed by{" "}
                  {physician?.full_name}
                </p>
                {rx.notes && (
                  <p className="text-[10px] text-cloudy mt-0.5 italic">
                    {rx.notes}
                  </p>
                )}
              </div>

              {/* Adherence */}
              <div className="w-24 shrink-0 text-center">
                <div
                  className={cn(
                    "text-lg font-bold",
                    rx.adherence_pct >= 90
                      ? "text-accent"
                      : rx.adherence_pct >= 80
                      ? "text-warm-700"
                      : "text-soft-red"
                  )}
                >
                  {rx.adherence_pct}%
                </div>
                <div className="text-[10px] text-cloudy">adherence</div>
                <div className="w-full h-1.5 bg-sand/40 rounded-full mt-1 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      rx.adherence_pct >= 90
                        ? "bg-accent"
                        : rx.adherence_pct >= 80
                        ? "bg-yellow-400"
                        : "bg-soft-red"
                    )}
                    style={{ width: `${rx.adherence_pct}%` }}
                  />
                </div>
              </div>

              {/* Meta */}
              <div className="text-right shrink-0">
                <div className="text-xs text-warm-500">
                  {rx.refills_remaining} refills left
                </div>
                <div className="text-[10px] text-cloudy mt-0.5">
                  Last filled {formatDate(rx.last_filled)}
                </div>
                <div className="text-[10px] text-cloudy">{rx.pharmacy}</div>
                {(isLowAdherence || rx.status === "pending-refill") && (
                  <AIAction
                    agentId="rx"
                    label={isLowAdherence ? "Get Tips" : "Request Refill"}
                    prompt={isLowAdherence
                      ? `I have ${rx.adherence_pct}% adherence for ${rx.medication_name}. Give me tips and reminders to help me stay on track.`
                      : `Help me request a refill for ${rx.medication_name} ${rx.dosage} at ${rx.pharmacy}.`}
                    context={`Medication: ${rx.medication_name} ${rx.dosage}, Adherence: ${rx.adherence_pct}%`}
                    variant="compact"
                    className="mt-1.5 justify-end"
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
