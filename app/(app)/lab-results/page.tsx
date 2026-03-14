"use client"

import { currentUser } from "@/lib/current-user"
import { getPatientLabResults, getPhysician } from "@/lib/seed-data"
import { cn } from "@/lib/utils"
import {
  FlaskConical, AlertTriangle, CheckCircle2, Clock, ArrowRight,
  ChevronDown, ChevronUp, FileText,
} from "lucide-react"
import { useState } from "react"
import AIAction from "@/components/ai-action"

export default function LabResultsPage() {
  const labs = getPatientLabResults(currentUser.id)
  const [expandedLab, setExpandedLab] = useState<string | null>(labs[0]?.id || null)

  const pendingLabs = labs.filter((l) => l.status === "pending")
  const resultedLabs = labs.filter((l) => l.status !== "pending")
  const abnormalCount = resultedLabs.reduce(
    (count, lab) => count + lab.results.filter((r) => r.flag !== "normal").length,
    0
  )

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-2xl font-serif text-warm-800">Lab Results</h1>
        <p className="text-sm text-warm-500 mt-1">
          View and track your laboratory test results.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <FlaskConical size={20} className="text-terra mb-2" />
          <div className="text-lg font-bold text-warm-800">{labs.length}</div>
          <div className="text-xs text-warm-500">Total Tests</div>
        </div>
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <Clock size={20} className="text-yellow-600 mb-2" />
          <div className="text-lg font-bold text-warm-800">{pendingLabs.length}</div>
          <div className="text-xs text-warm-500">Pending Results</div>
        </div>
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <AlertTriangle size={20} className="text-soft-red mb-2" />
          <div className="text-lg font-bold text-warm-800">{abnormalCount}</div>
          <div className="text-xs text-warm-500">Abnormal Values</div>
        </div>
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <CheckCircle2 size={20} className="text-accent mb-2" />
          <div className="text-lg font-bold text-warm-800">
            {resultedLabs.filter((l) => l.status === "reviewed").length}
          </div>
          <div className="text-xs text-warm-500">Reviewed by Doctor</div>
        </div>
      </div>

      {/* Pending Labs Alert */}
      {pendingLabs.length > 0 && (
        <div className="bg-yellow-50 rounded-2xl border border-yellow-200/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-yellow-600" />
            <span className="text-xs font-bold text-yellow-700">Pending Results</span>
          </div>
          {pendingLabs.map((lab) => (
            <div key={lab.id} className="flex items-center justify-between mt-1">
              <p className="text-xs text-warm-600">
                {lab.test_name} — ordered {new Date(lab.ordered_at).toLocaleDateString()}
              </p>
              <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                Processing
              </span>
            </div>
          ))}
          <p className="text-[10px] text-warm-500 mt-2">
            Results typically available within 1-3 business days.
          </p>
        </div>
      )}

      {/* Lab Results List */}
      <div className="space-y-3">
        {resultedLabs.map((lab) => {
          const physician = getPhysician(lab.physician_id)
          const isExpanded = expandedLab === lab.id
          const abnormals = lab.results.filter((r) => r.flag !== "normal")
          const hasAbnormal = abnormals.length > 0

          return (
            <div
              key={lab.id}
              className="bg-pampas rounded-2xl border border-sand overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => setExpandedLab(isExpanded ? null : lab.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-cream/30 transition text-left"
                aria-expanded={isExpanded}
                aria-label={`${lab.test_name} results`}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    hasAbnormal ? "bg-soft-red/10" : "bg-accent/10"
                  )}>
                    <FlaskConical size={18} className={hasAbnormal ? "text-soft-red" : "text-accent"} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-warm-800">{lab.test_name}</h3>
                    <p className="text-[10px] text-cloudy">
                      {lab.category} &middot; {lab.lab_facility} &middot;{" "}
                      {lab.resulted_at ? new Date(lab.resulted_at).toLocaleDateString() : "Pending"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasAbnormal && (
                    <span className="text-[9px] font-bold text-soft-red bg-soft-red/10 px-2 py-0.5 rounded-full">
                      {abnormals.length} abnormal
                    </span>
                  )}
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full",
                    lab.status === "reviewed" ? "text-accent bg-accent/10" : "text-warm-600 bg-warm-100"
                  )}>
                    {lab.status}
                  </span>
                  {isExpanded ? <ChevronUp size={14} className="text-cloudy" /> : <ChevronDown size={14} className="text-cloudy" />}
                </div>
              </button>

              {/* Expanded Results */}
              {isExpanded && (
                <div className="border-t border-sand animate-fade-in">
                  {/* Results Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" role="table">
                      <thead>
                        <tr className="bg-cream/50">
                          <th className="text-left px-4 py-2 text-warm-500 font-semibold">Test</th>
                          <th className="text-right px-4 py-2 text-warm-500 font-semibold">Result</th>
                          <th className="text-right px-4 py-2 text-warm-500 font-semibold">Reference</th>
                          <th className="text-center px-4 py-2 text-warm-500 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lab.results.map((result, idx) => (
                          <tr key={idx} className="border-t border-sand/50">
                            <td className="px-4 py-2.5 text-warm-800 font-medium">{result.name}</td>
                            <td className={cn(
                              "px-4 py-2.5 text-right font-bold",
                              result.flag === "high" || result.flag === "low" ? "text-soft-red" :
                              result.flag === "critical" ? "text-red-600" : "text-warm-800"
                            )}>
                              {result.value} {result.unit && <span className="text-cloudy font-normal">{result.unit}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-cloudy">{result.reference_range}</td>
                            <td className="px-4 py-2.5 text-center">
                              {result.flag === "normal" ? (
                                <CheckCircle2 size={14} className="text-accent mx-auto" />
                              ) : (
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                                  result.flag === "critical" ? "bg-red-100 text-red-700" : "bg-soft-red/10 text-soft-red"
                                )}>
                                  {result.flag}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Notes */}
                  {lab.notes && (
                    <div className="px-4 py-3 bg-cream/30 border-t border-sand/50">
                      <div className="flex items-start gap-2">
                        <FileText size={12} className="text-terra mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-warm-600">
                            {physician?.full_name || "Doctor"}&apos;s Notes
                          </p>
                          <p className="text-xs text-warm-700 mt-0.5">{lab.notes}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* AI Insight */}
      <AIAction
        agentId="rx"
        label="Maya's Lab Analysis"
        prompt="Analyze my recent lab results and provide personalized insights. Highlight any abnormal values, trends, and specific recommendations for my conditions and medications."
        context={`Labs: ${labs.slice(0, 3).map(l => `${l.test_name} (${l.status}): ${l.results.map(r => `${r.name}=${r.value}${r.unit}${r.flag !== "normal" ? ` [${r.flag}]` : ""}`).join(", ")}`).join(" | ")}`}
        variant="inline"
        className="bg-terra/5 rounded-2xl border border-terra/10 p-4"
      />
    </div>
  )
}
