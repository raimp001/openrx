"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, FileSearch, Loader2, ShieldCheck, Sparkles, Stethoscope } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { ClinicalField, ClinicalInput, ClinicalSection, ClinicalTextarea, ChoiceChip, FieldsetCard } from "@/components/ui/clinical-forms"
import { OpsBadge, OpsMetricCard, OpsPanel } from "@/components/ui/ops-primitives"
import type { SecondOpinionResult } from "@/lib/basehealth"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn } from "@/lib/utils"

export default function SecondOpinionPage() {
  const { snapshot } = useLiveSnapshot()
  const activeConditions = snapshot.patient?.medical_history?.filter((h) => h.status !== "resolved") ?? []
  const activeMeds = snapshot.prescriptions?.filter((p) => p.status === "active") ?? []

  const [diagnosis, setDiagnosis] = useState("")
  const [currentPlan, setCurrentPlan] = useState("")
  const [symptoms, setSymptoms] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SecondOpinionResult | null>(null)

  const agreementTone = useMemo<"accent" | "gold" | "red">(() => {
    if (!result) return "gold"
    if (result.agreement === "supports-current-plan") return "accent"
    if (result.agreement === "partial-agreement") return "gold"
    return "red"
  }, [result])

  const confidenceTone = useMemo<"blue" | "gold" | "accent">(() => {
    if (!result) return "blue"
    if (result.confidence === "high") return "accent"
    if (result.confidence === "moderate") return "gold"
    return "blue"
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
        eyebrow="Plan review"
        title="Second-opinion review deck"
        description="Turn a diagnosis and treatment plan into a structured second opinion: what looks sound, what needs clarification, and which questions should go back to the treating clinician."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <OpsBadge tone="blue">{activeConditions.length} active condition{activeConditions.length === 1 ? "" : "s"}</OpsBadge>
            <OpsBadge tone="accent">{activeMeds.length} active medication{activeMeds.length === 1 ? "" : "s"}</OpsBadge>
            {result ? <OpsBadge tone={agreementTone}>{result.agreement.replaceAll("-", " ")}</OpsBadge> : null}
          </div>
        }
        actions={
          <AIAction
            agentId="second-opinion"
            label="Ask Orion"
            prompt="Review my current diagnosis and treatment plan, identify gaps, red flags, and the highest-value questions to ask my clinician next."
          />
        }
      />

      <ClinicalSection
        kicker="Review request"
        title="Give Orion the diagnosis and the current plan, not just the worry."
        description="A useful second opinion starts with the treatment plan that was actually recommended. Include medications, monitoring, next tests, and follow-up timing so the review stays anchored to reality."
        aside={
          <div className="space-y-3">
            <div className="eyebrow-pill">How to use this</div>
            <p className="text-sm leading-6 text-secondary">
              This is for structured review, not emergency triage. Use it to pressure-test the current plan before the next clinical visit.
            </p>
            <div className="grid gap-3 pt-1">
              <div className="rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-white/88 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Best inputs</p>
                <p className="mt-2 text-sm font-semibold text-primary">Diagnosis + plan + symptoms</p>
                <p className="mt-1 text-[12px] leading-6 text-secondary">The more specific the plan, the stronger the review.</p>
              </div>
              <div className="rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-white/88 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Output</p>
                <p className="mt-2 text-sm font-semibold text-primary">Questions, red flags, specialist cues</p>
                <p className="mt-1 text-[12px] leading-6 text-secondary">Use this as prep for the treating clinician, not a replacement.</p>
              </div>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {activeConditions.length > 0 && !diagnosis ? (
            <FieldsetCard
              legend="Quick-fill from your record"
              description="Start from an active condition, then Orion will preload the active medication list into the current plan field."
            >
              <div className="flex flex-wrap gap-2">
                {activeConditions.map((condition) => (
                  <button
                    key={condition.condition}
                    type="button"
                    onClick={() => {
                      setDiagnosis(condition.condition)
                      const meds = activeMeds.map((m) => `${m.medication_name} ${m.dosage} ${m.frequency}`).join("; ")
                      setCurrentPlan(meds ? `Current medications: ${meds}` : "")
                    }}
                  >
                    <ChoiceChip>
                      <Sparkles size={11} />
                      {condition.condition}
                    </ChoiceChip>
                  </button>
                ))}
              </div>
            </FieldsetCard>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <ClinicalField
              label="Diagnosis or concern"
              hint="Name the diagnosis or the main problem being treated."
              htmlFor="second-opinion-diagnosis"
            >
              <ClinicalInput
                id="second-opinion-diagnosis"
                value={diagnosis}
                onChange={(event) => setDiagnosis(event.target.value)}
                placeholder="Type 2 diabetes with elevated A1C"
              />
            </ClinicalField>

            <ClinicalField
              label="Additional symptoms"
              hint="Optional. Separate symptoms with commas if they matter to the treatment decision."
              optional
              htmlFor="second-opinion-symptoms"
            >
              <ClinicalInput
                id="second-opinion-symptoms"
                value={symptoms}
                onChange={(event) => setSymptoms(event.target.value)}
                placeholder="fatigue, dizziness, appetite change"
              />
            </ClinicalField>
          </div>

          <ClinicalField
            label="Current plan from the care team"
            hint="Include medications, monitoring, follow-up timing, recommended procedures, and any watchful waiting advice."
            htmlFor="second-opinion-plan"
          >
            <ClinicalTextarea
              id="second-opinion-plan"
              value={currentPlan}
              onChange={(event) => setCurrentPlan(event.target.value)}
              rows={5}
              placeholder="Continue metformin 1000 mg twice daily, repeat A1C in 3 months, start nutrition counseling, and return sooner if fasting sugars rise."
            />
          </ClinicalField>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={submitReview}
              disabled={loading || !diagnosis.trim() || !currentPlan.trim()}
              className="control-button-primary"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />}
              Generate second opinion
            </button>
            {!diagnosis.trim() || !currentPlan.trim() ? (
              <p className="text-xs leading-6 text-muted">Add both a diagnosis and the current plan before generating the review.</p>
            ) : null}
          </div>
        </div>
      </ClinicalSection>

      {result ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OpsMetricCard
              label="Review posture"
              value={result.agreement.replaceAll("-", " ")}
              detail="How closely the second opinion aligns with the current plan."
              icon={ShieldCheck}
              tone={agreementTone}
            />
            <OpsMetricCard
              label="Confidence"
              value={result.confidence}
              detail="Confidence in the review given the information supplied."
              icon={Stethoscope}
              tone={confidenceTone}
            />
            <OpsMetricCard
              label="Red flags"
              value={`${result.redFlags.length}`}
              detail="Safety issues or reasons to escalate quickly."
              icon={AlertTriangle}
              tone={result.redFlags.length ? "red" : "accent"}
            />
            <OpsMetricCard
              label="Questions to ask"
              value={`${result.keyQuestions.length}`}
              detail="Specific questions to take back to the treating clinician."
              icon={FileSearch}
              tone="blue"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr_0.85fr]">
            <div className="overflow-hidden rounded-[28px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_58%,#173B83_100%)] p-5 text-white shadow-[0_18px_40px_rgba(8,24,46,0.16)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/56">Review outcome</p>
                  <h2 className="mt-4 max-w-xl font-serif text-[2.15rem] leading-[0.96] text-white">
                    {result.agreement === "supports-current-plan"
                      ? "Current plan broadly holds up."
                      : result.agreement === "partial-agreement"
                        ? "Plan is directionally sound, but incomplete."
                        : "This plan needs clinician review."}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-white/72">{result.summary}</p>
                </div>
                <OpsBadge tone={agreementTone} className="!border-white/12 !bg-white/10 !text-white">
                  {result.agreement.replaceAll("-", " ")}
                </OpsBadge>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/12 bg-white/8 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Confidence</p>
                  <p className="mt-2 text-lg font-semibold text-white capitalize">{result.confidence}</p>
                  <p className="mt-1 text-[12px] leading-6 text-white/64">Confidence reflects the specificity of the diagnosis and the treatment details you provided.</p>
                </div>
                <div className="rounded-[22px] border border-white/12 bg-white/8 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Immediate priority</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {result.redFlags.length
                      ? "Start with safety flags"
                      : result.keyQuestions.length
                        ? "Bring back targeted questions"
                        : "Review specialist options"}
                  </p>
                  <p className="mt-1 text-[12px] leading-6 text-white/64">
                    {result.redFlags.length
                      ? "The first job is closing the safety gap before debating smaller treatment details."
                      : result.keyQuestions.length
                        ? "Use the questions list to tighten the plan with the treating clinician."
                        : "If the review is stable, use specialist suggestions to decide whether broader expertise is needed."}
                  </p>
                </div>
              </div>
            </div>
            <SecondOpinionBriefCard
              eyebrow="Safety flags"
              title={`${result.redFlags.length} flagged`}
              detail={result.redFlags.length ? "These issues deserve direct clarification with the treating team." : "No specific red flags were surfaced from the current plan review."}
              tone={result.redFlags.length ? "red" : "accent"}
            />
            <SecondOpinionBriefCard
              eyebrow="Specialist cues"
              title={`${result.specialistSuggestions.length} suggested`}
              detail={result.specialistSuggestions.length ? result.specialistSuggestions.slice(0, 2).join(", ") : "No additional specialist input was suggested from the current review."}
              tone={result.specialistSuggestions.length ? "gold" : "accent"}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <OpsPanel
              eyebrow="Questions"
              title="Take these back to the clinician"
              description="The point is not to challenge for the sake of it. The point is to surface the plan details that are easiest to leave vague."
            >
              <div className="space-y-3">
                {result.keyQuestions.map((question) => (
                  <div key={question} className="surface-muted px-4 py-4 text-sm leading-7 text-secondary">
                    {question}
                  </div>
                ))}
              </div>
            </OpsPanel>

            <OpsPanel
              eyebrow="Alternatives"
              title="Other considerations"
              description="These are not final recommendations. They are alternative angles or missing pieces worth discussing before the plan is locked in."
            >
              <div className="space-y-3">
                {result.alternativeConsiderations.map((item) => (
                  <div key={item} className="surface-muted px-4 py-4 text-sm leading-7 text-secondary">
                    {item}
                  </div>
                ))}
              </div>
            </OpsPanel>

            <OpsPanel
              eyebrow="Safety"
              title="Risk and urgency"
              description="If safety flags are present, that outranks plan optimization."
            >
              {result.redFlags.length ? (
                <div className="space-y-3">
                  {result.redFlags.map((flag) => (
                    <div key={flag} className="rounded-[22px] border border-red-200/45 bg-[linear-gradient(180deg,rgba(255,247,246,0.96),rgba(255,239,237,0.92))] px-4 py-4 text-sm leading-7 text-secondary">
                      {flag}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="surface-muted px-5 py-8 text-sm leading-7 text-secondary">
                  No specific safety red flags were surfaced from the current plan review.
                </div>
              )}
            </OpsPanel>

            <OpsPanel
              eyebrow="Referral posture"
              title="Specialist suggestions"
              description="Use this to decide whether the current clinician team is enough or whether another specialty should weigh in."
            >
              {result.specialistSuggestions.length ? (
                <div className="space-y-3">
                  {result.specialistSuggestions.map((specialty) => (
                    <div
                      key={specialty}
                      className="rounded-[22px] border border-[rgba(47,107,255,0.14)] bg-[linear-gradient(180deg,rgba(245,249,255,0.96),rgba(238,245,255,0.92))] px-4 py-4 text-sm font-medium text-primary"
                    >
                      {specialty}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="surface-muted px-5 py-8 text-sm leading-7 text-secondary">
                  No specialist escalation was suggested from the current review.
                </div>
              )}
            </OpsPanel>
          </div>
        </>
      ) : loading ? (
        <div className="surface-card px-6 py-12 text-center">
          <Loader2 size={24} className="mx-auto mb-3 animate-spin text-teal" />
          <p className="text-sm font-medium text-primary">Generating second-opinion review...</p>
          <p className="mt-2 text-xs leading-6 text-muted">Orion is checking agreement with the current plan, safety flags, and the highest-value follow-up questions.</p>
        </div>
      ) : null}
    </div>
  )
}

function SecondOpinionBriefCard({
  eyebrow,
  title,
  detail,
  tone,
}: {
  eyebrow: string
  title: string
  detail: string
  tone: "terra" | "accent" | "blue" | "gold" | "red"
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border px-5 py-5",
        tone === "red"
          ? "border-red-200/45 bg-[linear-gradient(180deg,rgba(255,247,246,0.96),rgba(255,239,237,0.92))]"
          : tone === "gold"
            ? "border-amber-300/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.90))]"
            : tone === "blue"
              ? "border-[rgba(59,130,246,0.18)] bg-[linear-gradient(180deg,rgba(245,249,255,0.96),rgba(238,245,255,0.92))]"
              : tone === "accent"
                ? "border-[rgba(47,107,255,0.14)] bg-[linear-gradient(180deg,rgba(245,249,255,0.96),rgba(238,245,255,0.92))]"
                : "border-[rgba(47,107,255,0.14)] bg-[linear-gradient(180deg,rgba(255,248,244,0.96),rgba(255,242,237,0.92))]"
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{eyebrow}</div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-serif leading-tight text-primary">{title}</div>
          <div className="mt-2 text-sm leading-6 text-secondary">{detail}</div>
        </div>
        <OpsBadge tone={tone} className="shrink-0">
          {tone === "accent" ? "stable" : tone === "blue" ? "reference" : tone === "gold" ? "review" : tone === "red" ? "urgent" : "guide"}
        </OpsBadge>
      </div>
    </div>
  )
}
