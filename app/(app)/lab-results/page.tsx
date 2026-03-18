"use client"

import { cn } from "@/lib/utils"
import {
  FlaskConical, AlertTriangle, CheckCircle2, Clock,
  ChevronDown, ChevronUp, FileText, TrendingUp, TrendingDown,
} from "lucide-react"
import { useState } from "react"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import AIAction from "@/components/ai-action"
import Link from "next/link"

// ── Reference Range Bar ─────────────────────────────────────
function RangeBar({ value, referenceRange, flag }: {
  value: string; referenceRange?: string; flag: string
}) {
  const numVal = parseFloat(value)
  if (isNaN(numVal) || !referenceRange) return null

  // Handle "<N" format (e.g. "<5.7", "< 200")
  const ltMatch = referenceRange.match(/^<\s*(\d+\.?\d*)/)
  if (ltMatch) {
    const hi = parseFloat(ltMatch[1])
    const lo = 0
    const pad = hi * 0.6
    const minS = lo
    const maxS = hi + pad
    const scale = maxS - minS
    const valPct = Math.max(2, Math.min(98, ((numVal - minS) / scale) * 100))
    const normStart = 0
    const normWidth = (hi / scale) * 100
    const dotColor = flag === "normal" ? "#1FA971" : flag === "critical" ? "#DC2626" : "#D1495B"
    return (
      <div className="relative h-1.5 bg-sand/30 rounded-full w-full max-w-[80px] mt-1.5" role="img" aria-label={`Value ${value}, range ${referenceRange}`}>
        <div className="absolute h-full bg-accent/20 rounded-full" style={{ left: `${normStart}%`, width: `${normWidth}%` }} />
        <div className="absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow" style={{ left: `${valPct}%`, transform: "translate(-50%, -50%)", background: dotColor }} />
      </div>
    )
  }

  // Handle ">N" format (e.g. ">40")
  const gtMatch = referenceRange.match(/^>\s*(\d+\.?\d*)/)
  if (gtMatch) {
    const lo = parseFloat(gtMatch[1])
    const hi = lo + lo * 1.6
    const pad = lo * 0.4
    const minS = lo - pad
    const maxS = hi
    const scale = maxS - minS
    const valPct = Math.max(2, Math.min(98, ((numVal - minS) / scale) * 100))
    const normStart = ((lo - minS) / scale) * 100
    const normWidth = ((hi - lo) / scale) * 100
    const dotColor = flag === "normal" ? "#1FA971" : flag === "critical" ? "#DC2626" : "#D1495B"
    return (
      <div className="relative h-1.5 bg-sand/30 rounded-full w-full max-w-[80px] mt-1.5" role="img" aria-label={`Value ${value}, range ${referenceRange}`}>
        <div className="absolute h-full bg-accent/20 rounded-full" style={{ left: `${normStart}%`, width: `${normWidth}%` }} />
        <div className="absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow" style={{ left: `${valPct}%`, transform: "translate(-50%, -50%)", background: dotColor }} />
      </div>
    )
  }

  // Handle "N-N" or "N–N" format (standard range)
  const match = referenceRange.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/)
  if (!match) return null
  const lo = parseFloat(match[1])
  const hi = parseFloat(match[2])
  if (isNaN(lo) || isNaN(hi)) return null

  const pad = (hi - lo) * 0.6
  const minS = lo - pad
  const maxS = hi + pad
  const scale = maxS - minS
  const valPct = Math.max(2, Math.min(98, ((numVal - minS) / scale) * 100))
  const normStart = ((lo - minS) / scale) * 100
  const normWidth = ((hi - lo) / scale) * 100

  const dotColor = flag === "normal" ? "#1FA971" : flag === "critical" ? "#DC2626" : "#D1495B"

  return (
    <div className="relative h-1.5 bg-sand/30 rounded-full w-full max-w-[80px] mt-1.5" role="img" aria-label={`Value ${value}, range ${referenceRange}`}>
      <div className="absolute h-full bg-accent/20 rounded-full"
        style={{ left: `${normStart}%`, width: `${normWidth}%` }} />
      <div
        className="absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow"
        style={{
          left: `${valPct}%`,
          transform: "translate(-50%, -50%)",
          background: dotColor,
        }}
      />
    </div>
  )
}

// ── Flag Badge ──────────────────────────────────────────────
function FlagBadge({ flag }: { flag: string }) {
  if (flag === "normal") {
    return <CheckCircle2 size={14} className="text-accent" />
  }
  if (flag === "critical") {
    return (
      <span className="flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white uppercase tracking-wider">
        !! {flag}
      </span>
    )
  }
  return (
    <span className={cn(
      "flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase",
      flag === "high" ? "bg-soft-red/10 text-soft-red" : "bg-soft-blue/10 text-soft-blue"
    )}>
      {flag === "high" ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {flag}
    </span>
  )
}

// ── Skeleton ────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-sand/40", className)} />
}

export default function LabResultsPage() {
  const { snapshot, getPhysician, loading } = useLiveSnapshot()
  const labs = snapshot.labResults
  const hasData = !!snapshot.patient
  const [expandedLab, setExpandedLab] = useState<string | null>(labs[0]?.id || null)

  const pendingLabs = labs.filter((l) => l.status === "pending")
  const resultedLabs = labs.filter((l) => l.status !== "pending")
  const abnormalCount = resultedLabs.reduce(
    (count, lab) => count + lab.results.filter((r) => r.flag !== "normal").length, 0
  )
  const criticalCount = resultedLabs.reduce(
    (count, lab) => count + lab.results.filter((r) => r.flag === "critical").length, 0
  )

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="surface-card p-4"><Skeleton className="h-12 w-full" /></div>)}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="surface-card p-4"><Skeleton className="h-20 w-full" /></div>)}
        </div>
      </div>
    )
  }

  if (!loading && !hasData) {
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-soft-blue/8 flex items-center justify-center">
          <FlaskConical size={28} className="text-soft-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-serif text-warm-800">Lab Results</h1>
          <p className="text-warm-500 mt-1 max-w-sm">Connect your health record to view your lab tests and get AI-powered interpretations.</p>
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
          <h1 className="text-2xl font-serif text-warm-800">Lab Results</h1>
          <p className="text-sm text-warm-500 mt-1">
            {labs.length} tests &middot; {abnormalCount} abnormal values
            {criticalCount > 0 && <span className="text-red-600 font-bold"> &middot; {criticalCount} critical</span>}
          </p>
        </div>
        <AIAction
          agentId="coordinator"
          label="Interpret My Labs"
          prompt={`Explain my lab results in plain language. I have ${abnormalCount} abnormal values out of ${labs.length} tests. For each abnormal result, tell me what it means, why it matters, and what to discuss with my doctor.`}
          context={`Results: ${resultedLabs.flatMap(l => l.results.filter(r => r.flag !== "normal")).map(r => `${r.name}: ${r.value}${r.unit || ""} (${r.flag})`).join(", ")}`}
        />
      </div>

      {/* Critical alert */}
      {criticalCount > 0 && (
        <div className="rounded-2xl border-2 border-red-500/30 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="text-sm font-bold text-red-700">Critical Values Detected</span>
          </div>
          <p className="text-sm text-red-600">
            {criticalCount} critical lab value{criticalCount > 1 ? "s" : ""} require immediate attention. Please contact your doctor.
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: FlaskConical, color: "text-terra", bg: "bg-terra/8", value: labs.length, label: "Total Tests" },
          { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", value: pendingLabs.length, label: "Pending" },
          {
            icon: AlertTriangle,
            color: abnormalCount > 0 ? "text-soft-red" : "text-accent",
            bg: abnormalCount > 0 ? "bg-soft-red/8" : "bg-accent/8",
            value: abnormalCount, label: "Abnormal Values"
          },
          {
            icon: CheckCircle2,
            color: "text-accent", bg: "bg-accent/8",
            value: resultedLabs.filter((l) => l.status === "reviewed").length,
            label: "Doctor Reviewed"
          },
        ].map((card) => (
          <div key={card.label} className="surface-card p-4">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", card.bg)}>
              <card.icon size={18} className={card.color} />
            </div>
            <div className="text-2xl font-bold text-warm-800">{card.value}</div>
            <div className="text-xs text-warm-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Pending labs */}
      {pendingLabs.length > 0 && (
        <div className="rounded-2xl border border-yellow-200/60 bg-yellow-50/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-yellow-600" />
            <span className="text-xs font-bold text-yellow-700 uppercase tracking-wide">Awaiting Results</span>
          </div>
          <div className="space-y-2">
            {pendingLabs.map((lab) => (
              <div key={lab.id} className="flex items-center justify-between">
                <p className="text-xs text-warm-700 font-medium">{lab.test_name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-warm-500">Ordered {new Date(lab.ordered_at).toLocaleDateString()}</span>
                  <span className="text-[9px] font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">Processing</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-warm-500 mt-2">Results typically available within 1–3 business days.</p>
        </div>
      )}

      {/* Empty state for labs */}
      {resultedLabs.length === 0 && !pendingLabs.length && (
        <div className="surface-card flex flex-col items-center justify-center py-20 text-center gap-3">
          <FlaskConical size={32} className="text-cloudy" />
          <p className="text-sm font-semibold text-warm-600">No lab results yet</p>
          <p className="text-xs text-cloudy max-w-xs">Your lab results will appear here after tests are ordered and processed.</p>
        </div>
      )}

      {/* Lab result cards */}
      <div className="space-y-3">
        {resultedLabs.map((lab) => {
          const physician = getPhysician(lab.physician_id)
          const isExpanded = expandedLab === lab.id
          const abnormals = lab.results.filter((r) => r.flag !== "normal")
          const criticals = lab.results.filter((r) => r.flag === "critical")
          const hasAbnormal = abnormals.length > 0

          return (
            <div key={lab.id} className={cn(
              "surface-card overflow-hidden",
              criticals.length > 0 && "border-red-400/30",
              hasAbnormal && !criticals.length && "border-soft-red/20",
            )}>
              <button
                onClick={() => setExpandedLab(isExpanded ? null : lab.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-cream/30 transition text-left"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    criticals.length > 0 ? "bg-red-100" : hasAbnormal ? "bg-soft-red/10" : "bg-accent/8"
                  )}>
                    <FlaskConical size={18} className={criticals.length > 0 ? "text-red-600" : hasAbnormal ? "text-soft-red" : "text-accent"} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-warm-800">{lab.test_name}</h3>
                    <p className="text-[10px] text-cloudy mt-0.5">
                      {lab.lab_facility} &middot; {lab.category} &middot; {lab.resulted_at ? new Date(lab.resulted_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Pending"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {criticals.length > 0 && (
                    <span className="text-[9px] font-black text-white bg-red-600 px-2 py-0.5 rounded-full">CRITICAL</span>
                  )}
                  {hasAbnormal && !criticals.length && (
                    <span className="text-[9px] font-bold text-soft-red bg-soft-red/10 px-2 py-0.5 rounded-full">
                      {abnormals.length} abnormal
                    </span>
                  )}
                  {!hasAbnormal && (
                    <span className="text-[9px] font-bold text-accent bg-accent/8 px-2 py-0.5 rounded-full">All Normal</span>
                  )}
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                    lab.status === "reviewed" ? "text-accent bg-accent/8" : "text-warm-500 bg-warm-100"
                  )}>
                    {lab.status === "reviewed" ? "Reviewed" : "Resulted"}
                  </span>
                  {isExpanded
                    ? <ChevronUp size={14} className="text-cloudy" />
                    : <ChevronDown size={14} className="text-cloudy" />
                  }
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-sand/60">
                  {/* Individual results */}
                  <div className="divide-y divide-sand/40">
                    {lab.results.map((result, idx) => (
                      <div key={idx} className={cn(
                        "flex items-start gap-4 px-5 py-3.5",
                        result.flag === "critical" ? "bg-red-50" :
                        result.flag !== "normal" ? "bg-soft-red/3" : ""
                      )}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-warm-800">{result.name}</p>
                          {result.reference_range && (
                            <p className="text-[10px] text-cloudy mt-0.5">Ref: {result.reference_range}</p>
                          )}
                          {result.reference_range && (
                            <RangeBar value={result.value} referenceRange={result.reference_range} flag={result.flag} />
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className={cn(
                            "text-base font-bold leading-none",
                            result.flag === "critical" ? "text-red-600" :
                            result.flag !== "normal" ? "text-soft-red" : "text-warm-800"
                          )}>
                            {result.value}
                            {result.unit && <span className="text-xs font-normal text-warm-500 ml-1">{result.unit}</span>}
                          </div>
                          <div className="mt-1.5 flex justify-end">
                            <FlagBadge flag={result.flag} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Doctor notes + AI */}
                  {lab.notes && (
                    <div className="px-5 py-3 bg-cream/40 border-t border-sand/60">
                      <div className="flex items-start gap-2">
                        <FileText size={12} className="text-terra mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-warm-600 uppercase tracking-wide">
                            {physician?.full_name || "Clinician"}&apos;s Notes
                          </p>
                          <p className="text-xs text-warm-700 mt-0.5 leading-relaxed">{lab.notes}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {hasAbnormal && (
                    <div className="px-5 py-3 border-t border-sand/60">
                      <AIAction
                        agentId="coordinator"
                        label="Explain These Results"
                        prompt={`Explain the abnormal results from my ${lab.test_name} in plain language: ${abnormals.map(r => `${r.name}: ${r.value}${r.unit || ""} (reference: ${r.reference_range || "n/a"}, flag: ${r.flag})`).join(", ")}. What do they mean for my health and what should I discuss with my doctor?`}
                        context={`Lab: ${lab.test_name} at ${lab.lab_facility}`}
                        variant="compact"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* AI interpretation */}
      {labs.length > 0 && (
        <AIAction
          agentId="coordinator"
          label="Full Lab Summary from Atlas"
          prompt={`Give me a comprehensive summary of all my lab results in plain English. Explain each abnormal value, how it relates to my health conditions, and give me 3 specific questions to ask my doctor.`}
          context={`All labs: ${labs.map(l => `${l.test_name}: ${l.results.map(r => `${r.name}=${r.value}${r.unit || ""} (${r.flag})`).join(", ")}`).join(" | ")}`}
          variant="inline"
          className="bg-terra/5 rounded-2xl border border-terra/10 p-4"
        />
      )}
    </div>
  )
}
