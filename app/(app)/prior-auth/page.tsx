"use client"

import { useState } from "react"
import { currentUser } from "@/lib/current-user"
import { priorAuths, getPhysician, type PriorAuth } from "@/lib/seed-data"
import { cn, formatDate } from "@/lib/utils"
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
  Zap,
  Search,
  RefreshCw,
  Activity,
  ChevronRight,
  BookOpen,
  ArrowUpRight,
  BarChart3,
} from "lucide-react"
import AIAction from "@/components/ai-action"
import PAAppealModal from "@/components/pa-appeal-modal"

type Tab = "active" | "evaluate"

interface EvalResult {
  found: boolean
  drug?: string
  drugClass?: string
  score?: number
  approvalLikelihood?: "HIGH" | "MODERATE" | "LOW"
  criteria?: {
    met: Array<{ id: string; label: string; required: boolean; evidenceLevel?: string }>
    missing: Array<{ id: string; label: string; description: string; required: boolean; evidenceLevel?: string; source?: string }>
  }
  stepTherapy?: { met: boolean; gaps: string[] }
  rems?: { required: boolean; program?: string | null }
  formulary?: { onFormulary: boolean; tier?: number; pa_required: boolean; notes?: string }
  payerOverride?: { additionalCriteria: string[]; preferredBiosimilar?: string } | null
  warnings?: string[]
  recommendations?: string[]
  guidelines?: { nccnCategory?: string; references: string[] }
  message?: string
}

interface TimelineStep {
  label: string
  sublabel?: string
  done: boolean
  active: boolean
  failed?: boolean
}

function getTimeline(pa: PriorAuth): TimelineStep[] {
  return [
    {
      label: "Submitted",
      sublabel: pa.submitted_at ? formatDate(pa.submitted_at) : undefined,
      done: !!pa.submitted_at,
      active: pa.status === "submitted" && !pa.resolved_at,
    },
    {
      label: "Received",
      sublabel: pa.submitted_at
        ? formatDate(new Date(new Date(pa.submitted_at).getTime() + 86400000).toISOString())
        : undefined,
      done: pa.status !== "submitted" || !!pa.resolved_at,
      active: pa.status === "pending",
    },
    {
      label: "Under Review",
      sublabel: pa.status === "pending" ? "Est. 3–14 business days" : undefined,
      done: pa.status === "approved" || pa.status === "denied",
      active: pa.status === "pending",
    },
    {
      label: pa.status === "denied" ? "Denied" : pa.status === "approved" ? "Approved" : "Decision",
      sublabel: pa.resolved_at
        ? formatDate(pa.resolved_at)
        : pa.status === "submitted" || pa.status === "pending"
        ? estimateDecision(pa)
        : undefined,
      done: !!pa.resolved_at,
      active: false,
      failed: pa.status === "denied",
    },
  ]
}

function estimateDecision(pa: PriorAuth): string {
  if (!pa.submitted_at) return "Pending submission"
  const submitted = new Date(pa.submitted_at)
  const est = new Date(submitted)
  est.setDate(est.getDate() + (pa.urgency === "urgent" ? 3 : 14))
  return `Est. by ${est.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
}

const likelihoodColor = (l?: string) =>
  l === "HIGH"
    ? "text-accent bg-accent/10 border-accent/20"
    : l === "MODERATE"
    ? "text-yellow-400 bg-yellow-900/20 border-yellow-700/30"
    : "text-soft-red bg-soft-red/10 border-soft-red/20"

export default function PriorAuthPage() {
  const myAuths = priorAuths.filter((pa) => pa.patient_id === currentUser.id)
  const [tab, setTab] = useState<Tab>("active")
  const [expanded, setExpanded] = useState<string | null>(myAuths[0]?.id ?? null)
  const [appealingPA, setAppealingPA] = useState<PriorAuth | null>(null)

  // Criteria check state
  const [evalDrug, setEvalDrug] = useState("")
  const [evalHcpcs, setEvalHcpcs] = useState("")
  const [evalIcd10, setEvalIcd10] = useState("")
  const [evalPriorTx, setEvalPriorTx] = useState("")
  const [evalNotes, setEvalNotes] = useState("")
  const [evalPayer, setEvalPayer] = useState("")
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null)
  const [evalLoading, setEvalLoading] = useState(false)

  const pending = myAuths.filter((p) => p.status === "pending" || p.status === "submitted")
  const approved = myAuths.filter((p) => p.status === "approved")
  const denied = myAuths.filter((p) => p.status === "denied")

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle2 size={16} className="text-accent" />
      case "denied": return <XCircle size={16} className="text-soft-red" />
      case "submitted": return <Send size={16} className="text-soft-blue" />
      default: return <Clock size={16} className="text-yellow-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: "bg-accent/10 text-accent",
      denied: "bg-soft-red/10 text-soft-red",
      submitted: "bg-soft-blue/10 text-soft-blue",
      pending: "bg-yellow-900/20 text-yellow-400",
    }
    return map[status] || "bg-sand/30 text-cloudy"
  }

  async function runEvaluation() {
    if (!evalDrug && !evalHcpcs) return
    setEvalLoading(true)
    setEvalResult(null)
    try {
      const res = await fetch("/api/pa/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drugName: evalDrug,
          hcpcsCode: evalHcpcs || undefined,
          icd10Codes: evalIcd10.split(",").map((s) => s.trim()).filter(Boolean),
          priorTherapies: evalPriorTx.split(",").map((s) => s.trim()).filter(Boolean),
          clinicalNotes: evalNotes,
          payer: evalPayer,
        }),
      })
      const data = await res.json() as EvalResult
      setEvalResult(data)
    } catch {
      setEvalResult({ found: false, message: "Evaluation service unavailable." })
    } finally {
      setEvalLoading(false)
    }
  }

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-warm-800">Prior Authorizations</h1>
          <p className="text-sm text-warm-500 mt-1">
            {myAuths.length} total &middot;{" "}
            <span className="text-yellow-400 font-medium">{pending.length} pending</span> &middot;{" "}
            <span className="text-accent font-medium">{approved.length} approved</span> &middot;{" "}
            <span className="text-soft-red font-medium">{denied.length} denied</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-warm-500 bg-sand/40 px-3 py-1.5 rounded-full border border-sand">
            <ShieldCheck size={11} className="text-accent" />
            <span>Da Vinci PAS v2.0</span>
          </div>
          <AIAction
            agentId="prior-auth"
            label="Ask Rex"
            prompt="Review all my prior authorizations. Which need urgent attention? Any denials I should appeal?"
            context={`Pending: ${pending.length}, Denied: ${denied.length}, Approved: ${approved.length}`}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-yellow-900/20 rounded-2xl border border-yellow-700/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400">Pending Review</span>
          </div>
          <div className="text-3xl font-bold text-yellow-400">{pending.length}</div>
          <div className="text-xs text-yellow-400/70 mt-1">
            {pending.filter((p) => p.urgency === "urgent").length} urgent
          </div>
        </div>
        <div className="bg-accent/5 rounded-2xl border border-accent/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-accent" />
            <span className="text-xs font-bold text-accent">Approved</span>
          </div>
          <div className="text-3xl font-bold text-accent">{approved.length}</div>
          <div className="text-xs text-accent/70 mt-1">This period</div>
        </div>
        <div className="bg-soft-red/5 rounded-2xl border border-soft-red/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={16} className="text-soft-red" />
            <span className="text-xs font-bold text-soft-red">Denied</span>
          </div>
          <div className="text-3xl font-bold text-soft-red">{denied.length}</div>
          <div className="text-xs text-soft-red/70 mt-1">Appeal eligible</div>
        </div>
        <div className="bg-pampas rounded-2xl border border-sand p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={16} className="text-warm-500" />
            <span className="text-xs font-bold text-warm-600">Approval Rate</span>
          </div>
          <div className="text-3xl font-bold text-warm-800">
            {myAuths.length > 0 ? Math.round((approved.length / myAuths.length) * 100) : 0}%
          </div>
          <div className="text-xs text-warm-500 mt-1">of {myAuths.length} total</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-sand/30 rounded-xl p-1 border border-sand w-fit">
        {([
          { id: "active" as Tab, label: "Active PAs", icon: FileText },
          { id: "evaluate" as Tab, label: "Criteria Check", icon: Zap },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === id
                ? "bg-warm-800 text-cream shadow-sm"
                : "text-warm-500 hover:text-warm-700 hover:bg-sand/50"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Active PAs ── */}
      {tab === "active" && (
        <div className="space-y-3">
          {myAuths.map((pa) => {
            const physician = getPhysician(pa.physician_id)
            const isOpen = expanded === pa.id
            const timeline = getTimeline(pa)

            return (
              <div
                key={pa.id}
                className={cn(
                  "bg-pampas rounded-2xl border transition-all",
                  pa.status === "denied" ? "border-soft-red/20" :
                  pa.urgency === "urgent" && pa.status === "pending" ? "border-yellow-600/30" :
                  "border-sand"
                )}
              >
                {/* Header row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : pa.id)}
                  className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-sand/20 transition rounded-2xl"
                >
                  <div className="mt-0.5 shrink-0">{getStatusIcon(pa.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-warm-800">{pa.procedure_name}</span>
                      <span className="text-xs text-warm-500 font-mono">CPT {pa.procedure_code}</span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide", getStatusBadge(pa.status))}>
                        {pa.status}
                      </span>
                      {pa.urgency === "urgent" && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-soft-red">
                          <AlertTriangle size={10} /> URGENT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-warm-500 mt-1">
                      {physician?.full_name} &middot; {pa.insurance_provider}
                      {pa.reference_number && <span className="font-mono"> &middot; {pa.reference_number}</span>}
                    </p>
                  </div>
                  <div className="shrink-0 text-cloudy">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-5 pb-5 space-y-5 border-t border-sand/50 pt-4">
                    {/* Timeline */}
                    <div>
                      <p className="text-[10px] font-bold text-cloudy uppercase tracking-widest mb-3">Progress</p>
                      <div className="relative flex items-start">
                        {timeline.map((step, i) => (
                          <div key={i} className="flex-1 relative">
                            {i < timeline.length - 1 && (
                              <div className={cn(
                                "absolute top-3.5 left-1/2 right-0 h-0.5",
                                step.done ? "bg-accent" : "bg-sand"
                              )} />
                            )}
                            <div className="flex flex-col items-center relative z-10">
                              <div className={cn(
                                "w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0",
                                step.failed ? "border-soft-red bg-soft-red/10" :
                                step.done ? "border-accent bg-accent/10" :
                                step.active ? "border-terra bg-terra/10 animate-pulse" :
                                "border-sand bg-cream"
                              )}>
                                {step.failed ? (
                                  <XCircle size={12} className="text-soft-red" />
                                ) : step.done ? (
                                  <CheckCircle2 size={12} className="text-accent" />
                                ) : step.active ? (
                                  <Clock size={12} className="text-terra" />
                                ) : (
                                  <div className="w-2 h-2 rounded-full bg-sand" />
                                )}
                              </div>
                              <div className="text-center mt-2 px-1">
                                <p className={cn(
                                  "text-[10px] font-bold",
                                  step.failed ? "text-soft-red" :
                                  step.done ? "text-warm-700" :
                                  step.active ? "text-terra" : "text-cloudy"
                                )}>
                                  {step.label}
                                </p>
                                {step.sublabel && (
                                  <p className="text-[9px] text-cloudy mt-0.5">{step.sublabel}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Clinical notes */}
                    <div className="bg-cream/50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-cloudy uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <FileText size={10} /> Clinical Notes
                      </p>
                      <p className="text-xs text-warm-600 leading-relaxed">{pa.clinical_notes}</p>
                      <p className="text-[10px] text-cloudy mt-1.5">ICD codes: {pa.icd_codes.join(", ")}</p>
                    </div>

                    {/* Denial reason + appeal */}
                    {pa.denial_reason && (
                      <div className="p-3 bg-soft-red/5 rounded-xl border border-soft-red/10">
                        <p className="text-[10px] font-bold text-soft-red uppercase tracking-widest mb-1.5">Denial Reason</p>
                        <p className="text-xs text-soft-red leading-relaxed">{pa.denial_reason}</p>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <button
                            onClick={() => setAppealingPA(pa)}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-soft-red hover:bg-soft-red/90 px-3 py-1.5 rounded-lg transition"
                          >
                            <FileText size={10} /> Generate Appeal Letter
                          </button>
                          <button
                            onClick={() => {
                              setTab("evaluate")
                              setEvalHcpcs(pa.procedure_code)
                              setEvalIcd10(pa.icd_codes.join(", "))
                              setEvalPayer(pa.insurance_provider)
                            }}
                            className="flex items-center gap-1.5 text-[11px] font-medium text-warm-600 hover:text-warm-800 bg-sand/50 hover:bg-sand px-2.5 py-1.5 rounded-lg border border-sand transition"
                          >
                            <Zap size={10} /> Re-evaluate Criteria
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pending actions */}
                    {(pa.status === "pending" || pa.status === "submitted") && (
                      <div className="flex gap-2 flex-wrap">
                        <AIAction
                          agentId="prior-auth"
                          label={pa.status === "pending" ? "Submit via Rex" : "Check Status"}
                          prompt={pa.status === "pending"
                            ? `Submit PA for ${pa.procedure_name} to ${pa.insurance_provider}. Reference: ${pa.reference_number}.`
                            : `Check status of PA ${pa.reference_number} with ${pa.insurance_provider}.`}
                          context={`CPT: ${pa.procedure_code}, Insurer: ${pa.insurance_provider}`}
                          variant="compact"
                        />
                        <button
                          onClick={() => {
                            setTab("evaluate")
                            setEvalHcpcs(pa.procedure_code)
                            setEvalIcd10(pa.icd_codes.join(", "))
                            setEvalPayer(pa.insurance_provider)
                          }}
                          className="flex items-center gap-1 text-[11px] font-medium text-warm-600 hover:text-warm-800 bg-sand/50 hover:bg-sand px-2.5 py-1.5 rounded-lg border border-sand transition"
                        >
                          <Activity size={10} /> Check Criteria
                        </button>
                        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-sand text-[11px] font-medium text-warm-500 hover:text-terra transition">
                          <Eye size={10} /> Track Online
                        </button>
                      </div>
                    )}

                    {/* Approved */}
                    {pa.status === "approved" && (
                      <div className="flex items-center gap-1.5 text-[11px] text-accent">
                        <CheckCircle2 size={11} />
                        <span>Approved &middot; Valid 180 days from approval date</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab: Criteria Check ── */}
      {tab === "evaluate" && (
        <div className="grid grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-pampas rounded-2xl border border-sand p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-accent" />
              <h2 className="text-sm font-bold text-warm-800">Real-Time Criteria Check</h2>
            </div>
            <p className="text-xs text-warm-500">
              Evaluate approval likelihood before submission using our structured payer rules engine (LCD/NCD + NCCN guidelines).
            </p>

            <div>
              <label className="text-xs font-bold text-warm-700 block mb-1">Drug Name</label>
              <input
                value={evalDrug}
                onChange={(e) => setEvalDrug(e.target.value)}
                placeholder="e.g. Teclistamab, Dupixent, Keytruda"
                className="w-full text-sm bg-white/50 border border-sand rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent/50 text-warm-800 placeholder:text-warm-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-warm-700 block mb-1">HCPCS/CPT Code</label>
                <input
                  value={evalHcpcs}
                  onChange={(e) => setEvalHcpcs(e.target.value)}
                  placeholder="J9269, Q2050..."
                  className="w-full text-sm bg-white/50 border border-sand rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent/50 text-warm-800 placeholder:text-warm-400 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-warm-700 block mb-1">Payer</label>
                <input
                  value={evalPayer}
                  onChange={(e) => setEvalPayer(e.target.value)}
                  placeholder="Aetna, UHC, Medicare..."
                  className="w-full text-sm bg-white/50 border border-sand rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent/50 text-warm-800 placeholder:text-warm-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-warm-700 block mb-1">ICD-10 Codes</label>
              <input
                value={evalIcd10}
                onChange={(e) => setEvalIcd10(e.target.value)}
                placeholder="C90.01, C90.02 (comma-separated)"
                className="w-full text-sm bg-white/50 border border-sand rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent/50 text-warm-800 placeholder:text-warm-400 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-warm-700 block mb-1">Prior Therapies</label>
              <input
                value={evalPriorTx}
                onChange={(e) => setEvalPriorTx(e.target.value)}
                placeholder="Bortezomib, Lenalidomide, Daratumumab..."
                className="w-full text-sm bg-white/50 border border-sand rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent/50 text-warm-800 placeholder:text-warm-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-warm-700 block mb-1">Clinical Notes (optional)</label>
              <textarea
                value={evalNotes}
                onChange={(e) => setEvalNotes(e.target.value)}
                placeholder="ECOG status, lab values, biomarkers..."
                rows={3}
                className="w-full text-sm bg-white/50 border border-sand rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent/50 text-warm-800 placeholder:text-warm-400 resize-none"
              />
            </div>

            <button
              onClick={runEvaluation}
              disabled={(!evalDrug && !evalHcpcs) || evalLoading}
              className="w-full flex items-center justify-center gap-2 bg-warm-800 hover:bg-warm-900 disabled:opacity-40 text-cream text-sm font-bold py-2.5 rounded-xl transition"
            >
              {evalLoading ? (
                <><RefreshCw size={14} className="animate-spin" /> Evaluating...</>
              ) : (
                <><Search size={14} /> Check Approval Likelihood</>
              )}
            </button>

            <p className="text-[10px] text-warm-400 text-center">
              Powered by LCD/NCD + NCCN guidelines &middot; 7 drug classes
            </p>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {!evalResult && !evalLoading && (
              <div className="bg-pampas rounded-2xl border border-sand p-8 text-center h-full flex flex-col items-center justify-center">
                <Activity size={32} className="text-warm-300 mb-3" />
                <p className="text-sm text-warm-500">Enter a drug name or HCPCS code</p>
                <p className="text-xs text-warm-400 mt-1">Supports: Teclistamab, CAR-T, Gilteritinib,</p>
                <p className="text-xs text-warm-400">Pembrolizumab, Dupilumab, Adalimumab, Semaglutide</p>
              </div>
            )}

            {evalResult && (
              <div className="space-y-4">
                {/* Score card */}
                {evalResult.found && evalResult.score !== undefined && (
                  <div className={cn(
                    "rounded-2xl border p-4",
                    evalResult.approvalLikelihood === "HIGH" ? "bg-accent/5 border-accent/15" :
                    evalResult.approvalLikelihood === "MODERATE" ? "bg-yellow-900/10 border-yellow-700/20" :
                    "bg-soft-red/5 border-soft-red/15"
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-warm-800">{evalResult.drug}</h3>
                        <p className="text-xs text-warm-500">{evalResult.drugClass?.replace(/_/g, " ")}</p>
                      </div>
                      <div className={cn("text-right px-3 py-1.5 rounded-xl border", likelihoodColor(evalResult.approvalLikelihood))}>
                        <div className="text-2xl font-bold">{evalResult.score}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wide">{evalResult.approvalLikelihood} likelihood</div>
                      </div>
                    </div>
                    <div className="h-2 bg-sand rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          evalResult.score >= 85 ? "bg-accent" : evalResult.score >= 60 ? "bg-yellow-400" : "bg-soft-red"
                        )}
                        style={{ width: `${evalResult.score}%` }}
                      />
                    </div>

                    {/* REMS warning */}
                    {evalResult.rems?.required && (
                      <div className="mt-3 flex items-start gap-2 p-2.5 bg-yellow-900/15 rounded-lg border border-yellow-700/20">
                        <AlertTriangle size={13} className="text-yellow-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold text-yellow-400">REMS Required</p>
                          <p className="text-[11px] text-yellow-400/80">{evalResult.rems.program}</p>
                        </div>
                      </div>
                    )}

                    {/* Formulary */}
                    {evalResult.formulary && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-warm-600">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold",
                          evalResult.formulary.onFormulary ? "bg-accent/10 text-accent" : "bg-soft-red/10 text-soft-red"
                        )}>
                          {evalResult.formulary.onFormulary ? `Formulary Tier ${evalResult.formulary.tier}` : "Not on formulary"}
                        </span>
                        {evalResult.formulary.notes && <span className="text-warm-400">{evalResult.formulary.notes}</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Not found */}
                {!evalResult.found && (
                  <div className="bg-pampas rounded-2xl border border-sand p-4">
                    <p className="text-sm text-warm-600">{evalResult.message}</p>
                  </div>
                )}

                {/* Criteria */}
                {evalResult.criteria && (
                  <div className="bg-pampas rounded-2xl border border-sand overflow-hidden">
                    <div className="px-4 py-2.5 bg-sand/20 border-b border-sand">
                      <h3 className="text-xs font-bold text-warm-700">Clinical Criteria</h3>
                    </div>
                    <div className="divide-y divide-sand/50">
                      {evalResult.criteria.met.map((c) => (
                        <div key={c.id} className="px-4 py-2.5 flex items-start gap-3">
                          <CheckCircle2 size={13} className="text-accent shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="text-xs text-warm-700 font-medium">{c.label}</span>
                            {c.evidenceLevel && (
                              <span className="ml-2 text-[10px] text-warm-400 bg-sand/50 px-1.5 py-0.5 rounded">Level {c.evidenceLevel}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {evalResult.criteria.missing.map((c) => (
                        <div key={c.id} className={cn("px-4 py-2.5 flex items-start gap-3", c.required ? "bg-soft-red/[0.03]" : "")}>
                          <XCircle size={13} className={cn("shrink-0 mt-0.5", c.required ? "text-soft-red" : "text-warm-400")} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-medium", c.required ? "text-soft-red" : "text-warm-500")}>{c.label}</span>
                              {c.required && <span className="text-[9px] font-bold text-soft-red bg-soft-red/10 px-1.5 py-0.5 rounded">REQUIRED</span>}
                            </div>
                            <p className="text-[11px] text-warm-500 mt-0.5">{c.description}</p>
                            {c.source && <p className="text-[10px] text-warm-400 mt-0.5 italic">Source: {c.source}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step therapy gaps */}
                {evalResult.stepTherapy && !evalResult.stepTherapy.met && (
                  <div className="bg-yellow-900/10 rounded-2xl border border-yellow-700/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={13} className="text-yellow-400" />
                      <h3 className="text-xs font-bold text-yellow-400">Step Therapy Gaps</h3>
                    </div>
                    <ul className="space-y-1.5">
                      {evalResult.stepTherapy.gaps.map((g, i) => (
                        <li key={i} className="text-xs text-yellow-300 flex items-start gap-2">
                          <ChevronRight size={11} className="shrink-0 mt-0.5" />{g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {evalResult.recommendations && evalResult.recommendations.length > 0 && (
                  <div className="bg-pampas rounded-2xl border border-sand p-4">
                    <h3 className="text-xs font-bold text-warm-700 mb-2.5 flex items-center gap-2">
                      <BookOpen size={12} /> Recommendations
                    </h3>
                    <ul className="space-y-1.5">
                      {evalResult.recommendations.map((r, i) => (
                        <li key={i} className="text-[11px] text-warm-600 flex items-start gap-2">
                          <ChevronRight size={10} className="shrink-0 mt-0.5 text-accent" />{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Guidelines */}
                {evalResult.guidelines?.references && evalResult.guidelines.references.length > 0 && (
                  <div className="bg-pampas rounded-2xl border border-sand p-4">
                    <h3 className="text-xs font-bold text-warm-700 mb-2.5">
                      Evidence Base
                      {evalResult.guidelines.nccnCategory && (
                        <span className="ml-2 text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                          NCCN Category {evalResult.guidelines.nccnCategory}
                        </span>
                      )}
                    </h3>
                    <ul className="space-y-1">
                      {evalResult.guidelines.references.map((ref, i) => (
                        <li key={i} className="text-[11px] text-warm-500 flex items-center gap-1.5">
                          <ArrowUpRight size={10} className="text-warm-400 shrink-0" />{ref}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Payer override */}
                {evalResult.payerOverride && (
                  <div className="bg-blue-900/10 rounded-2xl border border-blue-700/20 p-4">
                    <h3 className="text-xs font-bold text-blue-400 mb-2">Payer-Specific Requirements</h3>
                    {evalResult.payerOverride.preferredBiosimilar && (
                      <p className="text-xs text-blue-300 mb-1.5">
                        Preferred biosimilar: <strong>{evalResult.payerOverride.preferredBiosimilar}</strong>
                      </p>
                    )}
                    {evalResult.payerOverride.additionalCriteria.map((c, i) => (
                      <p key={i} className="text-[11px] text-blue-300 flex items-start gap-1.5">
                        <ChevronRight size={10} className="shrink-0 mt-0.5" />{c}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PA Appeal Modal */}
      {appealingPA && (
        <PAAppealModal
          pa={appealingPA}
          patientName={currentUser.full_name}
          physicianName={getPhysician(appealingPA.physician_id)?.full_name}
          onClose={() => setAppealingPA(null)}
        />
      )}
    </div>
  )
}
