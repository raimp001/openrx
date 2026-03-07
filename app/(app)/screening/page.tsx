"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  Activity,
  AlertTriangle,
  CreditCard,
  ExternalLink,
  HeartPulse,
  Loader2,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react"
import AIAction from "@/components/ai-action"
import { cn } from "@/lib/utils"
import type { ScreeningAssessment } from "@/lib/basehealth"
import type { CareDirectoryMatch, CareSearchType } from "@/lib/npi-care-search"
import type { ScreeningEvidenceCitation } from "@/lib/screening-evidence"
import type { ScreeningIntakeResult } from "@/lib/screening-intake"
import type { PaymentRecord } from "@/lib/payments-ledger"
import { toBaseBuilderTxUrl } from "@/lib/basebuilder/config"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useWalletIdentity } from "@/lib/wallet-context"
import { launchBaseBuilderPay } from "@/lib/basebuilder/pay"

interface LocalCareConnection {
  recommendationId: string
  recommendationName: string
  reason: string
  services: CareSearchType[]
  query: string
  riskContext: string
  ready: boolean
  clarificationQuestion?: string
  prompt: {
    id: string
    image: string
    text: string
  }
  matches: CareDirectoryMatch[]
}

type ScreeningAnalysisLevel = "preview" | "deep"

type ScreeningResponse = ScreeningAssessment & {
  localCareConnections?: LocalCareConnection[]
  evidenceCitations?: ScreeningEvidenceCitation[]
  accessLevel?: ScreeningAnalysisLevel
  isPreview?: boolean
  upgradeMessage?: string
  requiresPayment?: boolean
  fee?: string
  currency?: string
  recipientAddress?: string
  error?: string
}

type ScreeningIntakeResponse = ScreeningIntakeResult & {
  error?: string
}

function formatWallet(address?: string): string {
  if (!address) return ""
  if (address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function isBaseTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim())
}

function toAgeFromDob(value?: string): string {
  if (!value) return ""
  const dob = new Date(value)
  if (Number.isNaN(dob.getTime())) return ""
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1
  }
  return age > 0 ? String(age) : ""
}

export default function ScreeningPage() {
  const { snapshot } = useLiveSnapshot()
  const { walletAddress, isConnected, profile } = useWalletIdentity()
  const [assessment, setAssessment] = useState<ScreeningResponse | null>(null)
  const [localCareConnections, setLocalCareConnections] = useState<LocalCareConnection[]>([])
  const [evidenceCitations, setEvidenceCitations] = useState<ScreeningEvidenceCitation[]>([])
  const [running, setRunning] = useState(false)
  const [age, setAge] = useState("")
  const [symptoms, setSymptoms] = useState("")
  const [familyHistory, setFamilyHistory] = useState("")
  const [conditions, setConditions] = useState("")
  const [bmi, setBmi] = useState("")
  const [showManualFields, setShowManualFields] = useState(false)
  const [smoker, setSmoker] = useState(false)
  const [smokerTouched, setSmokerTouched] = useState(false)
  const [narrative, setNarrative] = useState("")
  const [intakeFeedback, setIntakeFeedback] = useState("")

  const [paymentIntent, setPaymentIntent] = useState<PaymentRecord | null>(null)
  const [paymentId, setPaymentId] = useState("")
  const [verifyTxHash, setVerifyTxHash] = useState("")
  const [fee, setFee] = useState("0.50")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [showPaymentGate, setShowPaymentGate] = useState(false)
  const [paymentReady, setPaymentReady] = useState(false)
  const [creatingIntent, setCreatingIntent] = useState(false)
  const [launchingPay, setLaunchingPay] = useState(false)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
  const [error, setError] = useState("")

  const riskStyle = useMemo(() => {
    if (!assessment) return "bg-sand text-warm-500"
    if (assessment.riskTier === "high") return "bg-soft-red/10 text-soft-red"
    if (assessment.riskTier === "moderate") return "bg-yellow-200/20 text-yellow-500"
    return "bg-accent/10 text-accent"
  }, [assessment])

  const riskBarStyle = useMemo(() => {
    if (!assessment) return "bg-sand"
    if (assessment.riskTier === "high") return "bg-soft-red"
    if (assessment.riskTier === "moderate") return "bg-yellow-500"
    return "bg-accent"
  }, [assessment])

  const promptImage = useMemo(
    () => localCareConnections.find((connection) => connection.prompt?.image)?.prompt.image || "",
    [localCareConnections]
  )
  const accessLevel: ScreeningAnalysisLevel = assessment?.accessLevel === "deep" ? "deep" : "preview"
  const showingDeepResults = accessLevel === "deep"
  const paymentGateVisible = showPaymentGate
  const connectedWalletLabel = useMemo(() => formatWallet(walletAddress), [walletAddress])
  const connectedPatientName = useMemo(
    () => profile?.fullName || snapshot.patient?.full_name || "",
    [profile?.fullName, snapshot.patient?.full_name]
  )
  const screeningTxUrl = useMemo(() => {
    if (!isBaseTxHash(verifyTxHash)) return ""
    return toBaseBuilderTxUrl(verifyTxHash.trim())
  }, [verifyTxHash])

  useEffect(() => {
    if (!walletAddress) return
    if (!age) {
      const inferredAge = toAgeFromDob(profile?.dateOfBirth || snapshot.patient?.date_of_birth)
      if (inferredAge) setAge(inferredAge)
    }
    if (!conditions) {
      const fromProfile = (profile?.medicalHistory || [])
        .map((item) => item.condition?.trim())
        .filter((item): item is string => !!item)
      const fromSnapshot = (snapshot.patient?.medical_history || [])
        .map((item) => item.condition?.trim())
        .filter((item): item is string => !!item)
      const combined = Array.from(new Set([...fromProfile, ...fromSnapshot]))
      if (combined.length > 0) {
        setConditions(combined.join(", "))
      }
    }
  }, [
    walletAddress,
    profile?.dateOfBirth,
    profile?.medicalHistory,
    snapshot.patient?.date_of_birth,
    snapshot.patient?.medical_history,
    age,
    conditions,
  ])

  useEffect(() => {
    setPaymentIntent(null)
    setPaymentId("")
    setVerifyTxHash("")
    setPaymentReady(false)
    setShowPaymentGate(false)
  }, [walletAddress])

  function applyPaymentRequired(data: ScreeningResponse) {
    setPaymentReady(false)
    setShowPaymentGate(true)
    if (data.fee) setFee(data.fee)
    if (data.recipientAddress) setRecipientAddress(data.recipientAddress)
    setError(data.error || "Payment is required before personalized recommendations are generated.")
  }

  async function ensureScreeningPaymentIntent(): Promise<PaymentRecord | null> {
    if (paymentIntent && paymentId) {
      return paymentIntent
    }
    if (!walletAddress) {
      setError("Connect your wallet before starting Base Pay.")
      return null
    }

    setCreatingIntent(true)
    setShowPaymentGate(true)
    setError("")
    try {
      const response = await fetch("/api/screening/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      })
      const data = (await response.json()) as {
        error?: string
        payment?: PaymentRecord
        fee?: string
        recipientAddress?: string
      }
      if (!response.ok || data.error || !data.payment) {
        throw new Error(data.error || "Failed to create screening payment intent.")
      }

      setPaymentIntent(data.payment)
      setPaymentId(data.payment.id)
      setFee(data.fee || fee)
      setRecipientAddress(data.recipientAddress || data.payment.recipientAddress)
      setVerifyTxHash("")
      setPaymentReady(false)
      return data.payment
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to create screening payment intent.")
      return null
    } finally {
      setCreatingIntent(false)
    }
  }

  async function openDeepDiveCheckout() {
    if (!walletAddress) {
      setShowPaymentGate(true)
      setError("Connect your wallet to unlock the paid deep-dive recommendation.")
      return
    }
    setShowPaymentGate(true)
    await ensureScreeningPaymentIntent()
  }

  async function launchBasePay() {
    const intent = paymentIntent || (await ensureScreeningPaymentIntent())
    if (!intent) return

    setLaunchingPay(true)
    setError("")
    try {
      const result = await launchBaseBuilderPay({
        amount: intent.expectedAmount,
        recipientAddress: intent.recipientAddress,
      })
      setVerifyTxHash(result.paymentId)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to launch Base Pay.")
    } finally {
      setLaunchingPay(false)
    }
  }

  async function verifyScreeningPayment() {
    if (!walletAddress) {
      setError("Connect your wallet before verification.")
      return
    }
    const intent = paymentIntent || (await ensureScreeningPaymentIntent())
    const resolvedPaymentId = paymentId || intent?.id
    if (!intent || !resolvedPaymentId) {
      setError("Start Base Pay first so I can verify the payment.")
      return
    }
    if (!verifyTxHash.trim()) {
      setError("Paste a transaction hash to verify payment.")
      return
    }

    setVerifyingPayment(true)
    setError("")
    try {
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: resolvedPaymentId,
          txHash: verifyTxHash.trim(),
          walletAddress,
          expectedAmount: intent.expectedAmount,
          expectedRecipient: intent.recipientAddress,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok || data.error) {
        throw new Error(data.error || "Payment verification failed.")
      }
      setPaymentId(resolvedPaymentId)
      setPaymentReady(true)
    } catch (issue) {
      setPaymentReady(false)
      setError(issue instanceof Error ? issue.message : "Payment verification failed.")
    } finally {
      setVerifyingPayment(false)
    }
  }

  function parseTerms(value: string): string[] {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }

  function parseOptionalNumber(value: string): number | undefined {
    if (!value.trim()) return undefined
    const numeric = Number(value.trim())
    return Number.isFinite(numeric) ? numeric : undefined
  }

  function appendNarrativeHint(text: string) {
    setNarrative((current) => {
      const trimmed = current.trim()
      if (!trimmed) return text
      const separator = /[.!?]$/.test(trimmed) ? " " : ". "
      return `${trimmed}${separator}${text}`
    })
  }

  async function parseNarrativeIntakeIfPresent(): Promise<ScreeningIntakeResult["extracted"] | null> {
    if (!narrative.trim()) {
      setIntakeFeedback("")
      return null
    }

    try {
      const response = await fetch("/api/screening/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative }),
      })
      const data = (await response.json()) as ScreeningIntakeResponse
      if (!response.ok || data.error) {
        throw new Error(data.error || "Could not parse screening history.")
      }
      const inheritedRiskDetected = [...(data.extracted.familyHistory || []), ...(data.extracted.conditions || [])]
        .some((item) => /\b(brca|lynch|apc|mutyh|germline|prostate|colon|colorectal|polyposis)\b/i.test(item))
      setIntakeFeedback(
        data.ready
          ? inheritedRiskDetected
            ? "Captured inherited-risk details from your message and will personalize accordingly."
            : "History captured from your message."
          : data.clarificationQuestion ||
            "Parsed what you shared. You can still continue, or add one more risk detail for better precision."
      )
      return data.extracted
    } catch {
      setIntakeFeedback("Could not auto-parse that message. You can still continue with what was entered.")
      return null
    }
  }

  async function runScreening(level: ScreeningAnalysisLevel) {
    if (level === "deep" && !walletAddress) {
      setShowPaymentGate(true)
      setError("Connect your wallet to unlock the paid deep-dive recommendation.")
      return
    }

    if (level === "deep" && (!paymentReady || !paymentId)) {
      await openDeepDiveCheckout()
      setError("Complete Base Pay verification to release deep personalized/genetics recommendations.")
      return
    }

    setRunning(true)
    setError("")
    try {
      const extracted = await parseNarrativeIntakeIfPresent()
      const manualSymptoms = parseTerms(symptoms)
      const manualFamilyHistory = parseTerms(familyHistory)
      const manualConditions = parseTerms(conditions)

      const resolvedAge = parseOptionalNumber(age) ?? extracted?.age
      const resolvedBmi = parseOptionalNumber(bmi) ?? extracted?.bmi
      const resolvedSmoker = smokerTouched ? smoker : extracted?.smoker ?? smoker
      const resolvedSymptoms = manualSymptoms.length > 0 ? manualSymptoms : extracted?.symptoms || []
      const resolvedFamilyHistory =
        manualFamilyHistory.length > 0 ? manualFamilyHistory : extracted?.familyHistory || []
      const resolvedConditions = manualConditions.length > 0 ? manualConditions : extracted?.conditions || []

      const response = await fetch("/api/screening/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: snapshot.patient?.id,
          walletAddress,
          paymentId: level === "deep" ? paymentId : undefined,
          analysisLevel: level,
          age: resolvedAge,
          bmi: resolvedBmi,
          smoker: resolvedSmoker,
          symptoms: resolvedSymptoms,
          familyHistory: resolvedFamilyHistory,
          conditions: resolvedConditions,
        }),
      })

      const data = (await response.json()) as ScreeningResponse
      if (response.status === 402 || data.requiresPayment) {
        applyPaymentRequired(data)
        return
      }
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to compute screening assessment.")
      }

      setAssessment(data)
      setLocalCareConnections(data.localCareConnections || [])
      setEvidenceCitations(data.evidenceCitations || [])
      if (data.accessLevel === "deep") {
        setShowPaymentGate(false)
      }
    } catch (issue) {
      const message = issue instanceof Error ? issue.message : ""
      if (!message || message.toLowerCase().includes("failed to compute screening assessment")) {
        setError(
          "Couldn’t generate recommendations yet. Try a short summary like: 'I am 58, father had prostate cancer at 52, BRCA2 mutation, former smoker.'"
        )
      } else {
        setError(message)
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif text-warm-800">AI Health Screening</h1>
          <p className="text-sm text-warm-500 mt-1">
            Tell your history in plain language once. The app extracts details and personalizes screening.
          </p>
        </div>
        <AIAction
          agentId="screening"
          label="Explain My Risk"
          prompt="Summarize my screening risk score, key drivers, evidence links, and what I should do first."
        />
      </div>

      <div className="bg-terra/10 rounded-2xl border border-terra/20 p-4 flex items-start gap-3">
        <HeartPulse size={18} className="text-terra shrink-0 mt-0.5" />
        <p className="text-xs text-warm-600 leading-relaxed">
          Free mode gives baseline preventive guidance. Deep mode adds inherited-risk personalization (for example germline
          mutations or family prostate/colorectal/polyposis history), evidence synthesis, and nearby care routing after
          verified Base Pay ({fee} USDC).
        </p>
      </div>

      {!isConnected && (
        <div className="bg-yellow-100/20 border border-yellow-300/30 rounded-xl p-3 text-xs text-warm-600">
          Connect a wallet when you are ready to unlock paid deep-dive screening.
        </div>
      )}

      {error && (
        <div className="bg-soft-red/5 border border-soft-red/20 rounded-xl p-3 text-xs text-soft-red">
          {error}
        </div>
      )}

      {paymentGateVisible && (
        <div className="bg-pampas rounded-2xl border border-sand p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className="text-terra" />
              <h2 className="text-sm font-bold text-warm-800">Complete Base Pay Before Deep Recommendation</h2>
            </div>
            <button
              onClick={() => setShowPaymentGate(false)}
              className="text-[11px] font-semibold text-warm-500 hover:text-terra transition"
            >
              Not now
            </button>
          </div>

          <div className="rounded-xl border border-sand/70 bg-cream/30 p-3 text-xs text-warm-600 space-y-1">
            <p>
              <span className="font-semibold text-warm-800">Account:</span>{" "}
              {connectedPatientName
                ? `${connectedPatientName} · ${connectedWalletLabel || "wallet pending"}`
                : connectedWalletLabel || "Connect wallet"}
            </p>
            <p>
              <span className="font-semibold text-warm-800">Fee:</span> {fee} USDC
            </p>
            <p className="break-all">
              <span className="font-semibold text-warm-800">Recipient:</span>{" "}
              {recipientAddress || "Preparing recipient..."}
            </p>
            {paymentIntent && (
              <p>
                <span className="font-semibold text-warm-800">Payment ID:</span> {paymentIntent.id}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <button
              onClick={() => void launchBasePay()}
              disabled={!walletAddress || launchingPay || creatingIntent}
              className="w-full px-3 py-2 rounded-lg border border-sand text-xs font-semibold text-warm-700 hover:border-terra/30 transition disabled:opacity-60"
            >
              {creatingIntent
                ? "Preparing payment..."
                : launchingPay
                ? "Launching Base Pay..."
                : `Launch Base Pay (${fee} USDC)`}
            </button>
            <div className="space-y-2">
              <input
                value={verifyTxHash}
                onChange={(event) => setVerifyTxHash(event.target.value)}
                placeholder="Transaction hash (auto-filled after launch)"
                className="w-full px-3 py-2 rounded-lg border border-sand bg-cream/30 text-xs text-warm-800 focus:outline-none focus:border-terra/40"
              />
              {screeningTxUrl && (
                <a
                  href={screeningTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-terra hover:text-terra-dark"
                >
                  View on BaseScan <ExternalLink size={11} />
                </a>
              )}
              <button
                onClick={() => void verifyScreeningPayment()}
                disabled={!walletAddress || verifyingPayment}
                className="w-full px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-60"
              >
                {verifyingPayment ? "Verifying payment..." : "Verify Payment"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {paymentReady ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent uppercase">
                Payment verified
              </span>
            ) : (
              <span className="text-[11px] text-cloudy">
                Deep recommendations are released only after verified Base Pay settlement.
              </span>
            )}
          </div>

          {paymentReady && (
            <button
              onClick={() => void runScreening("deep")}
              disabled={running}
              className="w-full px-3 py-2 rounded-lg bg-terra text-white text-xs font-semibold hover:bg-terra-dark transition disabled:opacity-60"
            >
              {running ? "Generating deep recommendation..." : "Release Deep Recommendation"}
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-pampas rounded-2xl border border-sand p-5">
          <h2 className="text-sm font-bold text-warm-800 mb-3">Simple Screening Intake</h2>
          <div className="rounded-xl border border-sand/70 bg-cream/30 p-3 mb-3 space-y-2">
            <label className="text-xs text-warm-600 block">
              Tell us your history in plain English
              <textarea
                value={narrative}
                onChange={(event) => setNarrative(event.target.value)}
                rows={4}
                placeholder="Example: I am 58, father had prostate cancer at 52, BRCA2 germline mutation, former smoker."
                className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-pampas text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40 resize-y"
              />
            </label>
            <p className="text-[11px] text-warm-500">
              One sentence is enough. We auto-parse age, symptoms, inherited-risk clues, and known mutations.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "Father had prostate cancer at 52.",
                "Family history of colorectal cancer.",
                "Known BRCA2 germline mutation.",
                "Polyposis disorder in family.",
              ].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => appendNarrativeHint(hint)}
                  className="rounded-full border border-sand px-2.5 py-1 text-[10px] font-semibold text-warm-600 hover:border-terra/30 hover:text-terra transition"
                >
                  + {hint}
                </button>
              ))}
            </div>
            {intakeFeedback && <p className="text-[11px] text-warm-500">{intakeFeedback}</p>}
          </div>

          <div className="rounded-xl border border-sand/70 bg-cream/20 p-3">
            <button
              type="button"
              onClick={() => setShowManualFields((value) => !value)}
              className="text-xs font-semibold text-warm-700 hover:text-terra transition"
            >
              {showManualFields ? "Hide optional manual fields" : "Add optional manual details"}
            </button>
            {showManualFields && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <label className="text-xs text-warm-600">
                  Age (optional)
                  <input
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    inputMode="numeric"
                    placeholder="58"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/30 text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40"
                  />
                </label>
                <label className="text-xs text-warm-600">
                  Symptoms (comma separated)
                  <input
                    value={symptoms}
                    onChange={(event) => setSymptoms(event.target.value)}
                    placeholder="fatigue, abdominal pain"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/30 text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40"
                  />
                </label>
                <label className="text-xs text-warm-600">
                  Family history / inherited risk
                  <input
                    value={familyHistory}
                    onChange={(event) => setFamilyHistory(event.target.value)}
                    placeholder="father prostate cancer at 52, lynch syndrome"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/30 text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40"
                  />
                </label>
                <label className="text-xs text-warm-600">
                  Conditions / mutations
                  <input
                    value={conditions}
                    onChange={(event) => setConditions(event.target.value)}
                    placeholder="hypertension, BRCA2 mutation carrier"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/30 text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40"
                  />
                </label>
                <label className="text-xs text-warm-600">
                  BMI (optional)
                  <input
                    value={bmi}
                    onChange={(event) => setBmi(event.target.value)}
                    inputMode="decimal"
                    placeholder="29.4"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-sand bg-cream/30 text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40"
                  />
                </label>
                <label className="text-xs text-warm-600 flex items-end">
                  <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-sand bg-cream/30 text-sm text-warm-700">
                    <input
                      checked={smoker}
                      onChange={(event) => {
                        setSmoker(event.target.checked)
                        setSmokerTouched(true)
                      }}
                      type="checkbox"
                      className="accent-terra"
                    />
                    Current smoker
                  </span>
                </label>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void runScreening("preview")}
              disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terra text-white text-sm font-semibold hover:bg-terra-dark disabled:opacity-60 transition"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
              Get My Free Recommendations
            </button>
            {(assessment?.accessLevel === "preview" || paymentIntent || paymentReady) && (
              <button
                onClick={() => void runScreening("deep")}
                disabled={running || creatingIntent}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sand text-sm font-semibold text-warm-700 hover:border-terra/30 transition disabled:opacity-60"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                Generate Deep Dive (Paid)
              </button>
            )}
          </div>
          {assessment?.accessLevel === "preview" && (
            <p className="text-[11px] text-cloudy mt-2">
              {assessment.upgradeMessage ||
                "Free preview is ready. Complete Base Pay to unlock mutation-aware deep personalization."}
            </p>
          )}
          {(assessment?.accessLevel === "preview" || paymentIntent) && !paymentReady && (
            <p className="text-[11px] text-cloudy mt-1">
              Click &quot;Generate Deep Dive&quot; to open Base Pay just before release.
            </p>
          )}
        </div>

        <div className="bg-pampas rounded-2xl border border-sand p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-warm-800">Risk Snapshot</h2>
            {assessment && (
              <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full uppercase", riskStyle)}>
                {assessment.riskTier}
              </span>
            )}
          </div>
          {!assessment ? (
            <div className="h-24 flex items-center justify-center text-xs text-cloudy">
              <Wallet size={14} className="mr-2" /> Run free preview to generate baseline screening guidance.
            </div>
          ) : (
            <>
              <div className="text-3xl font-bold text-warm-800">{assessment.overallRiskScore}</div>
              <div className="text-xs text-warm-500">Overall preventive risk score</div>
              <div className="mt-3 h-2 rounded-full bg-sand/50 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", riskBarStyle)}
                  style={{ width: `${assessment.overallRiskScore}%` }}
                />
              </div>
              <div className="mt-3 space-y-1">
                {assessment.factors.slice(0, 3).map((factor) => (
                  <div
                    key={factor.label}
                    className="flex items-start justify-between text-[11px] text-warm-600"
                  >
                    <span>{factor.label}</span>
                    <span className="font-semibold">{factor.scoreDelta > 0 ? `+${factor.scoreDelta}` : factor.scoreDelta}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {assessment && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-pampas rounded-2xl border border-sand p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={14} className="text-terra" />
              <h2 className="text-sm font-bold text-warm-800">Recommended Screenings</h2>
            </div>
            <div className="space-y-2">
              {assessment.recommendedScreenings.map((rec) => (
                <div key={rec.id} className="rounded-xl border border-sand/70 bg-cream/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-warm-800">{rec.name}</p>
                    <span
                      className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase",
                        rec.priority === "high"
                          ? "bg-soft-red/10 text-soft-red"
                          : rec.priority === "medium"
                          ? "bg-yellow-100/20 text-yellow-500"
                          : "bg-accent/10 text-accent"
                      )}
                    >
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-xs text-warm-500 mt-1">{rec.reason}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-pampas rounded-2xl border border-sand p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-yellow-500" />
              <h2 className="text-sm font-bold text-warm-800">Immediate Next Actions</h2>
            </div>
            <ul className="space-y-2">
              {assessment.nextActions.map((action) => (
                <li key={action} className="text-sm text-warm-600 rounded-xl border border-sand/70 bg-cream/30 p-3">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {assessment && evidenceCitations.length > 0 && (
        <div className="bg-pampas rounded-2xl border border-sand p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-terra" />
            <h2 className="text-sm font-bold text-warm-800">Evidence Sources</h2>
          </div>
          <p className="text-xs text-warm-500">
            {showingDeepResults
              ? "Guideline and literature links supporting the deep personalized recommendation set."
              : "Free preview currently shows USPSTF guideline sources."}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {evidenceCitations.map((citation) => (
              <a
                key={citation.id}
                href={citation.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-sand/70 bg-cream/30 p-3 hover:border-terra/30 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-warm-800">{citation.title}</p>
                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-terra/10 text-terra">
                    {citation.type}
                  </span>
                </div>
                <p className="text-[11px] text-warm-500 mt-1">{citation.source}</p>
                {citation.publishedAt && <p className="text-[10px] text-cloudy mt-0.5">{citation.publishedAt}</p>}
                <p className="text-[11px] text-warm-600 mt-1">{citation.summary}</p>
                <span className="inline-flex items-center gap-1 text-[11px] text-terra font-semibold mt-2">
                  Open source <ExternalLink size={11} />
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {assessment && showingDeepResults && (
        <div className="bg-pampas rounded-2xl border border-sand p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-terra" />
            <h2 className="text-sm font-bold text-warm-800">
              Nearby Care Matches For This Screening
            </h2>
          </div>
          <p className="text-xs text-warm-500">
            Personalized matches use your risk profile, recommendation priority, and address to run natural-language NPI search.
          </p>

          {promptImage && (
            <div className="rounded-xl overflow-hidden border border-sand/70">
              <Image
                src={promptImage}
                width={1400}
                height={980}
                alt="Natural-language NPI screening prompt"
                className="w-full h-auto"
              />
            </div>
          )}

          <div className="space-y-3">
            {localCareConnections.map((connection) => (
              <div
                key={connection.recommendationId}
                className="rounded-xl border border-sand/70 bg-cream/30 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-warm-800">
                    {connection.recommendationName}
                  </p>
                  {connection.services.map((service) => (
                    <span
                      key={`${connection.recommendationId}-${service}`}
                      className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-terra/10 text-terra"
                    >
                      {service}
                    </span>
                  ))}
                </div>

                <p className="text-xs text-warm-500 mt-1">{connection.reason}</p>
                <p className="text-[10px] text-cloudy mt-1">{connection.riskContext}</p>
                <p className="text-[10px] font-mono text-terra mt-2">{connection.query}</p>

                {!connection.ready && (
                  <p className="text-xs text-yellow-500 mt-2">
                    {connection.clarificationQuestion || "Missing location/service details for nearby search."}
                  </p>
                )}

                {connection.ready && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    {connection.matches.slice(0, 6).map((match) => (
                      <div
                        key={`${connection.recommendationId}-${match.kind}-${match.npi}`}
                        className="rounded-lg border border-sand/60 bg-pampas p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-warm-800">{match.name}</p>
                          <span className="text-[9px] uppercase px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold">
                            {match.kind}
                          </span>
                        </div>
                        <p className="text-[11px] text-terra mt-1">{match.specialty || "General"}</p>
                        <p className="text-[11px] text-warm-500 mt-1 flex items-start gap-1">
                          <MapPin size={11} className="mt-0.5 shrink-0" />
                          {match.fullAddress}
                        </p>
                        {match.phone && (
                          <p className="text-[11px] text-warm-500 mt-1 flex items-center gap-1">
                            <Phone size={11} />
                            {match.phone}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
