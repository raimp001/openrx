"use client"

/**
 * PA Appeal Modal — OpenRx
 * Full appeal workflow: generate letter → preview → copy/download
 * Uses /api/pa/appeal (Claude Opus 4.6 with adaptive thinking)
 */

import { useState } from "react"
import {
  X, Send, Copy, Check, AlertTriangle, BookOpen,
  RefreshCw, CheckCircle2, ChevronRight, FileText,
  ExternalLink, Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { LivePriorAuth } from "@/lib/live-data-types"

interface AppealModalProps {
  pa: LivePriorAuth
  patientName: string
  physicianName?: string
  onClose: () => void
}

type Step = "form" | "generating" | "result"

interface AppealResult {
  success: boolean
  appealContent: string
  sections?: Record<string, string>
  model: string
  metadata?: {
    appealDeadline: string
    appealType: string
    generatedAt: string
  }
  evaluation?: {
    score: number
    recommendations: string[]
  }
}

export default function PAAppealModal({ pa, patientName, physicianName, onClose }: AppealModalProps) {
  const [step, setStep] = useState<Step>("form")
  const [appealType, setAppealType] = useState<"standard" | "expedited">("standard")
  const [includeP2P, setIncludeP2P] = useState(true)
  const [additionalNotes, setAdditionalNotes] = useState("")
  const [result, setResult] = useState<AppealResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [activeSection, setActiveSection] = useState<string>("APPEAL LETTER")

  const sections = result?.sections ? Object.keys(result.sections) : []

  async function generateAppeal() {
    setStep("generating")
    try {
      const res = await fetch("/api/pa/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          payer: pa.insurance_provider,
          procedureCode: pa.procedure_code,
          procedureName: pa.procedure_name,
          icdCodes: pa.icd_codes,
          denialReason: pa.denial_reason ?? "Medical necessity not established",
          referenceNumber: pa.reference_number,
          physicianName: physicianName,
          clinicalNotes: pa.clinical_notes,
          appealType,
          includeP2PRequest: includeP2P,
          priorTherapies: [],
          ...(additionalNotes && { clinicalNotes: `${pa.clinical_notes}\n\nAdditional context: ${additionalNotes}` }),
        }),
      })
      const data = await res.json() as AppealResult
      setResult(data)
      if (data.sections && Object.keys(data.sections).length > 0) {
        setActiveSection(Object.keys(data.sections)[0])
      }
      setStep("result")
    } catch {
      setResult({
        success: false,
        appealContent: "Failed to generate appeal. Please check your ANTHROPIC_API_KEY and try again.",
        model: "error",
      })
      setStep("result")
    }
  }

  async function copyToClipboard() {
    const text = result?.sections?.[activeSection] ?? result?.appealContent ?? ""
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadLetter() {
    const text = result?.appealContent ?? ""
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `appeal-${pa.procedure_code}-${pa.insurance_provider.replace(/\s/g, "-")}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-warm-900/20 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[30px] border border-sand/80 bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(244,237,226,0.96))] shadow-[0_28px_60px_rgba(17,34,30,0.16)]">
        {/* Header */}
        <div className="shrink-0 border-b border-sand/70 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-soft-red/20 bg-soft-red/10">
                <FileText size={16} className="text-soft-red" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cloudy">Prior auth appeal</p>
                <h2 className="mt-1 text-[1.45rem] text-warm-800">Generate a payer-ready appeal package</h2>
                <p className="mt-1 text-[12px] text-warm-500">
                  {pa.procedure_name} · {pa.insurance_provider}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-sand/80 bg-white/72 p-2 text-warm-400 transition hover:border-terra/20 hover:text-warm-700"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="metric-chip">{patientName}</span>
            <span className="metric-chip">{pa.procedure_code}</span>
            <span className="metric-chip">Ref {pa.reference_number}</span>
            {physicianName ? <span className="metric-chip">{physicianName}</span> : null}
          </div>
        </div>

        {/* Denial reason banner */}
        {pa.denial_reason && (
          <div className="mx-5 mt-4 flex shrink-0 items-start gap-2 rounded-[24px] border border-soft-red/20 bg-soft-red/6 p-4">
            <AlertTriangle size={13} className="text-soft-red shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-soft-red">Denial Reason</p>
              <p className="mt-1 text-xs leading-6 text-red-800/80">{pa.denial_reason}</p>
            </div>
          </div>
        )}

        {/* ── Step: Form ── */}
        {step === "form" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Appeal type */}
            <div className="rounded-[24px] border border-sand/75 bg-white/72 p-4">
              <label className="mb-2 block text-xs font-bold text-warm-700">Appeal Type</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "standard" as const, label: "Standard Appeal", detail: "30–60 day decision", color: "text-warm-700" },
                  { value: "expedited" as const, label: "Expedited Appeal", detail: "72-hour decision (urgent)", color: "text-soft-red" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAppealType(opt.value)}
                    className={cn(
                      "rounded-[20px] border p-3 text-left transition",
                      appealType === opt.value
                        ? "border-accent/30 bg-accent/7"
                        : "border-sand/80 bg-pampas/70 hover:border-warm-300"
                    )}
                  >
                    <div className={cn("text-xs font-bold", appealType === opt.value ? "text-accent" : "text-warm-700")}>
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-warm-400 mt-0.5">{opt.detail}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* P2P option */}
            <div className="flex items-start gap-3 rounded-[24px] border border-sand/75 bg-white/72 p-4">
              <button
                onClick={() => setIncludeP2P(!includeP2P)}
                className={cn(
                  "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition",
                  includeP2P ? "bg-accent border-accent" : "border-sand"
                )}
              >
                {includeP2P && <Check size={10} className="text-white" />}
              </button>
              <div>
                <p className="text-xs font-bold text-warm-700">Include Peer-to-Peer Review Request</p>
                <p className="text-[11px] text-warm-400 mt-0.5">
                  P2P reversals run 50–70% for oncology denials. Highly recommended.
                </p>
              </div>
            </div>

            {/* Additional context */}
            <div className="rounded-[24px] border border-sand/75 bg-white/72 p-4">
              <label className="mb-1.5 block text-xs font-bold text-warm-700">
                Additional Clinical Context <span className="text-warm-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={3}
                placeholder="E.g. trial eligibility, lab values, disease burden, prior treatment dates..."
                className="w-full resize-none rounded-2xl border border-sand/80 bg-white/88 px-3 py-2 text-sm text-warm-800 placeholder:text-warm-400 focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
            </div>

            {/* What the AI will do */}
            <div className="rounded-[24px] border border-accent/15 bg-accent/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={12} className="text-accent" />
                <span className="text-xs font-bold text-accent">What the appeal engine will generate:</span>
              </div>
              <ul className="space-y-1">
                {[
                  "Formal appeal letter (physician signature block)",
                  "Clinical evidence summary with trial citations (NCCN, FDA, Phase 3 data)",
                  "Step-by-step submission instructions for " + pa.insurance_provider,
                  includeP2P ? "Peer-to-peer review request language" : null,
                ].filter(Boolean).map((item, i) => (
                  <li key={i} className="text-[11px] text-accent/80 flex items-center gap-1.5">
                    <ChevronRight size={9} className="text-accent shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => void generateAppeal()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-warm-800 py-3 text-sm font-bold text-cream transition hover:bg-warm-900"
            >
              <Send size={14} />
              Generate appeal package
            </button>
          </div>
        )}

        {/* ── Step: Generating ── */}
        {step === "generating" && (
          <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-5">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-accent/20 bg-accent/10">
                <RefreshCw size={24} className="text-accent animate-spin" />
              </div>
              <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent">
                <span className="text-[8px] font-bold text-white">AI</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-warm-800">Generating the appeal packet…</p>
              <p className="text-xs text-warm-500 mt-1">Researching {pa.procedure_name} evidence</p>
            </div>
            <div className="space-y-2 w-full max-w-xs">
              {[
                "Analyzing denial reason",
                "Pulling NCCN evidence & trial data",
                "Drafting appeal letter",
                includeP2P && "Preparing P2P request",
              ].filter(Boolean).map((label, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-warm-500">
                  <RefreshCw size={10} className="animate-spin text-accent shrink-0" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step: Result ── */}
        {step === "result" && result && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Section tabs */}
            {sections.length > 0 && (
              <div className="flex shrink-0 flex-wrap gap-1 px-5 pb-2 pt-4">
                {sections.map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setActiveSection(sec)}
                    className={cn(
                      "rounded-xl px-3 py-1 text-[10px] font-bold transition",
                      activeSection === sec
                        ? "bg-warm-800 text-cream"
                        : "bg-sand/50 text-warm-500 hover:bg-sand"
                    )}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            )}

            {/* Stats bar */}
            <div className="flex shrink-0 flex-wrap items-center gap-3 px-5 pb-3 text-[10px] text-warm-400">
              <span className="flex items-center gap-1 rounded-full border border-sand/70 bg-white/72 px-2.5 py-1">
                <CheckCircle2 size={10} className="text-accent" />
                Generated by {result.model}
              </span>
              {result.metadata?.appealDeadline && (
                <span className="flex items-center gap-1 rounded-full border border-sand/70 bg-white/72 px-2.5 py-1">
                  <Clock size={10} />
                  Deadline: {result.metadata.appealDeadline}
                </span>
              )}
              {result.evaluation?.score !== undefined && (
                <span className={cn(
                  "font-bold",
                  result.evaluation.score >= 85 ? "text-accent" : result.evaluation.score >= 60 ? "text-yellow-400" : "text-soft-red"
                )}>
                  Approval score: {result.evaluation.score}/100
                </span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <div className="rounded-[24px] border border-sand/75 bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
                <pre className="text-[11px] text-warm-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {sections.length > 0
                    ? result.sections?.[activeSection] ?? result.appealContent
                    : result.appealContent}
                </pre>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex shrink-0 items-center gap-3 border-t border-sand/70 p-4">
              <button
                onClick={() => void copyToClipboard()}
                className="flex items-center gap-2 rounded-2xl border border-sand/80 bg-white/76 px-4 py-2 text-xs font-bold text-warm-700 transition hover:bg-white hover:text-warm-900"
              >
                {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy Section"}
              </button>
              <button
                onClick={downloadLetter}
                className="flex items-center gap-2 rounded-2xl border border-sand/80 bg-white/76 px-4 py-2 text-xs font-bold text-warm-700 transition hover:bg-white hover:text-warm-900"
              >
                <ExternalLink size={13} />
                Download .txt
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setStep("form")}
                className="text-xs text-warm-400 hover:text-warm-600 transition"
              >
                Regenerate
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-2 bg-warm-800 hover:bg-warm-900 text-cream text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
