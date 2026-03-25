"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, FileSearch, Loader2, ShieldCheck, Stethoscope, Sparkles } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import type { SecondOpinionResult } from "@/lib/basehealth"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"

export default function SecondOpinionPage() {
  const { snapshot } = useLiveSnapshot()
  const activeConditions = snapshot.patient?.medical_history?.filter((h) => h.status !== "resolved") ?? []
  const activeMeds = snapshot.prescriptions?.filter((p) => p.status === "active") ?? []

  const [diagnosis, setDiagnosis] = useState("")
  const [currentPlan, setCurrentPlan] = useState("")
  const [symptoms, setSymptoms] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SecondOpinionResult | null>(null)

  const agreementStyle = useMemo(() => {
    if (!result) return ""
    if (result.agreement === "supports-current-plan") return "bg-accent/10 text-accent"
    if (result.agreement === "partial-agreement") return "bg-yellow-100/20 text-yellow-500"
    return "bg-soft-red/10 text-soft-red"
  }, [result])

  async function submitReview() {
    if (!diagnosis.trim() || !currentPlan.trim()) return
    setLoading(true)
    try {
      const response = await fetch("/api/second-opinion/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis,
          currentPlan,
          symptoms: symptoms
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      })
      const data = (await response.json()) as SecondOpinionResult
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        title="AI Second Opinion"
        description="Structured treatment-plan review — identify gaps and questions to bring to your clinician."
        actions={
          <AIAction
            agentId="second-opinion"
            label="Ask Orion"
            prompt="Review my current diagnosis and treatment plan and identify gaps to discuss with my clinician."
          />
        }
      />

      {/* Quick-fill from patient data */}
      {activeConditions.length > 0 && !diagnosis && (
        <div className="bg-teal/5 rounded-2xl border border-teal/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={13} className="text-teal" />
            <span className="text-xs font-bold text-primary">Quick-fill from your health record</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeConditions.map((condition) => (
              <button
                key={condition.condition}
                onClick={() => {
                  setDiagnosis(condition.condition)
                  const meds = activeMeds.map((m) => `${m.medication_name} ${m.dosage} ${m.frequency}`).join("; ")
                  setCurrentPlan(meds ? `Current medications: ${meds}` : "")
                }}
                className="text-xs px-3 py-1.5 rounded-xl border border-teal/20 bg-white text-teal hover:bg-teal/5 transition"
              >
                {condition.condition}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
        <label className="block text-xs text-secondary">
          Diagnosis or concern
          <input
            value={diagnosis}
            onChange={(event) => setDiagnosis(event.target.value)}
            placeholder="e.g. Type 2 diabetes with elevated A1C"
            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-teal/40"
          />
        </label>
        <label className="block text-xs text-secondary">
          Current plan from care team
          <textarea
            value={currentPlan}
            onChange={(event) => setCurrentPlan(event.target.value)}
            rows={4}
            placeholder="e.g. Continue metformin 1000 mg twice daily, repeat A1C in 3 months, schedule nutrition follow-up."
            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-teal/40"
          />
        </label>
        <label className="block text-xs text-secondary">
          Additional symptoms (optional, comma separated)
          <input
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
            placeholder="fatigue, dizziness"
            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-teal/40"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={submitReview}
            disabled={loading || !diagnosis.trim() || !currentPlan.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal text-white text-sm font-semibold hover:bg-teal-dark disabled:opacity-60 transition"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileSearch size={14} />}
            Generate Second Opinion
          </button>
          {!diagnosis.trim() && <p className="text-xs text-muted">Enter a diagnosis and treatment plan to begin.</p>}
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-surface rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-primary">Review Outcome</h2>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${agreementStyle}`}>
                {result.agreement.replaceAll("-", " ")}
              </span>
            </div>
            <p className="text-sm text-secondary leading-relaxed">{result.summary}</p>
            <div className="mt-3 rounded-xl border border-border/60 bg-surface/30 p-3">
              <div className="text-[11px] text-muted">Confidence</div>
              <div className="text-lg font-semibold text-primary capitalize">{result.confidence}</div>
            </div>
            {result.redFlags.length > 0 && (
              <div className="mt-3 rounded-xl border border-soft-red/20 bg-soft-red/5 p-3">
                <div className="flex items-center gap-2 text-soft-red text-xs font-semibold">
                  <AlertTriangle size={12} />
                  Safety Flags
                </div>
                <ul className="mt-2 space-y-1">
                  {result.redFlags.map((flag) => (
                    <li key={flag} className="text-xs text-secondary">
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-surface rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={14} className="text-teal" />
              <h2 className="text-sm font-bold text-primary">Questions For Your Clinician</h2>
            </div>
            <ul className="space-y-2">
              {result.keyQuestions.map((question) => (
                <li key={question} className="text-sm text-secondary rounded-xl border border-border/70 bg-surface/30 p-3">
                  {question}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-5">
            <h2 className="text-sm font-bold text-primary mb-3">Alternative Considerations</h2>
            <ul className="space-y-2">
              {result.alternativeConsiderations.map((item) => (
                <li key={item} className="text-sm text-secondary rounded-xl border border-border/70 bg-surface/30 p-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope size={14} className="text-teal" />
              <h2 className="text-sm font-bold text-primary">Specialist Suggestions</h2>
            </div>
            <div className="space-y-2">
              {result.specialistSuggestions.map((specialty) => (
                <div
                  key={specialty}
                  className="text-sm text-primary rounded-xl border border-teal/20 bg-teal/5 p-3"
                >
                  {specialty}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
