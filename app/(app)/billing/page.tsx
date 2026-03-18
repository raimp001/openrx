"use client"

import { cn, formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import {
  Receipt,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Clock,
  Filter,
  FileSearch,
} from "lucide-react"
import { useState, useMemo } from "react"
import AIAction from "@/components/ai-action"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"

const CLAIM_STATUS_LABELS: Record<string, string> = {
  "submitted": "Submitted",
  "processing": "Processing",
  "paid": "Paid",
  "approved": "Approved",
  "denied": "Denied",
  "pending": "Pending",
}

const CPT_DESCRIPTIONS: Record<string, string> = {
  "99395": "Preventive Visit",
  "99396": "Preventive Visit",
  "99213": "Office Visit",
  "99214": "Office Visit",
  "99215": "Office Visit",
  "80053": "Comprehensive Metabolic Panel",
  "80061": "Lipid Panel",
  "85025": "Complete Blood Count",
  "93000": "EKG / Electrocardiogram",
  "71046": "Chest X-Ray",
  "36415": "Blood Draw",
  "99232": "Hospital Follow-up",
}

function claimStatusLabel(s: string) {
  return CLAIM_STATUS_LABELS[s] ?? s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function describeCPT(codes: string[]) {
  const names = codes.map((c) => CPT_DESCRIPTIONS[c] ?? `CPT ${c}`)
  const unique = Array.from(new Set(names))
  return unique.join(", ")
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-sand/40", className)} />
}

export default function BillingPage() {
  const [statusFilter, setStatusFilter] = useState("")
  const { snapshot, loading } = useLiveSnapshot()

  const myClaims = snapshot.claims

  const stats = useMemo(() => {
    const totalBilled = myClaims.reduce((s, c) => s + c.total_amount, 0)
    const totalPaid = myClaims
      .filter((c) => c.status === "paid" || c.status === "approved")
      .reduce((s, c) => s + c.insurance_paid + c.patient_responsibility, 0)
    const totalDenied = myClaims
      .filter((c) => c.status === "denied")
      .reduce((s, c) => s + c.total_amount, 0)
    const totalPending = myClaims
      .filter((c) => ["submitted", "processing"].includes(c.status))
      .reduce((s, c) => s + c.total_amount, 0)

    return { totalBilled, totalPaid, totalDenied, totalPending }
  }, [myClaims])

  const statCards = [
    {
      label: "Total Billed",
      value: formatCurrency(stats.totalBilled),
      icon: Receipt,
      color: "text-warm-800",
      bg: "bg-sand/30",
    },
    {
      label: "Paid",
      value: formatCurrency(stats.totalPaid),
      icon: CheckCircle2,
      color: "text-accent",
      bg: "bg-accent/5",
    },
    {
      label: "Pending",
      value: formatCurrency(stats.totalPending),
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-900/20",
    },
    {
      label: "Denied",
      value: formatCurrency(stats.totalDenied),
      icon: XCircle,
      color: "text-soft-red",
      bg: "bg-soft-red/5",
    },
  ]

  const filtered = useMemo(() => {
    if (!statusFilter) return myClaims
    return myClaims.filter((c) => c.status === statusFilter)
  }, [statusFilter, myClaims])

  const statuses = useMemo(
    () => Array.from(new Set(myClaims.map((c) => c.status))),
    [myClaims]
  )

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2"><Skeleton className="h-8 w-28" /><Skeleton className="h-4 w-56" /></div>
          <div className="flex gap-2"><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-28" /></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-pampas rounded-2xl border border-sand p-4"><Skeleton className="h-16 w-full" /></div>)}
        </div>
        <div className="bg-pampas rounded-2xl border border-sand divide-y divide-sand/50">
          {[...Array(4)].map((_, i) => <div key={i} className="px-5 py-4"><Skeleton className="h-16 w-full" /></div>)}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-warm-800">My Bills</h1>
          <p className="text-sm text-warm-500 mt-1">
            {myClaims.length} total claims &middot;{" "}
            {myClaims.filter((c) => c.errors_detected.length > 0).length} with
            issues
          </p>
        </div>
        <div className="flex gap-2">
          <AIAction
            agentId="billing"
            label="Analyze My Claims"
            prompt="Review all my claims for billing errors, incorrect charges, and denial risks. Help me understand what I owe and flag anything that looks wrong."
            context={`Total claims: ${myClaims.length}, Denied: ${myClaims.filter(c => c.status === "denied").length}, With issues: ${myClaims.filter(c => c.errors_detected.length > 0).length}`}
          />
          <AIAction
            agentId="billing"
            label="Help With Appeals"
            prompt="For any denied claims, help me understand why they were denied and draft appeal letters on my behalf."
            variant="inline"
          />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="bg-pampas rounded-2xl border border-sand p-5"
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                s.bg
              )}
            >
              <s.icon size={18} className={s.color} />
            </div>
            <div className="text-2xl font-bold text-warm-800">{s.value}</div>
            <div className="text-xs font-semibold text-warm-500 mt-1">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter size={14} className="text-cloudy" />
        <div className="flex bg-pampas border border-sand rounded-xl overflow-hidden">
          <button
            onClick={() => setStatusFilter("")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold transition-all",
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
                "px-3 py-1.5 text-xs font-semibold transition-all",
                statusFilter === s
                  ? "bg-terra text-white"
                  : "text-warm-600 hover:bg-sand/30"
              )}
            >
              {claimStatusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-pampas rounded-2xl border border-sand overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3 bg-sand/20 border-b border-sand text-[10px] font-bold text-warm-500 uppercase tracking-wider">
          <span>Claim Details</span>
          <span className="w-20 text-right">Amount</span>
          <span className="w-20 text-right">Ins. Paid</span>
          <span className="w-20 text-right">My Cost</span>
          <span className="w-24 text-center">Status</span>
          <span className="w-24 text-right">Date</span>
        </div>
        <div className="divide-y divide-sand/50">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <FileSearch size={32} className="text-cloudy" />
              <p className="text-sm font-semibold text-warm-600">No claims found</p>
              <p className="text-xs text-cloudy">
                {statusFilter ? `No ${claimStatusLabel(statusFilter).toLowerCase()} claims` : "No billing claims on file"}
              </p>
            </div>
          )}
          {filtered.map((claim) => {
            return (
              <div
                key={claim.id}
                className="lg:grid lg:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3.5 hover:bg-sand/20 transition items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-warm-800 truncate">
                      {describeCPT(claim.cpt_codes) || claim.claim_number}
                    </span>
                    {claim.errors_detected.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-soft-red">
                        <AlertTriangle size={10} />
                        {claim.errors_detected.length} issue{claim.errors_detected.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-cloudy mt-0.5 truncate">
                    Claim {claim.claim_number} &middot; ICD:{" "}
                    {claim.icd_codes.join(", ")}
                  </div>
                  {claim.denial_reason && (
                    <div className="text-[10px] text-soft-red mt-0.5 truncate">
                      {claim.denial_reason}
                    </div>
                  )}
                  {(claim.status === "denied" || claim.errors_detected.length > 0) && (
                    <AIAction
                      agentId="billing"
                      label={claim.status === "denied" ? "Help Me Appeal" : "Explain Issue"}
                      prompt={claim.status === "denied"
                        ? `Help me appeal denied claim ${claim.claim_number}. Denial reason: "${claim.denial_reason}". Explain what happened and draft an appeal.`
                        : `Explain the issues with claim ${claim.claim_number} in plain language and suggest what I should do.`}
                      context={`Claim: ${claim.claim_number}, CPT: ${claim.cpt_codes.join(",")}, ICD: ${claim.icd_codes.join(",")}, Amount: $${claim.total_amount}`}
                      variant="compact"
                      className="mt-1.5"
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 lg:mt-0 lg:contents">
                  <span className="lg:w-20 text-right text-sm font-semibold text-warm-800">
                    {formatCurrency(claim.total_amount)}
                  </span>
                  <span className="hidden lg:inline lg:w-20 text-right text-sm text-warm-600">
                    {formatCurrency(claim.insurance_paid)}
                  </span>
                  <span className="hidden lg:inline lg:w-20 text-right text-sm text-warm-600">
                    {formatCurrency(claim.patient_responsibility)}
                  </span>
                  <span className="lg:w-24 lg:text-center">
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide inline-block",
                        getStatusColor(claim.status)
                      )}
                    >
                      {claimStatusLabel(claim.status)}
                    </span>
                  </span>
                  <span className="lg:w-24 text-right text-xs text-warm-500">
                    {formatDate(claim.date_of_service)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
