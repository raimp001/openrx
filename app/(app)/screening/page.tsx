"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  type LucideIcon,
} from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { BaseUsdcTransaction } from "@/components/payments/base-usdc-transaction"
import {
  ChoiceChip,
  ClinicalField,
  ClinicalInput,
  ClinicalSection,
  ClinicalTextarea,
  FieldsetCard,
} from "@/components/ui/clinical-forms"
import { cn } from "@/lib/utils"
import type { ScreeningAssessment } from "@/lib/basehealth"
import { nextStepLabel } from "@/lib/screening/recommend"
import type {
  ScreeningNextStep,
  ScreeningRecommendation as StructuredScreeningRecommendation,
} from "@/lib/screening/types"
import type { CareDirectoryMatch, CareSearchType } from "@/lib/npi-care-search"
import type { ScreeningEvidenceCitation } from "@/lib/screening-evidence"
import type { ScreeningIntakeResult } from "@/lib/screening-intake"
import type { PaymentRecord } from "@/lib/payments-ledger"
import { toBaseBuilderTxUrl } from "@/lib/basebuilder/config"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal"
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

const NARRATIVE_STARTERS = [
  "I am 58. Father had prostate cancer at 52. BRCA2 mutation carrier.",
  "I am 46 with family history of colon cancer and polyposis.",
  "I am 39, current smoker, mother had breast cancer at 44.",
  "I am 67 with diabetes, hypertension, and prior abnormal colon polyp.",
]

function FlowStep({
  step,
  title,
  description,
  icon: Icon,
}: {
  step: string
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <div className="surface-muted p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[20px] bg-teal/10 text-teal">
          <Icon size={16} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">{step}</p>
          <p className="mt-2 text-sm font-semibold text-primary">{title}</p>
          <p className="mt-1 text-sm leading-6 text-secondary">{description}</p>
        </div>
      </div>
    </div>
  )
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
  const { walletAddress, isConnected, profile, getWalletAuthHeaders } = useWalletIdentity()
  const scrollRef = useScrollReveal()
  const [assessment, setAssessment] = useState<ScreeningResponse | null>(null)
  const [localCareConnections, setLocalCareConnections] = useState<LocalCareConnection[]>([])
  const [evidenceCitations, setEvidenceCitations] = useState<ScreeningEvidenceCitation[]>([])
  const [running, setRunning] = useState(false)
  const [age, setAge] = useState("")
  const [symptoms, setSymptoms] = useState("")
  const [familyHistory, setFamilyHistory] = useState("")
  const [conditions, setConditions] = useState("")
  const [bmi, setBmi] = useState("")
  const [gender, setGender] = useState("")
  const [showManualFields, setShowManualFields] = useState(false)
  const [smoker, setSmoker] = useState(false)
  const [smokerTouched, setSmokerTouched] = useState(false)
  const [narrative, setNarrative] = useState("")
  const [intakeFeedback, setIntakeFeedback] = useState("")

  const [paymentIntent, setPaymentIntent] = useState<PaymentRecord | null>(null)
  const [paymentId, setPaymentId] = useState("")
  const [verifyTxHash, setVerifyTxHash] = useState("")
  const [nextStepStatus, setNextStepStatus] = useState<Record<string, string>>({})
  const [fee, setFee] = useState("0.50")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [showPaymentGate, setShowPaymentGate] = useState(false)
  const [paymentReady, setPaymentReady] = useState(false)
  const [creatingIntent, setCreatingIntent] = useState(false)
  const [launchingPay, setLaunchingPay] = useState(false)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
  const [error, setError] = useState("")

  const riskStyle = useMemo(() => {
    if (!assessment) return "bg-border text-muted"
    if (assessment.riskTier === "high") return "bg-soft-red/10 text-soft-red"
    if (assessment.riskTier === "moderate") return "bg-yellow-100 text-yellow-800"
    return "bg-accent/10 text-accent"
  }, [assessment])

  const riskBarStyle = useMemo(() => {
    if (!assessment) return "bg-border"
    if (assessment.riskTier === "high") return "bg-soft-red"
    if (assessment.riskTier === "moderate") return "bg-yellow-500"
    return "bg-accent"
  }, [assessment])

  const accessLevel: ScreeningAnalysisLevel = assessment?.accessLevel === "deep" ? "deep" : "preview"
  const showingDeepResults = accessLevel === "deep"
  const paymentGateVisible = showPaymentGate
  const connectedWalletLabel = useMemo(() => formatWallet(walletAddress), [walletAddress])
  const getJsonHeaders = useCallback(async () => ({
    "Content-Type": "application/json",
    ...(walletAddress ? await getWalletAuthHeaders() : {}),
  }), [getWalletAuthHeaders, walletAddress])
  const connectedPatientName = useMemo(
    () => profile?.fullName || snapshot.patient?.full_name || "",
    [profile?.fullName, snapshot.patient?.full_name]
  )
  const screeningTxUrl = useMemo(() => {
    if (!isBaseTxHash(verifyTxHash)) return ""
    return toBaseBuilderTxUrl(verifyTxHash.trim())
  }, [verifyTxHash])
  const canRunPreview =
    narrative.trim().length > 0 ||
    age.trim().length > 0 ||
    familyHistory.trim().length > 0 ||
    conditions.trim().length > 0
  const structuredRecommendations = useMemo(
    () => assessment?.structuredRecommendations || [],
    [assessment?.structuredRecommendations]
  )
  const briefRecommendationItems = useMemo(() => {
    if (!assessment) return []

    if (structuredRecommendations.length > 0) {
      return structuredRecommendations
        .filter((rec) => rec.status !== "not_due")
        .slice(0, 5)
        .map((rec) => ({
          id: rec.id,
          label: rec.screeningName,
          meta: `${rec.status.replaceAll("_", " ")} · ${rec.sourceSystem}`,
          detail: rec.patientFriendlyExplanation,
        }))
    }

    return assessment.recommendedScreenings.slice(0, 5).map((rec) => ({
      id: rec.id,
      label: rec.name,
      meta: rec.priority,
      detail: rec.reason,
    }))
  }, [assessment, structuredRecommendations])

  const urgentScreeningCount = assessment?.recommendedScreenings.filter((item) => item.priority === "high").length || 0

  useEffect(() => {
    if (!walletAddress) return
    if (!gender) {
      const inferredGender = profile?.gender || snapshot.patient?.gender || ""
      if (inferredGender) setGender(inferredGender)
    }
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
    profile?.gender,
    profile?.medicalHistory,
    snapshot.patient?.date_of_birth,
    snapshot.patient?.gender,
    snapshot.patient?.medical_history,
    age,
    conditions,
    gender,
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
      setError("Connect payment access before starting advanced review.")
      return null
    }

    setCreatingIntent(true)
    setShowPaymentGate(true)
    setError("")
    try {
      const response = await fetch("/api/screening/payment-intent", {
        method: "POST",
        headers: await getJsonHeaders(),
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
      setError("Connect payment access to unlock advanced review.")
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
      setError(issue instanceof Error ? issue.message : "Failed to launch payment.")
    } finally {
      setLaunchingPay(false)
    }
  }

  async function verifyScreeningPayment(txHashOverride?: string) {
    if (!walletAddress) {
      setError("Connect payment access before verification.")
      return
    }
    const intent = paymentIntent || (await ensureScreeningPaymentIntent())
    const resolvedPaymentId = paymentId || intent?.id
    if (!intent || !resolvedPaymentId) {
      setError("Start secure payment first so I can verify it.")
      return
    }
    const txHash = (txHashOverride || verifyTxHash).trim()
    if (!txHash) {
      setError("Paste a transaction hash to verify payment.")
      return
    }

    setVerifyingPayment(true)
    setError("")
    try {
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: await getJsonHeaders(),
        body: JSON.stringify({
          paymentId: resolvedPaymentId,
          txHash,
          walletAddress,
          expectedAmount: intent.expectedAmount,
          expectedRecipient: intent.recipientAddress,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok || data.error) {
        throw new Error(data.error || "Payment verification failed.")
      }
      setVerifyTxHash(txHash)
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
    if (!canRunPreview) {
      setError("Share one short sentence about your age and family/genetic history to start.")
      return
    }

    if (level === "deep" && !walletAddress) {
      setShowPaymentGate(true)
      setError("Connect payment access to unlock advanced review.")
      return
    }

    if (level === "deep" && (!paymentReady || !paymentId)) {
      await openDeepDiveCheckout()
      setError("Complete payment verification to release advanced inherited-risk recommendations.")
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
      const resolvedGender = gender.trim() || extracted?.gender || profile?.gender || snapshot.patient?.gender || undefined
      const resolvedBmi = parseOptionalNumber(bmi) ?? extracted?.bmi
      const resolvedSmoker = smokerTouched ? smoker : extracted?.smoker ?? smoker
      const resolvedSymptoms = manualSymptoms.length > 0 ? manualSymptoms : extracted?.symptoms || []
      const resolvedFamilyHistory =
        manualFamilyHistory.length > 0 ? manualFamilyHistory : extracted?.familyHistory || []
      const resolvedConditions = manualConditions.length > 0 ? manualConditions : extracted?.conditions || []

      const response = await fetch("/api/screening/assess", {
        method: "POST",
        headers: await getJsonHeaders(),
        body: JSON.stringify({
          patientId: snapshot.patient?.id,
          walletAddress,
          paymentId: level === "deep" ? paymentId : undefined,
          analysisLevel: level,
          age: resolvedAge,
          gender: resolvedGender,
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

  async function requestScreeningNextStep(rec: StructuredScreeningRecommendation, action: ScreeningNextStep) {
    const key = `${rec.id}:${action}`
    setNextStepStatus((current) => ({ ...current, [key]: "Sending request..." }))
    try {
      const response = await fetch("/api/screening/next-step", {
        method: "POST",
        headers: await getJsonHeaders(),
        body: JSON.stringify({
          walletAddress,
          patientId: snapshot.patient?.id,
          recommendationId: rec.id,
          screeningName: rec.screeningName,
          requestedAction: action,
          clinicianSummary: rec.clinicianSummary,
          locationZip: snapshot.patient?.address,
          demoMode: !walletAddress,
        }),
      })
      const data = (await response.json()) as { error?: string; message?: string; request?: { id: string; status: string } }
      if (!response.ok && !data.request) {
        throw new Error(data.error || "Could not create the next-step request.")
      }
      setNextStepStatus((current) => ({
        ...current,
        [key]: data.message || `Request ${data.request?.id || ""} is ${data.request?.status || "requested"}.`,
      }))
    } catch (issue) {
      setNextStepStatus((current) => ({
        ...current,
        [key]: issue instanceof Error ? issue.message : "Could not create the next-step request.",
      }))
    }
  }

  return (
    <div ref={scrollRef} className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Prevention"
        title="Check what screening is due."
        description="Start with age, history, symptoms, and location. OpenRx gives a free guideline-based plan first, then keeps the next real-world step visible."
        meta={
          <div className="flex flex-wrap gap-2">
            <span className="metric-chip">
              <Activity size={11} className="text-accent" />
              Free guideline preview
            </span>
            <span className="metric-chip">
              <ShieldCheck size={11} className="text-teal" />
              Advanced review optional
            </span>
            {recipientAddress ? (
              <span className="metric-chip">
                <Wallet size={11} className="text-soft-blue" />
                Secure payment ready
              </span>
            ) : null}
          </div>
        }
        actions={
          <AIAction
            agentId="screening"
            label="Explain My Risk"
            prompt="Summarize my screening risk score, key drivers, evidence links, and what I should do first."
          />
        }
      />

      <section className="reveal overflow-hidden rounded-[30px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_58%,#173B83_100%)] p-4 text-white shadow-[0_22px_46px_rgba(8,24,46,0.16)] md:p-5">
        <div className="mb-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/56">How this works</p>
            <h2 className="mt-4 max-w-2xl font-serif text-[2.35rem] leading-[0.96] text-white">Start with the free plan. Add inherited-risk depth only if it matters.</h2>
          </div>
          <div className="rounded-[24px] border border-white/12 bg-white/8 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Current mode</p>
            <p className="mt-2 text-sm font-semibold text-white">{showingDeepResults ? "Advanced inherited-risk review" : "Free screening plan"}</p>
            <p className="mt-2 text-[12px] leading-6 text-white/66">
              {showingDeepResults
                ? "Mutation-aware and evidence-linked recommendations are unlocked."
                : "You can generate a baseline plan without payment setup. Advanced review stays optional."}
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <FlowStep
            step="01"
            title="Tell us your story"
            description="A short sentence about age, family history, prior polyps, smoking, or mutations is enough to start."
            icon={HeartPulse}
          />
          <FlowStep
            step="02"
            title="Get the free preview"
            description="OpenRx returns an age- and history-aware baseline plan without requiring payment setup."
            icon={Activity}
          />
          <FlowStep
            step="03"
            title="Add advanced review"
            description="If inherited-risk personalization is relevant, verify payment and release the deeper recommendation."
            icon={ShieldCheck}
          />
        </div>
      </section>

      {!isConnected && (
        <div className="rounded-xl border border-yellow-300/30 bg-yellow-100/20 p-3 text-xs text-secondary">
          Payment setup is not needed for the free preview. Use advanced review only if inherited-risk depth is relevant.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-soft-red/20 bg-soft-red/5 p-3 text-xs text-soft-red">{error}</div>
      )}

      {paymentGateVisible && (
        <FieldsetCard
          legend="Advanced review access"
          description="The free preview stays open to everyone. Advanced inherited-risk recommendations require verified payment."
          className="space-y-4 border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_58%,#173B83_100%)] text-white shadow-[0_18px_38px_rgba(47,107,255,0.14)]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className="text-white" />
              <h2 className="text-sm font-bold text-white">Complete payment before advanced review</h2>
            </div>
            <button
              onClick={() => setShowPaymentGate(false)}
              className="text-[11px] font-semibold text-white/64 hover:text-white transition"
            >
              Close
            </button>
          </div>

          <div className="rounded-[22px] border border-white/12 bg-white/8 p-4 text-xs text-white/74">
            <p>
              <span className="font-semibold text-white">Account:</span>{" "}
              {connectedPatientName
                ? `${connectedPatientName} · ${connectedWalletLabel || "payment account pending"}`
                : connectedWalletLabel || "Connect payment account"}
            </p>
            <p>
              <span className="font-semibold text-white">Fee:</span> {fee} USDC
            </p>
            <p className="break-all pt-1">
              <span className="font-semibold text-white">Recipient:</span> {recipientAddress || "Preparing recipient..."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              {!paymentIntent ? (
                <button
                  onClick={() => void ensureScreeningPaymentIntent()}
                  disabled={!walletAddress || creatingIntent}
                  className="control-button-primary w-full justify-center"
                >
                  {creatingIntent ? "Preparing Base payment..." : `1. Prepare secure Base payment (${fee} USDC)`}
                </button>
              ) : (
                <BaseUsdcTransaction
                  amount={paymentIntent.expectedAmount}
                  recipientAddress={paymentIntent.recipientAddress}
                  disabled={!walletAddress || verifyingPayment}
                  onTransactionHash={(hash) => setVerifyTxHash(hash)}
                  onConfirmed={(hash) => void verifyScreeningPayment(hash)}
                />
              )}
              <button
                onClick={() => void launchBasePay()}
                disabled={!walletAddress || launchingPay || creatingIntent}
                className="w-full rounded-[18px] border border-white/12 bg-white/8 px-3 py-3 text-xs font-semibold text-white/78 transition hover:bg-white/12 disabled:opacity-60"
              >
                {launchingPay ? "Opening Base Pay..." : "Alternative: open Base Pay"}
              </button>
              <p className="text-[11px] leading-5 text-white/56">
                CDP OnchainKit sends USDC on Base from the connected wallet. When the transaction confirms, OpenRx auto-fills the proof and verifies it against the payment intent.
              </p>
            </div>
            <div className="space-y-3">
              <ClinicalField
                label="Payment proof"
                hint="Auto-filled after the Base transaction confirms. You can also paste a Base transaction hash or Base Pay ID."
                htmlFor="screening-tx-hash"
              >
                <ClinicalInput
                  id="screening-tx-hash"
                  value={verifyTxHash}
                  onChange={(event) => setVerifyTxHash(event.target.value)}
                  placeholder="Base transaction hash or Base Pay ID"
                />
              </ClinicalField>
              {screeningTxUrl && (
                <a
                  href={screeningTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal hover:text-teal-dark"
                >
                  View on BaseScan <ExternalLink size={11} />
                </a>
              )}
              <button
                onClick={() => void verifyScreeningPayment()}
                disabled={!walletAddress || verifyingPayment}
                className="w-full rounded-[18px] bg-white px-3 py-3 text-xs font-semibold text-primary transition hover:bg-white/92 disabled:opacity-60"
              >
                {verifyingPayment ? "Verifying..." : "2. Verify onchain payment"}
              </button>
            </div>
          </div>

          {paymentReady && (
            <button
              onClick={() => void runScreening("deep")}
              disabled={running}
              className="w-full rounded-[18px] bg-white px-3 py-3 text-xs font-semibold text-primary transition hover:bg-white/92 disabled:opacity-60"
            >
              {running ? "Generating deep recommendation..." : "3. Release deep recommendation"}
            </button>
          )}
        </FieldsetCard>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ClinicalSection
            kicker="Screening intake"
            title="Start with one sentence"
            description="Describe age, family history, known mutations, smoking history, prior polyps, or symptoms. OpenRx will extract what it can and only ask for more when it genuinely needs it."
            aside={
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Recommended format</p>
                <p className="text-sm leading-6 text-secondary">
                  Best results come from one short narrative with age plus either hereditary risk, prior findings, or a current concern.
                </p>
                <div className="flex flex-wrap gap-2">
                  {NARRATIVE_STARTERS.slice(0, 2).map((starter, index) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => setNarrative(starter)}
                      className="text-left"
                    >
                      <ChoiceChip>Example {index + 1}</ChoiceChip>
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <div className="space-y-4">
              <ClinicalField
                label="Plain-English history"
                htmlFor="screening-narrative"
                hint="Include age, family history, mutations, smoking, prior abnormal findings, or symptoms."
              >
                <ClinicalTextarea
                  id="screening-narrative"
                  aria-label="Tell us your history in plain English"
                  value={narrative}
                  onChange={(event) => setNarrative(event.target.value)}
                  rows={5}
                  placeholder="I am 58, father had prostate cancer at 52, BRCA2 mutation carrier, former smoker."
                  className="resize-y"
                />
              </ClinicalField>

              <div className="flex flex-wrap gap-2">
                {NARRATIVE_STARTERS.map((starter, index) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => setNarrative(starter)}
                    className="text-left"
                  >
                    <ChoiceChip>Use example {index + 1}</ChoiceChip>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void parseNarrativeIntakeIfPresent()}
                  className="text-[11px] font-semibold text-teal hover:text-teal-dark transition"
                >
                  Preview what we understood
                </button>
                {intakeFeedback ? <p className="text-[11px] text-muted">{intakeFeedback}</p> : null}
              </div>

              <FieldsetCard
                legend="Optional structured details"
                description="Use these only if you want to refine the narrative or if the intake parser missed something."
              >
                <button
                  type="button"
                  onClick={() => setShowManualFields((value) => !value)}
                  className="text-xs font-semibold text-primary hover:text-teal transition"
                >
                  {showManualFields ? "Hide optional details" : "Add optional details"}
                </button>
                {showManualFields && (
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <ClinicalField label="Age" htmlFor="screening-age">
                      <ClinicalInput
                        id="screening-age"
                        value={age}
                        onChange={(event) => setAge(event.target.value)}
                        inputMode="numeric"
                        placeholder="58"
                      />
                    </ClinicalField>
                    <ClinicalField
                      label="Sex used for screening intervals"
                      htmlFor="screening-gender"
                      hint="Used only to surface sex-specific USPSTF screening intervals such as mammogram, cervical screening, prostate discussion, or AAA ultrasound."
                    >
                      <select
                        id="screening-gender"
                        value={gender}
                        onChange={(event) => setGender(event.target.value)}
                        className="w-full rounded-[18px] border border-[rgba(82,108,139,0.14)] bg-[rgba(255,255,255,0.92)] px-4 py-3.5 text-sm text-primary shadow-sm transition focus:border-teal/35 focus:outline-none focus:ring-1 focus:ring-teal/15"
                      >
                        <option value="">Not specified</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other / not listed</option>
                      </select>
                    </ClinicalField>
                    <ClinicalField
                      label="Family history"
                      htmlFor="screening-family-history"
                      hint="Comma-separated entries are fine."
                    >
                      <ClinicalInput
                        id="screening-family-history"
                        value={familyHistory}
                        onChange={(event) => setFamilyHistory(event.target.value)}
                        placeholder="father prostate cancer at 52"
                      />
                    </ClinicalField>
                    <ClinicalField
                      label="Conditions or mutations"
                      htmlFor="screening-conditions"
                      hint="Include known germline findings or chronic conditions."
                    >
                      <ClinicalInput
                        id="screening-conditions"
                        value={conditions}
                        onChange={(event) => setConditions(event.target.value)}
                        placeholder="BRCA2 carrier, hypertension"
                      />
                    </ClinicalField>
                    <ClinicalField
                      label="Symptoms"
                      htmlFor="screening-symptoms"
                      optional
                    >
                      <ClinicalInput
                        id="screening-symptoms"
                        value={symptoms}
                        onChange={(event) => setSymptoms(event.target.value)}
                        placeholder="fatigue, abdominal pain"
                      />
                    </ClinicalField>
                    <ClinicalField
                      label="BMI"
                      htmlFor="screening-bmi"
                      optional
                    >
                      <ClinicalInput
                        id="screening-bmi"
                        value={bmi}
                        onChange={(event) => setBmi(event.target.value)}
                        inputMode="decimal"
                        placeholder="29.4"
                      />
                    </ClinicalField>
                    <ClinicalField
                      label="Smoking status"
                      hint="Only mark this if the patient is a current smoker."
                    >
                      <label className="inline-flex items-center gap-2 rounded-[18px] border border-white/78 bg-white/76 px-4 py-3 text-sm text-primary">
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
                      </label>
                    </ClinicalField>
                  </div>
                )}
              </FieldsetCard>
            </div>
          </ClinicalSection>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void runScreening("preview")}
              disabled={running || !canRunPreview}
              className="inline-flex items-center gap-2 rounded-2xl bg-midnight px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#12211d] disabled:opacity-60"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
              Get My Free Recommendations
            </button>
            {(assessment?.accessLevel === "preview" || paymentIntent || paymentReady) && (
              <button
                onClick={() => void runScreening("deep")}
                disabled={running || creatingIntent}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm font-semibold text-primary transition hover:border-teal/30 disabled:opacity-60"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                Generate Advanced Review
              </button>
            )}
          </div>

          {assessment?.accessLevel === "preview" && (
            <p className="text-[11px] text-muted mt-2">
              {assessment.upgradeMessage ||
                "Preview is ready. Add advanced review if you want mutation-aware, inherited-risk personalization."}
            </p>
          )}
        </div>

        <div className="reveal reveal-delay-1 overflow-hidden rounded-[28px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_60%,#173B83_100%)] p-5 text-white shadow-[0_18px_40px_rgba(47,107,255,0.14)] lg:sticky lg:top-28">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white">Assessment brief</h2>
            {assessment && (
              <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full uppercase", riskStyle)}>
                {assessment.riskTier}
              </span>
            )}
          </div>
          {!assessment ? (
            <div className="flex h-24 items-center justify-center text-xs text-white/66">
              <Wallet size={14} className="mr-2" /> Run free preview to generate baseline screening guidance.
            </div>
          ) : (
            <>
              <div className="text-3xl font-bold text-white">{assessment.overallRiskScore}</div>
              <div className="text-xs text-white/56">Overall preventive risk score</div>
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", riskBarStyle)}
                  style={{ width: `${assessment.overallRiskScore}%` }}
                />
              </div>
              <div className="mt-3 space-y-1">
                {assessment.factors.slice(0, 3).map((factor) => (
                  <div
                    key={factor.label}
                    className="flex items-start justify-between text-[11px] text-white/72"
                  >
                    <span>{factor.label}</span>
                    <span className="font-semibold">{factor.scoreDelta > 0 ? `+${factor.scoreDelta}` : factor.scoreDelta}</span>
                  </div>
                ))}
              </div>
              {briefRecommendationItems.length > 0 && (
                <div className="mt-4 rounded-[20px] border border-white/12 bg-white/8 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/56">
                    First recommendations
                  </p>
                  <div className="mt-3 space-y-3">
                    {briefRecommendationItems.map((item) => (
                      <div key={item.id} className="rounded-[16px] bg-white/8 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold leading-5 text-white">{item.label}</p>
                          <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/64">
                            {item.meta}
                          </span>
                        </div>
                        <p className="mt-2 text-[12px] leading-5 text-white/68">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 rounded-[20px] border border-white/12 bg-white/8 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/56">
                  {showingDeepResults ? "Advanced review ready" : "What advanced review adds"}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/68">
                  {showingDeepResults
                    ? "You are seeing mutation-aware screening intervals, inherited-risk interpretation, evidence citations, and nearby care routing."
                    : "Mutation-aware screening intervals, inherited-risk interpretation, evidence citations, and nearby care connections for follow-up."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {assessment && (
        <section className="reveal reveal-delay-1 surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="shell-kicker">Plan at a glance</p>
              <h2 className="mt-3 font-serif text-[1.7rem] text-primary">
                {showingDeepResults ? "Deep personalized screening plan ready." : "Free screening preview ready."}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
                {showingDeepResults
                  ? "Use this to move from risk interpretation into scheduling and local care coordination."
                  : "Use this as the baseline plan. Upgrade only if you want inherited-risk and genetics-aware personalization."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="chip">{assessment.recommendedScreenings.length} screenings</span>
              <span className="chip">{assessment.nextActions.length} next actions</span>
              <span className="chip">{urgentScreeningCount} urgent</span>
              {showingDeepResults ? <span className="chip">{localCareConnections.length} care connections</span> : null}
            </div>
          </div>
        </section>
      )}

      {assessment && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="reveal reveal-delay-1 surface-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={14} className="text-teal" />
              <h2 className="text-sm font-bold text-primary">Recommended Screenings</h2>
            </div>
            <div className="space-y-2">
              {structuredRecommendations.length > 0
                ? structuredRecommendations.map((rec) => {
                    const primaryAction = rec.nextSteps.find((step) => step !== "download_clinician_summary") || rec.nextSteps[0]
                    const statusTone =
                      rec.status === "urgent_clinician_review" || rec.status === "high_risk" || rec.status === "surveillance_or_follow_up"
                        ? "bg-soft-red/10 text-soft-red"
                        : rec.status === "due" || rec.status === "needs_clinician_review"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-accent/10 text-accent"
                    const requestKey = primaryAction ? `${rec.id}:${primaryAction}` : ""
                    return (
                      <div key={rec.id} className="rounded-[20px] border border-white/78 bg-white/74 p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-primary">{rec.screeningName}</p>
                          <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-bold uppercase", statusTone)}>
                            {rec.status.replaceAll("_", " ")}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="chip">{rec.riskCategory.replaceAll("_", " ")}</span>
                          <span className="chip">{rec.sourceSystem}</span>
                          {rec.suggestedTiming ? <span className="chip">{rec.suggestedTiming}</span> : null}
                          {rec.requiresClinicianReview ? <span className="chip">clinician review</span> : null}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-secondary">{rec.patientFriendlyExplanation}</p>
                        <p className="mt-2 text-xs leading-5 text-muted">{rec.rationale}</p>
                        {primaryAction ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void requestScreeningNextStep(rec, primaryAction)}
                              className="rounded-2xl bg-midnight px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#12211d]"
                            >
                              {nextStepLabel(primaryAction)}
                            </button>
                            {requestKey && nextStepStatus[requestKey] ? (
                              <span className="text-[11px] text-muted">{nextStepStatus[requestKey]}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                : assessment.recommendedScreenings.map((rec) => (
                    <div key={rec.id} className="rounded-[20px] border border-white/78 bg-white/74 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-primary">{rec.name}</p>
                        <span
                          className={cn(
                            "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase",
                            rec.priority === "high"
                              ? "bg-soft-red/10 text-soft-red"
                              : rec.priority === "medium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-accent/10 text-accent"
                          )}
                        >
                          {rec.priority}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-secondary">{rec.reason}</p>
                    </div>
                  ))}
            </div>
          </div>

          <div className="reveal reveal-delay-2 surface-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-yellow-700" />
              <h2 className="text-sm font-bold text-primary">Immediate Next Actions</h2>
            </div>
            <ul className="space-y-2">
              {assessment.nextActions.map((action) => (
                <li key={action} className="rounded-[20px] border border-white/78 bg-white/74 p-4 text-sm leading-6 text-secondary shadow-sm">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {assessment && (
        <div className="reveal reveal-delay-2 surface-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-teal" />
            <h2 className="text-sm font-bold text-primary">Recommended Timeline</h2>
          </div>
          <div className="space-y-2">
            {assessment.recommendedScreenings.slice(0, 5).map((rec, index) => {
              const windowLabel =
                rec.priority === "high" ? "Book within 1-2 weeks" : rec.priority === "medium" ? "Book this month" : "Plan this quarter"
              return (
                <div
                  key={`timeline-${rec.id}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-surface/30 p-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-primary">
                      {index + 1}. {rec.name}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">{rec.reason}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-teal/10 text-teal whitespace-nowrap">
                    {windowLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {assessment && evidenceCitations.length > 0 && (
        <div className="reveal reveal-delay-2 surface-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-teal" />
            <h2 className="text-sm font-bold text-primary">Evidence Sources</h2>
          </div>
          <p className="text-xs text-muted">
            {showingDeepResults
              ? "Guideline, PubMed, and configured OpenAI source-search links supporting the advanced recommendation set."
              : "Free preview currently shows USPSTF guideline sources."}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {evidenceCitations.map((citation) => (
              <a
                key={citation.id}
                href={citation.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border/70 bg-surface/30 p-3 hover:border-teal/30 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-primary">{citation.title}</p>
                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-teal/10 text-teal">
                    {citation.type}
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-1">{citation.source}</p>
                {citation.publishedAt && <p className="text-[10px] text-muted mt-0.5">{citation.publishedAt}</p>}
                <p className="text-[11px] text-secondary mt-1">{citation.summary}</p>
                <span className="inline-flex items-center gap-1 text-[11px] text-teal font-semibold mt-2">
                  Open source <ExternalLink size={11} />
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {assessment && showingDeepResults && (
        <div className="reveal reveal-delay-3 surface-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-teal" />
            <h2 className="text-sm font-bold text-primary">
              Nearby Care Matches For This Screening
            </h2>
          </div>
          <p className="text-xs text-muted">
            Personalized matches use your risk profile, recommendation priority, and address to run natural-language NPI search.
          </p>

          <div className="space-y-3">
            {localCareConnections.map((connection) => (
              <div
                key={connection.recommendationId}
                className="rounded-[22px] border border-white/78 bg-white/74 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-primary">
                    {connection.recommendationName}
                  </p>
                  {connection.services.map((service) => (
                    <span
                      key={`${connection.recommendationId}-${service}`}
                      className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-teal/10 text-teal"
                    >
                      {service}
                    </span>
                  ))}
                </div>

                <p className="text-xs text-muted mt-1">{connection.reason}</p>
                <p className="text-[10px] text-muted mt-1">{connection.riskContext}</p>
                <p className="mt-2 text-[11px] text-secondary">Search basis: {connection.query}</p>

                {!connection.ready && (
                  <p className="text-xs font-medium text-yellow-800 mt-2">
                    {connection.clarificationQuestion || "Missing location/service details for nearby search."}
                  </p>
                )}

                {connection.ready && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    {connection.matches.slice(0, 6).map((match) => (
                      <div
                        key={`${connection.recommendationId}-${match.kind}-${match.npi}`}
                        className="rounded-lg border border-border/60 bg-surface p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-primary">{match.name}</p>
                          <span className="text-[9px] uppercase px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold">
                            {match.kind}
                          </span>
                        </div>
                        <p className="text-[11px] text-teal mt-1">{match.specialty || "General"}</p>
                        <p className="text-[11px] text-muted mt-1 flex items-start gap-1">
                          <MapPin size={11} className="mt-0.5 shrink-0" />
                          {match.fullAddress}
                        </p>
                        {match.phone && (
                          <p className="text-[11px] text-muted mt-1 flex items-center gap-1">
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
