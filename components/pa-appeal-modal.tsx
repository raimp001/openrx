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
import type { PriorAuth } from "@/lib/seed-data"

interface AppealModalProps {
  pa: PriorAuth
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-pampas border border-sand rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-sand shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-soft-red/10 border border-soft-red/20 flex items-center justify-center">
              <FileText size={14} className="text-soft-red" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-warm-800">Generate PA Appeal</h2>
              <p className="text-[11px] text-warm-500">
                {pa.procedure_name} &middot; {pa.insurance_provider}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-sand transition text-warm-400 hover:text-warm-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* Denial reason banner */}
        {pa.denial_reason && (
          <div className="mx-5 mt-4 p-3 bg-soft-red/5 border border-soft-red/15 rounded-xl flex items-start gap-2 shrink-0">
            <AlertTriangle size={13} className="text-soft-red shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-soft-red uppercase tracking-wide">Denial Reason</p>
              <p className="text-xs text-soft-red/80 mt-0.5">{pa.denial_reason}</p>
            </div>
          </div>
        )}

        {/* ── Step: Form ── */}
        {step === "form" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Appeal type */}
            <div>
              <label className="text-xs font-bold text-warm-700 block mb-2">Appeal Type</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "standard" as const, label: "Standard Appeal", detail: "30–60 day decision", color: "text-warm-700" },
                  { value: "expedited" as const, label: "Expedited Appeal", detail: "72-hour decision (urgent)", color: "text-soft-red" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAppealType(opt.value)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition",
                      appealType === opt.value
                        ? "border-accent bg-accent/5"
                        : "border-sand bg-white/40 hover:border-warm-300"
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
            <div className="flex items-start gap-3 p-3 bg-white/40 rounded-xl border border-sand">
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
            <div>
              <label className="text-xs font-bold text-warm-700 block mb-1.5">
                Additional Clinical Context <span className="text-warm-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={3}
                placeholder="E.g. trial eligibility, lab values, disease burden, prior treatment dates..."
                className="w-full text-sm bg-white/50 border border-sand rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent/50 text-warm-800 placeholder:text-warm-400 resize-none"
              />
            </div>

            {/* What the AI will do */}
            <div className="p-3 bg-accent/5 rounded-xl border border-accent/15">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={12} className="text-accent" />
                <span className="text-xs font-bold text-accent">What Claude Opus 4.6 will generate:</span>
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
              className="w-full flex items-center justify-center gap-2 bg-warm-800 hover:bg-warm-900 text-cream text-sm font-bold py-3 rounded-xl transition"
            >
              <Send size={14} />
              Generate Appeal with Claude Opus 4.6
            </button>
          </div>
        )}

        {/* ── Step: Generating ── */}
        {step === "generating" && (
          <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <RefreshCw size={24} className="text-accent animate-spin" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">AI</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-warm-800">Claude Opus 4.6 is working...</p>
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
              <div className="flex gap-1 px-5 pt-4 pb-2 flex-wrap shrink-0">
                {sections.map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setActiveSection(sec)}
                    className={cn(
                      "text-[10px] font-bold px-3 py-1 rounded-lg transition",
                      activeSection === sec
                        ? "bg-warm-800 text-cream"
                        : "text-warm-500 bg-sand/50 hover:bg-sand"
                    )}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            )}

            {/* Stats bar */}
            <div className="px-5 pb-2 flex items-center gap-4 text-[10px] text-warm-400 shrink-0">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={10} className="text-accent" />
                Generated by {result.model}
              </span>
              {result.metadata?.appealDeadline && (
                <span className="flex items-center gap-1">
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
              <div className="bg-white/50 border border-sand rounded-xl p-4">
                <pre className="text-[11px] text-warm-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {sections.length > 0
                    ? result.sections?.[activeSection] ?? result.appealContent
                    : result.appealContent}
                </pre>
              </div>
            </div>

            {/* Action bar */}
            <div className="p-4 border-t border-sand flex items-center gap-3 shrink-0">
              <button
                onClick={() => void copyToClipboard()}
                className="flex items-center gap-2 text-xs font-bold text-warm-700 hover:text-warm-900 bg-sand/50 hover:bg-sand px-4 py-2 rounded-xl border border-sand transition"
              >
                {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy Section"}
              </button>
              <button
                onClick={downloadLetter}
                className="flex items-center gap-2 text-xs font-bold text-warm-700 hover:text-warm-900 bg-sand/50 hover:bg-sand px-4 py-2 rounded-xl border border-sand transition"
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
