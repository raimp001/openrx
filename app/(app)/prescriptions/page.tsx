"use client"

import { cn, formatDate, getStatusColor } from "@/lib/utils"
import { Pill, Search, RefreshCw, PackageSearch, AlertTriangle, ChevronRight, Clock } from "lucide-react"
import { useState, useMemo } from "react"
import Link from "next/link"
import AIAction from "@/components/ai-action"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"

// ── Status labels ───────────────────────────────────────────
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

// ── Adherence Ring ──────────────────────────────────────────
function AdherenceRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const sw = 5
  const r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * circ
  const color = pct >= 90 ? "#1FA971" : pct >= 80 ? "#D97706" : "#D1495B"
  const label = pct >= 90 ? "Great" : pct >= 80 ? "Fair" : "Low"
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(20,35,31,0.07)" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] font-bold leading-none" style={{ color }}>{pct}%</span>
        <span className="text-[7px] text-cloudy leading-none mt-0.5">{label}</span>
      </div>
    </div>
  )
}

// ── Skeleton ────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-sand/40", className)} />
}

// ── Days until refill needed ─────────────────────────────────
function daysUntilRefill(lastFilled: string, frequency: string): number | null {
  if (!lastFilled) return null
  const supplyDays = /twice|2x/i.test(frequency) ? 15 : /three|3x/i.test(frequency) ? 10 : 30
  const filled = new Date(lastFilled).getTime()
  const nextRefill = filled + supplyDays * 86400000
  const remaining = Math.ceil((nextRefill - Date.now()) / 86400000)
  return remaining
}

export default function PrescriptionsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const { snapshot, getPhysician, loading } = useLiveSnapshot()

  const myPrescriptions = snapshot.prescriptions
  const hasData = !!snapshot.patient

  const statuses = useMemo(
    () => Array.from(new Set(myPrescriptions.map((p) => p.status))),
    [myPrescriptions]
  )

  const filtered = useMemo(() => {
    return myPrescriptions.filter((rx) => {
      const matchesSearch = !search || rx.medication_name.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = !statusFilter || rx.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [search, statusFilter, myPrescriptions])

  const activeRx = myPrescriptions.filter((p) => p.status === "active")
  const lowAdherenceCount = activeRx.filter((p) => p.adherence_pct < 80).length
  const pendingRefills = myPrescriptions.filter((p) => p.status === "pending-refill").length
  const avgAdherence = activeRx.length > 0
    ? Math.round(activeRx.reduce((s, p) => s + p.adherence_pct, 0) / activeRx.length)
    : null

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="surface-card p-5 space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!loading && !hasData) {
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/8 flex items-center justify-center">
          <Pill size={28} className="text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-serif text-warm-800">My Medications</h1>
          <p className="text-warm-500 mt-1 max-w-sm">Connect your health record to see your prescriptions and track medication adherence.</p>
        </div>
        <Link href="/onboarding" className="px-5 py-2.5 bg-terra text-white text-sm font-semibold rounded-xl hover:bg-terra-dark transition">
          Get Started
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-warm-800">My Medications</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-warm-500">
            <span>{myPrescriptions.length} prescriptions</span>
            {lowAdherenceCount > 0 && (
              <span className="flex items-center gap-1 text-soft-red font-medium">
                <AlertTriangle size={12} /> {lowAdherenceCount} low adherence
              </span>
            )}
            {pendingRefills > 0 && (
              <span className="flex items-center gap-1 text-yellow-600 font-medium">
                <RefreshCw size={12} /> {pendingRefills} to refill
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/drug-prices"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-warm-600 border border-sand hover:border-terra/30 hover:text-terra transition">
            Compare Prices
          </Link>
          <AIAction
            agentId="rx"
            label="Maya: Review Meds"
            prompt="Review my medications for adherence issues, refill timing, and any potential interactions. Prioritize the most important actions I should take."
            context={`${activeRx.length} active Rx. Avg adherence: ${avgAdherence}%. Low adherence: ${lowAdherenceCount}. Pending refills: ${pendingRefills}.`}
          />
        </div>
      </div>

      {/* Summary stats */}
      {activeRx.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="surface-card p-4 text-center">
            <div className="text-2xl font-bold text-warm-800">{activeRx.length}</div>
            <div className="text-xs text-warm-500 mt-0.5">Active</div>
          </div>
          <div className="surface-card p-4 text-center">
            <div className={cn("text-2xl font-bold", avgAdherence && avgAdherence >= 90 ? "text-accent" : avgAdherence && avgAdherence >= 80 ? "text-yellow-600" : "text-soft-red")}>
              {avgAdherence ?? "--"}%
            </div>
            <div className="text-xs text-warm-500 mt-0.5">Avg Adherence</div>
          </div>
          <div className="surface-card p-4 text-center">
            <div className={cn("text-2xl font-bold", pendingRefills > 0 ? "text-yellow-600" : "text-accent")}>
              {pendingRefills}
            </div>
            <div className="text-xs text-warm-500 mt-0.5">Need Refill</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cloudy" />
          <input
            type="text"
            placeholder="Search medications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-sand bg-white text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40 focus:ring-1 focus:ring-terra/10 transition"
          />
        </div>
        <div className="flex bg-white border border-sand rounded-xl overflow-hidden">
          <button
            onClick={() => setStatusFilter("")}
            className={cn("px-3 py-2 text-xs font-semibold transition-all", !statusFilter ? "bg-terra text-white" : "text-warm-600 hover:bg-sand/30")}
          >
            All
          </button>
          {statuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-3 py-2 text-xs font-semibold transition-all", statusFilter === s ? "bg-terra text-white" : "text-warm-600 hover:bg-sand/30")}>
              {statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Prescriptions grid */}
      {filtered.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center py-20 text-center gap-3">
          <PackageSearch size={32} className="text-cloudy" />
          <p className="text-sm font-semibold text-warm-600">No medications found</p>
          <p className="text-xs text-cloudy max-w-xs">
            {search ? `No results for "${search}"` : myPrescriptions.length === 0 ? "Your medications will appear here once prescribed." : "Try adjusting the filter."}
          </p>
          {myPrescriptions.length === 0 && (
            <Link href="/providers" className="mt-2 px-4 py-2 bg-terra text-white text-xs font-semibold rounded-xl hover:bg-terra-dark transition">
              Find a Doctor
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((rx) => {
            const physician = getPhysician(rx.physician_id)
            const isLowAdherence = rx.status === "active" && rx.adherence_pct < 80
            const daysLeft = daysUntilRefill(rx.last_filled, rx.frequency)
            const refillSoon = daysLeft !== null && daysLeft <= 7 && rx.status === "active"

            return (
              <div key={rx.id} className={cn(
                "surface-card p-5 flex flex-col gap-4 relative overflow-hidden",
                isLowAdherence && "border-soft-red/20",
                refillSoon && !isLowAdherence && "border-yellow-300/40",
              )}>
                {/* Left accent bar */}
                {isLowAdherence && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-soft-red rounded-l-2xl" />
                )}
                {refillSoon && !isLowAdherence && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400 rounded-l-2xl" />
                )}

                <div className="flex items-start gap-4">
                  {/* Adherence Ring */}
                  <AdherenceRing pct={rx.adherence_pct} size={58} />

                  {/* Name + dosage */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-warm-800 leading-tight">{rx.medication_name}</h3>
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0",
                        getStatusColor(rx.status)
                      )}>
                        {statusLabel(rx.status)}
                      </span>
                    </div>
                    <p className="text-sm text-warm-600 font-medium mt-0.5">{rx.dosage}</p>
                    <p className="text-xs text-warm-500 mt-0.5">{rx.frequency}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs">
                  {physician && (
                    <div className="flex items-center gap-1.5 text-warm-500">
                      <span className="text-[10px] font-semibold text-cloudy uppercase tracking-wide">Prescriber</span>
                      <span className="text-warm-700 font-medium">{physician.full_name}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div>
                      <p className="text-[9px] font-semibold text-cloudy uppercase tracking-wide">Refills</p>
                      <p className={cn("text-xs font-bold mt-0.5", rx.refills_remaining === 0 ? "text-soft-red" : "text-warm-800")}>
                        {rx.refills_remaining === 0 ? "No refills" : `${rx.refills_remaining} remaining`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-cloudy uppercase tracking-wide">Last Filled</p>
                      <p className="text-xs font-medium text-warm-700 mt-0.5">{formatDate(rx.last_filled)}</p>
                    </div>
                  </div>
                  {refillSoon && (
                    <div className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
                      daysLeft !== null && daysLeft <= 0 ? "bg-soft-red/8 text-soft-red" : "bg-yellow-50 text-yellow-700"
                    )}>
                      <Clock size={11} />
                      {daysLeft !== null && daysLeft <= 0 ? "Refill overdue" : `Refill needed in ~${daysLeft} days`}
                    </div>
                  )}
                  {rx.notes && (
                    <p className="text-[10px] text-cloudy italic border-t border-sand/60 pt-2">{rx.notes}</p>
                  )}
                </div>

                {/* Footer actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-sand/60 mt-auto">
                  {(isLowAdherence || rx.status === "pending-refill" || rx.refills_remaining === 0) ? (
                    <AIAction
                      agentId="rx"
                      label={isLowAdherence ? "Get Adherence Tips" : "Request Refill"}
                      prompt={isLowAdherence
                        ? `My adherence for ${rx.medication_name} ${rx.dosage} is ${rx.adherence_pct}%. Give me practical strategies to improve it.`
                        : `Request a refill for ${rx.medication_name} ${rx.dosage}. Refills remaining: ${rx.refills_remaining}. Pharmacy: ${rx.pharmacy || "on file"}.`}
                      context={`${rx.medication_name} ${rx.dosage} — ${rx.frequency}`}
                      variant="compact"
                    />
                  ) : (
                    <span className="flex-1 text-[10px] text-cloudy">{rx.pharmacy || "No pharmacy on file"}</span>
                  )}
                  <Link href="/drug-prices" className="ml-auto text-[10px] font-semibold text-terra hover:text-terra-dark transition flex items-center gap-0.5">
                    Price <ChevronRight size={10} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
