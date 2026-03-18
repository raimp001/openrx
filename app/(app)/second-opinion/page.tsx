"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, FileSearch, Loader2, ShieldCheck, Stethoscope, Sparkles } from "lucide-react"
import AIAction from "@/components/ai-action"
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif text-warm-800">AI Second Opinion</h1>
          <p className="text-sm text-warm-500 mt-1">
            Structured treatment-plan review — identify gaps and questions to bring to your clinician.
          </p>
        </div>
        <AIAction
          agentId="second-opinion"
          label="Ask Orion"
          prompt="Review my current diagnosis and treatment plan and identify gaps to discuss with my clinician."
        />
      </div>

      {/* Quick-fill from patient data */}
      {activeConditions.length > 0 && !diagnosis && (
        <div className="bg-terra/5 rounded-2xl border border-terra/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={13} className="text-terra" />
            <span className="text-xs font-bold text-warm-800">Quick-fill from your health record</span>
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
                className="text-xs px-3 py-1.5 rounded-xl border border-terra/20 bg-white text-terra hover:bg-terra/5 transition"
              >
                {condition.condition}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-pampas rounded-2xl border border-sand p-5 space-y-4">
        <label className="block text-xs text-warm-600">
          Diagnosis or concern
          <input
            value={diagnosis}
            onChange={(event) => setDiagnosis(event.target.value)}
            placeholder="e.g. Type 2 diabetes with elevated A1C"
            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-sand bg-cream/30 text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40"
          />
        </label>
        <label className="block text-xs text-warm-600">
          Current plan from care team
          <textarea
            value={currentPlan}
            onChange={(event) => setCurrentPlan(event.target.value)}
            rows={4}
            placeholder="e.g. Continue metformin 1000 mg twice daily, repeat A1C in 3 months, schedule nutrition follow-up."
            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-sand bg-cream/30 text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40"
          />
        </label>
        <label className="block text-xs text-warm-600">
          Additional symptoms (optional, comma separated)
          <input
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
            placeholder="fatigue, dizziness"
            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-sand bg-cream/30 text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={submitReview}
            disabled={loading || !diagnosis.trim() || !currentPlan.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terra text-white text-sm font-semibold hover:bg-terra-dark disabled:opacity-60 transition"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileSearch size={14} />}
            Generate Second Opinion
          </button>
          {!diagnosis.trim() && <p className="text-xs text-cloudy">Enter a diagnosis and treatment plan to begin.</p>}
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-pampas rounded-2xl border border-sand p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-warm-800">Review Outcome</h2>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${agreementStyle}`}>
                {result.agreement.replaceAll("-", " ")}
              </span>
            </div>
            <p className="text-sm text-warm-600 leading-relaxed">{result.summary}</p>
            <div className="mt-3 rounded-xl border border-sand/60 bg-cream/30 p-3">
              <div className="text-[11px] text-warm-500">Confidence</div>
              <div className="text-lg font-semibold text-warm-800 capitalize">{result.confidence}</div>
            </div>
            {result.redFlags.length > 0 && (
              <div className="mt-3 rounded-xl border border-soft-red/20 bg-soft-red/5 p-3">
                <div className="flex items-center gap-2 text-soft-red text-xs font-semibold">
                  <AlertTriangle size={12} />
                  Safety Flags
                </div>
                <ul className="mt-2 space-y-1">
                  {result.redFlags.map((flag) => (
                    <li key={flag} className="text-xs text-warm-600">
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-pampas rounded-2xl border border-sand p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={14} className="text-terra" />
              <h2 className="text-sm font-bold text-warm-800">Questions For Your Clinician</h2>
            </div>
            <ul className="space-y-2">
              {result.keyQuestions.map((question) => (
                <li key={question} className="text-sm text-warm-600 rounded-xl border border-sand/70 bg-cream/30 p-3">
                  {question}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-pampas rounded-2xl border border-sand p-5">
            <h2 className="text-sm font-bold text-warm-800 mb-3">Alternative Considerations</h2>
            <ul className="space-y-2">
              {result.alternativeConsiderations.map((item) => (
                <li key={item} className="text-sm text-warm-600 rounded-xl border border-sand/70 bg-cream/30 p-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-pampas rounded-2xl border border-sand p-5">
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope size={14} className="text-terra" />
              <h2 className="text-sm font-bold text-warm-800">Specialist Suggestions</h2>
            </div>
            <div className="space-y-2">
              {result.specialistSuggestions.map((specialty) => (
                <div
                  key={specialty}
                  className="text-sm text-warm-700 rounded-xl border border-terra/20 bg-terra/5 p-3"
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
