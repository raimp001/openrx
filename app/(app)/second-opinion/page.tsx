"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, FileSearch, Loader2, ShieldCheck, Sparkles, Stethoscope } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { cn } from "@/lib/utils"
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

  const agreementMeta = useMemo(() => {
    if (!result) return null
    if (result.agreement === "supports-current-plan")
      return { style: "bg-accent/10 text-accent border-accent/20", icon: CheckCircle2, label: "Supports current plan" }
    if (result.agreement === "partial-agreement")
      return { style: "bg-yellow-50 text-yellow-700 border-yellow-200/50", icon: AlertTriangle, label: "Partial agreement" }
    return { style: "bg-soft-red/10 text-soft-red border-soft-red/20", icon: AlertTriangle, label: "Concerns identified" }
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
        eyebrow="Care review"
        title="AI Second Opinion"
        description="Orion reviews your diagnosis and treatment plan, identifies gaps, and generates questions to bring to your clinician. This is not a diagnosis — it is a structured review."
        actions={
          <AIAction
            agentId="second-opinion"
            label="Ask Orion"
            prompt="Review my current diagnosis and treatment plan and identify gaps to discuss with my clinician."
          />
        }
      />

      {activeConditions.length > 0 && !diagnosis && (
        <section className="surface-card border-teal/20 bg-teal/5 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
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
                className="chip transition hover:border-teal/30 hover:text-teal"
              >
                {condition.condition}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="surface-card p-5 sm:p-6 space-y-4">
        <div>
          <p className="section-title">Review details</p>
          <p className="mt-1 text-sm text-muted">Provide the diagnosis and current treatment plan. Orion uses extended thinking for high-stakes reviews.</p>
        </div>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Diagnosis or concern</span>
          <input
            value={diagnosis}
            onChange={(event) => setDiagnosis(event.target.value)}
            placeholder="e.g. Type 2 diabetes with elevated A1C"
            className="control-input w-full"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Current plan from care team</span>
          <textarea
            value={currentPlan}
            onChange={(event) => setCurrentPlan(event.target.value)}
            rows={4}
            placeholder="e.g. Continue metformin 1000 mg twice daily, repeat A1C in 3 months, schedule nutrition follow-up."
            className="control-input w-full"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Additional symptoms <span className="normal-case tracking-normal font-normal">(optional, comma separated)</span></span>
          <input
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
            placeholder="fatigue, dizziness"
            className="control-input w-full"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={submitReview}
            disabled={loading || !diagnosis.trim() || !currentPlan.trim()}
            className="control-button-primary"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileSearch size={14} />}
            Generate Second Opinion
          </button>
          {!diagnosis.trim() && <p className="text-xs text-muted">Enter a diagnosis and treatment plan to begin.</p>}
        </div>
      </section>

      {!result && !loading && (
        <div className="surface-card py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-teal/8">
            <Stethoscope size={28} className="text-teal" />
          </div>
          <h3 className="text-lg font-serif text-primary">Structured care review</h3>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            Fill in the form above and Orion will analyze the treatment plan, flag gaps, and generate questions for your next clinician visit.
          </p>
        </div>
      )}

      {result && agreementMeta && (
        <div className="space-y-4">
          <div className="surface-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <agreementMeta.icon size={16} />
                <h2 className="text-sm font-bold text-primary">Review Outcome</h2>
              </div>
              <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border", agreementMeta.style)}>
                {agreementMeta.label}
              </span>
            </div>
            <p className="text-sm text-secondary leading-relaxed">{result.summary}</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="surface-muted px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Confidence</div>
                <div className="mt-1 text-lg font-semibold text-primary capitalize">{result.confidence}</div>
              </div>
            </div>
            {result.redFlags.length > 0 && (
              <div className="mt-4 rounded-2xl border border-soft-red/20 bg-soft-red/5 p-4">
                <div className="flex items-center gap-2 text-soft-red text-xs font-bold uppercase tracking-wide">
                  <AlertTriangle size={12} />
                  Safety Flags
                </div>
                <ul className="mt-2 space-y-1.5">
                  {result.redFlags.map((flag) => (
                    <li key={flag} className="text-sm text-secondary leading-relaxed">{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="surface-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={14} className="text-teal" />
                <h2 className="text-sm font-bold text-primary">Questions For Your Clinician</h2>
              </div>
              <ul className="space-y-2">
                {result.keyQuestions.map((question) => (
                  <li key={question} className="surface-muted p-3 text-sm text-secondary leading-relaxed">
                    {question}
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface-card p-5">
              <h2 className="text-sm font-bold text-primary mb-3">Alternative Considerations</h2>
              <ul className="space-y-2">
                {result.alternativeConsiderations.map((item) => (
                  <li key={item} className="surface-muted p-3 text-sm text-secondary leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface-card p-5 lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Stethoscope size={14} className="text-teal" />
                <h2 className="text-sm font-bold text-primary">Specialist Suggestions</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {result.specialistSuggestions.map((specialty) => (
                  <div
                    key={specialty}
                    className="rounded-2xl border border-teal/20 bg-teal/5 p-3 text-sm text-primary"
                  >
                    {specialty}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
