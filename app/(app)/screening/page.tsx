"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  ExternalLink,
  Loader2,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react"
import { AppPageHeader } from "@/components/layout/app-page"
import { BaseUsdcTransaction } from "@/components/payments/base-usdc-transaction"
import { CarePlanPreview } from "@/components/care-plan-preview"
import { RedFlagAlert } from "@/components/red-flag-alert"
import { TrustDrawer } from "@/components/trust-drawer"
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
import { getGuidelineSource } from "@/lib/screening/sources"
import type {
  ScreeningNextStep,
  ScreeningRecommendation as StructuredScreeningRecommendation,
} from "@/lib/screening/types"
import type { CareDirectoryMatch, CareSearchType } from "@/lib/npi-care-search"
import type { ScreeningEvidenceCitation } from "@/lib/screening-evidence"
import type { ScreeningIntakeResult } from "@/lib/screening-intake"
import { summarizeScreeningIntake } from "@/lib/screening-intake"
import type { PaymentRecord } from "@/lib/payments-ledger"
import { toBaseBuilderTxUrl } from "@/lib/basebuilder/config"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal"
import { useWalletIdentity } from "@/lib/wallet-context"
import { launchBaseBuilderPay } from "@/lib/basebuilder/pay"
import { carePlanFromScreeningRecommendations } from "@/lib/care-plan"
import { trackWorkflowEvent } from "@/lib/product-analytics"
import { detectRedFlagText } from "@/lib/red-flag"
import {
  SCREENING_HANDOFF_STORAGE_KEY,
  isFreshCareHandoff,
  safeSessionGetItem,
  safeSessionRemoveItem,
  type ScreeningHandoffPayload,
} from "@/lib/care-handoff"

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

function parseScreeningHandoff(raw: string | null): ScreeningHandoffPayload | null {
  if (!raw) return null
  try {
    const payload = JSON.parse(raw) as Partial<ScreeningHandoffPayload>
    if (!payload.narrative || !isFreshCareHandoff(payload.createdAt)) return null
    return {
      source: payload.source === "link" ? "link" : "chat",
      narrative: payload.narrative,
      autorun: payload.autorun !== false,
      createdAt: payload.createdAt || Date.now(),
    }
  } catch {
    return null
  }
}

type RecommendationSectionId = "urgent" | "due_now" | "needs_review" | "upcoming" | "not_enough" | "not_indicated"

type RecommendationSection = {
  id: RecommendationSectionId
  title: string
  description: string
  items: StructuredScreeningRecommendation[]
}

const RECOMMENDATION_SECTION_ORDER: RecommendationSection[] = [
  {
    id: "urgent",
    title: "Urgent / do not use screening pathway",
    description: "Symptoms need prompt medical evaluation rather than a routine preventive screening workflow.",
    items: [],
  },
  {
    id: "due_now",
    title: "Likely due",
    description: "Actionable preventive steps that can move into provider search or care navigation.",
    items: [],
  },
  {
    id: "needs_review",
    title: "Needs clinician review",
    description: "High-risk, symptomatic, inherited-risk, or surveillance situations that should not be treated as routine screening.",
    items: [],
  },
  {
    id: "upcoming",
    title: "May be due depending on details",
    description: "Items to clarify, track, or discuss before they become a direct scheduling task.",
    items: [],
  },
  {
    id: "not_enough",
    title: "Not enough information",
    description: "Add the missing detail shown below before relying on a screening recommendation.",
    items: [],
  },
  {
    id: "not_indicated",
    title: "Current / not indicated",
    description: "Items that look current or not indicated from the information provided.",
    items: [],
  },
]

function recommendationSectionId(rec: StructuredScreeningRecommendation): RecommendationSectionId {
  if (rec.status === "urgent_clinician_review") return "urgent"
  if (
    rec.requiresClinicianReview ||
    rec.status === "high_risk" ||
    rec.status === "needs_clinician_review" ||
    rec.status === "surveillance_or_follow_up"
  ) {
    return "needs_review"
  }
  if (rec.status === "due") return "due_now"
  if (rec.status === "unknown") return "not_enough"
  if (rec.status === "not_due") return "not_indicated"
  return "upcoming"
}

export default function ScreeningPage() {
  const { snapshot } = useLiveSnapshot()
  const { walletAddress, profile, getWalletAuthHeaders } = useWalletIdentity()
  const scrollRef = useScrollReveal()
  const seededHandoffRef = useRef(false)
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
  const [locationZip, setLocationZip] = useState("")
  const [showManualFields, setShowManualFields] = useState(false)
  const [smoker, setSmoker] = useState(false)
  const [smokerTouched, setSmokerTouched] = useState(false)
  const [narrative, setNarrative] = useState("")
  const [intakeFeedback, setIntakeFeedback] = useState("")
  const [intakePreview, setIntakePreview] = useState<ScreeningIntakeResult["extracted"] | null>(null)
  const [acknowledgedRedFlag, setAcknowledgedRedFlag] = useState<string | null>(null)

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
  const [handoffNotice, setHandoffNotice] = useState("")
  const [autoRunRequested, setAutoRunRequested] = useState(false)

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
  const narrativeRedFlag = useMemo(() => detectRedFlagText(`${narrative} ${symptoms}`), [narrative, symptoms])
  const carePlanDraft = useMemo(
    () => structuredRecommendations.length > 0
      ? carePlanFromScreeningRecommendations(
          structuredRecommendations,
          intakePreview ? summarizeScreeningIntake(intakePreview) : "Screening context supplied in this session.",
          "screening"
        )
      : null,
    [intakePreview, structuredRecommendations]
  )
  const recommendationSections = useMemo(() => {
    if (structuredRecommendations.length === 0) return []
    const buckets = new Map<RecommendationSectionId, StructuredScreeningRecommendation[]>()
    structuredRecommendations.forEach((rec) => {
      const id = recommendationSectionId(rec)
      buckets.set(id, [...(buckets.get(id) || []), rec])
    })
    return RECOMMENDATION_SECTION_ORDER
      .map((section) => ({ ...section, items: buckets.get(section.id) || [] }))
      .filter((section) => section.items.length > 0)
  }, [structuredRecommendations])
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
  const actionableCareConnections = useMemo(
    () => localCareConnections.filter((connection) => connection.matches.length > 0),
    [localCareConnections]
  )

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
      const extracted: ScreeningIntakeResult["extracted"] = {
        ...data.extracted,
        familyHistory: data.extracted.familyHistory || [],
        conditions: data.extracted.conditions || [],
        genes: data.extracted.genes || [],
        symptoms: data.extracted.symptoms || [],
        knownMutationOrSyndrome: data.extracted.knownMutationOrSyndrome || [],
        priorAbnormalFindings: data.extracted.priorAbnormalFindings || [],
        redFlags: data.extracted.redFlags || [],
      }
      const inheritedRiskDetected = [...extracted.familyHistory, ...extracted.conditions]
        .some((item) => /\b(brca|lynch|apc|mutyh|germline|prostate|colon|colorectal|polyposis)\b/i.test(item))
      setIntakeFeedback(
        data.ready
          ? inheritedRiskDetected
            ? "Captured inherited-risk details from your message and will personalize accordingly."
            : "History captured from your message."
          : data.clarificationQuestion ||
            "Parsed what you shared. You can still continue, or add one more risk detail for better precision."
      )
      setIntakePreview(extracted)
      return extracted
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
    if (narrativeRedFlag) {
      if (acknowledgedRedFlag !== narrativeRedFlag.category) {
        trackWorkflowEvent("red_flag_triggered", { surface: "screening", category: narrativeRedFlag.category })
      }
      setError("Urgent symptoms should not be evaluated as a routine screening request. Follow the safety guidance shown below.")
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
    trackWorkflowEvent("screening_started", { surface: "screening", category: level })
    try {
      const extracted = await parseNarrativeIntakeIfPresent()
      const manualSymptoms = parseTerms(symptoms)
      const manualFamilyHistory = parseTerms(familyHistory)
      const manualConditions = parseTerms(conditions)

      const resolvedAge = parseOptionalNumber(age) ?? extracted?.age
      const resolvedGender = gender.trim() || extracted?.gender || profile?.gender || snapshot.patient?.gender || undefined
      const resolvedBmi = parseOptionalNumber(bmi) ?? extracted?.bmi
      const resolvedLocationZip = locationZip.trim() || extracted?.location || snapshot.patient?.address || undefined
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
          locationZip: resolvedLocationZip,
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
      trackWorkflowEvent("screening_completed", { surface: "screening", category: level, count: data.structuredRecommendations?.length || 0 })
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

  useEffect(() => {
    if (seededHandoffRef.current || typeof window === "undefined") return
    seededHandoffRef.current = true

    const params = new URLSearchParams(window.location.search)
    const prompt = params.get("prompt") || params.get("q") || ""
    const stored = parseScreeningHandoff(safeSessionGetItem(SCREENING_HANDOFF_STORAGE_KEY))
    safeSessionRemoveItem(SCREENING_HANDOFF_STORAGE_KEY)

    const nextNarrative = stored?.narrative || prompt
    if (!nextNarrative.trim()) return

    setNarrative(nextNarrative.trim())
    setHandoffNotice("Loaded your chat context. OpenRx will run the free screening preview here without making you search again.")
    if (stored?.autorun || params.get("autorun") === "1" || params.get("handoff") === "chat") {
      setAutoRunRequested(true)
    }
  }, [])

  useEffect(() => {
    if (!autoRunRequested || running || assessment || !narrative.trim()) return
    setAutoRunRequested(false)
    void runScreening("preview")
    // runScreening intentionally reads the latest intake state after the handoff populates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunRequested, running, assessment, narrative])

  async function requestScreeningNextStep(rec: StructuredScreeningRecommendation, action: ScreeningNextStep) {
    const key = `${rec.id}:${action}`
    const resolvedLocationZip = locationZip.trim() || intakePreview?.location || snapshot.patient?.address || undefined
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
          locationZip: resolvedLocationZip,
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

  function openProviderSearchFromRecommendation(rec: StructuredScreeningRecommendation) {
    if (typeof window === "undefined") return
    const prompt = `Find who I can call for ${rec.screeningName}.`
    window.location.href = `/chat?topic=scheduling&autorun=1&prompt=${encodeURIComponent(prompt)}`
  }

  function draftClinicianMessage(rec: StructuredScreeningRecommendation) {
    const prompt = `Draft a short message to my clinician about ${rec.screeningName} and the next step.`
    window.location.href = `/chat?topic=coordinator&autorun=1&prompt=${encodeURIComponent(prompt)}`
  }

  return (
    <div ref={scrollRef} className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Screening details"
        title="Check what's due."
        description="Add family history, known mutations, prior findings, symptoms, or smoking history when relevant."
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
          <Link
            href="/chat?prompt=What%20screening%20is%20due%20for%20me%3F%20Ask%20one%20follow-up%20only%20if%20needed%2C%20then%20give%20recommendations%20in%20chat.&topic=screening"
            className="control-button-primary"
          >
            Ask instead
          </Link>
        }
      />

      {error && (
        <div
          data-testid="screening-error"
          className="rounded-xl border border-soft-red/20 bg-soft-red/5 p-3 text-xs text-soft-red"
        >
          {error}
        </div>
      )}

      {handoffNotice && (
        <div className="rounded-xl border border-teal/20 bg-teal/5 p-3 text-xs text-secondary">
          <span className="font-semibold text-primary">Context carried forward.</span> {handoffNotice}
        </div>
      )}

      {narrativeRedFlag ? (
        <RedFlagAlert
          finding={narrativeRedFlag}
          acknowledged={acknowledgedRedFlag === narrativeRedFlag.category}
          onAcknowledge={() => setAcknowledgedRedFlag(narrativeRedFlag.category)}
        />
      ) : null}

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
                  data-testid="screening-narrative-input"
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

              <ClinicalField
                label="ZIP for nearby next steps"
                htmlFor="screening-location-zip"
                hint="Optional, but it lets OpenRx show providers, labs, or imaging centers for the plan."
              >
                <ClinicalInput
                  id="screening-location-zip"
                  data-testid="screening-location-zip"
                  value={locationZip}
                  onChange={(event) => setLocationZip(event.target.value)}
                  inputMode="numeric"
                  placeholder="97123"
                />
              </ClinicalField>

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

              {intakePreview ? (
                <div data-testid="screening-intake-preview" className="rounded-[18px] border border-cyan-200/14 bg-cyan-200/[0.045] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">What OpenRx understood</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {typeof intakePreview.age === "number" ? <ChoiceChip>Age {intakePreview.age}</ChoiceChip> : null}
                    {intakePreview.sexAtBirth ? <ChoiceChip>Sex for screening: {intakePreview.sexAtBirth}</ChoiceChip> : null}
                    {typeof intakePreview.smokingPackYears === "number" ? <ChoiceChip>{intakePreview.smokingPackYears} pack-years</ChoiceChip> : null}
                    {intakePreview.location ? <ChoiceChip>Location: {intakePreview.location}</ChoiceChip> : null}
                    {intakePreview.knownMutationOrSyndrome.map((value) => <ChoiceChip key={value}>{value} reported</ChoiceChip>)}
                  </div>
                  {intakePreview.familyHistory.length ? (
                    <p className="mt-3 text-[12px] leading-5 text-secondary">Family history: {intakePreview.familyHistory.join("; ")}</p>
                  ) : null}
                  {intakePreview.priorAbnormalFindings.length ? (
                    <p className="mt-2 text-[12px] leading-5 text-secondary">Prior abnormal findings: {intakePreview.priorAbnormalFindings.join("; ")}</p>
                  ) : null}
                  {intakePreview.redFlags.length ? (
                    <p className="mt-2 text-[12px] font-semibold leading-5 text-red-200">Symptoms requiring non-routine review: {intakePreview.redFlags.join("; ")}</p>
                  ) : null}
                  {!intakePreview.smokingPackYears && typeof intakePreview.age === "number" && intakePreview.age >= 50 ? (
                    <p className="mt-3 text-[12px] text-zinc-400">High-value question: Have you ever smoked 20 or more pack-years, and if so, when did you quit?</p>
                  ) : null}
                </div>
              ) : null}

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
                      <label className="inline-flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.055] px-4 py-3 text-sm text-primary">
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
              data-testid="screening-submit-preview"
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
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-semibold text-primary transition hover:border-teal/30 disabled:opacity-60"
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
            <h2 className="text-sm font-bold text-white">Your next steps</h2>
            {assessment ? <span className="rounded-full border border-white/12 bg-white/8 px-2 py-1 text-[10px] font-bold uppercase text-white/70">preview ready</span> : null}
          </div>
          {!assessment ? (
            <div className="space-y-3 text-xs leading-6 text-white/66">
              <p>Run the free preview to see likely next steps.</p>
              <p>No wallet is required. Only the details in your sentence are used.</p>
            </div>
          ) : (
            <>
              <p className="text-sm leading-6 text-white/72">OpenRx found {structuredRecommendations.length || assessment.recommendedScreenings.length} possible care item{structuredRecommendations.length === 1 ? "" : "s"} from the information supplied.</p>
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
                  Useful next step
                </p>
                <p className="mt-2 text-sm leading-6 text-white/68">
                  {actionableCareConnections.length > 0
                    ? `${actionableCareConnections.length} nearby care option group${actionableCareConnections.length === 1 ? "" : "s"} are ready below. Call to confirm availability; OpenRx does not place orders.`
                    : locationZip.trim() || intakePreview?.location || snapshot.patient?.address
                      ? "No local directory matches came back yet. Use the plan and source links while OpenRx refreshes nearby options."
                      : "Add a ZIP code before running the preview to show nearby providers, labs, or imaging centers for the plan."}
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
              <h2 className="mt-3 text-[1.7rem] font-semibold tracking-[-0.035em] text-primary">
                {showingDeepResults ? "Advanced screening plan ready." : "Free screening plan ready."}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
                {showingDeepResults
                  ? "Use this to move from risk interpretation into scheduling and local care coordination."
                  : "Use this to see guideline-grounded recommendations and nearby next steps. Advanced review is optional for inherited-risk and genetics-aware personalization."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="chip">{assessment.recommendedScreenings.length} screenings</span>
              <span className="chip">{assessment.nextActions.length} next actions</span>
              <span className="chip">{urgentScreeningCount} urgent</span>
              {localCareConnections.length > 0 ? <span className="chip">{actionableCareConnections.length} local match groups</span> : null}
            </div>
          </div>
        </section>
      )}

      {carePlanDraft ? <CarePlanPreview draft={carePlanDraft} /> : null}

      {assessment ? (
        <TrustDrawer
          sources={evidenceCitations.map((citation) => ({ label: citation.title, url: citation.url, date: citation.publishedAt }))}
          inputsUsed={intakePreview ? [summarizeScreeningIntake(intakePreview)] : ["Details provided in screening intake"]}
          inputsNotUsed={["Wallet identity for the free preview", "Insurance coverage or network status"]}
          phiSentToModel={showingDeepResults}
          routingNote={showingDeepResults ? "Advanced evidence review may query configured evidence services using minimized screening context." : "Free preview is generated from typed screening rules and source metadata."}
          emergencyWarning={narrativeRedFlag?.emergencyMessage}
          clinicianQuestions={["Which recommendation should I act on first?", "Does my family or genetic history change the interval?"]}
        />
      ) : null}

      {assessment && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="reveal reveal-delay-1 surface-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={14} className="text-teal" />
              <h2 className="text-sm font-bold text-primary">Recommended Screenings</h2>
            </div>
            <div className="space-y-4">
              {structuredRecommendations.length > 0
                ? recommendationSections.map((section) => (
                    <section key={section.id} data-testid={`screening-section-${section.id}`} className="space-y-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary">
                            {section.title}
                          </h3>
                          <p className="mt-1 text-[12px] leading-5 text-muted">{section.description}</p>
                        </div>
                        <span className="chip">{section.items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {section.items.map((rec) => {
                          const primaryAction = rec.nextSteps.find((step) => step !== "download_clinician_summary") || rec.nextSteps[0]
                          const statusTone =
                            rec.status === "urgent_clinician_review" || rec.status === "high_risk" || rec.status === "surveillance_or_follow_up"
                              ? "bg-soft-red/10 text-soft-red"
                              : rec.status === "due" || rec.status === "needs_clinician_review"
                                ? "bg-yellow-100 text-yellow-800"
                                : rec.status === "not_due"
                                  ? "bg-soft-blue/10 text-soft-blue"
                                  : "bg-accent/10 text-accent"
                          const requestKey = primaryAction ? `${rec.id}:${primaryAction}` : ""
                          const hasLocationContext = Boolean(locationZip.trim() || intakePreview?.location || snapshot.patient?.address?.trim())
                          const source = getGuidelineSource(rec.sourceId)
                          return (
                            <div
                              key={rec.id}
                              data-testid="screening-recommendation-card"
                              data-recommendation-id={rec.id}
                              data-recommendation-status={rec.status}
                              className="rounded-[20px] border border-white/10 bg-white/[0.055] p-4 shadow-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-primary">{rec.screeningName}</p>
                                <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-bold uppercase", statusTone)}>
                                  {rec.status.replaceAll("_", " ")}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="chip">{rec.riskCategory.replaceAll("_", " ")}</span>
                                {source?.url ? (
                                  <a href={source.url} target="_blank" rel="noreferrer" className="chip hover:border-teal/30 hover:text-teal">
                                    {rec.sourceSystem} source
                                    <ExternalLink size={10} />
                                  </a>
                                ) : <span className="chip">Needs clinician review</span>}
                                {rec.suggestedTiming ? <span className="chip">{rec.suggestedTiming}</span> : null}
                                {rec.requiresClinicianReview ? <span className="chip">clinician review</span> : null}
                              </div>
                              <p className="mt-3 text-sm leading-6 text-secondary">{rec.patientFriendlyExplanation}</p>
                              <p className="mt-2 text-xs leading-5 text-muted">{rec.rationale}</p>
                              <div className="mt-4 rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-white/[0.045] p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Next step</p>
                                  <span className="text-[10px] text-muted">
                                    Opens chat to find phone numbers. No order is placed here.
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    data-testid="recommendation-find-schedule"
                                    onClick={() => openProviderSearchFromRecommendation(rec)}
                                    className="inline-flex items-center gap-1 rounded-2xl bg-midnight px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#12211d]"
                                  >
                                    <Search size={12} />
                                    Find who to call
                                    <ArrowRight size={12} />
                                  </button>
                                  {primaryAction ? (
                                    <button
                                      type="button"
                                      data-testid="recommendation-save-request"
                                      onClick={() => void requestScreeningNextStep(rec, primaryAction)}
                                      className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-muted transition hover:border-teal/25 hover:text-teal"
                                    >
                                      Save request
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    data-testid="recommendation-draft-message"
                                    onClick={() => draftClinicianMessage(rec)}
                                    className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-muted transition hover:border-teal/25 hover:text-teal"
                                  >
                                    Draft message to clinician
                                  </button>
                                  {requestKey && nextStepStatus[requestKey] ? (
                                    <span className="text-[11px] text-muted">{nextStepStatus[requestKey]}</span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-[11px] leading-5 text-muted">
                                  {primaryAction ? `${nextStepLabel(primaryAction)} is the clinical task. ` : ""}
                                  {hasLocationContext
                                    ? "Provider search will use the location context you provided."
                                    : "Provider search will ask for a city or ZIP before returning local results."}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ))
                : assessment.recommendedScreenings.map((rec) => (
                    <div key={rec.id} className="rounded-[20px] border border-white/10 bg-white/[0.055] p-4 shadow-sm">
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
                <li key={action} className="rounded-[20px] border border-white/10 bg-white/[0.055] p-4 text-sm leading-6 text-secondary shadow-sm">
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
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-white/[0.045] p-3"
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
                className="rounded-lg border border-border/70 bg-white/[0.045] p-3 hover:border-teal/30 transition"
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

      {assessment && localCareConnections.length > 0 && (
        <div className="reveal reveal-delay-3 surface-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-teal" />
            <h2 className="text-sm font-bold text-primary">
              Nearby Care Matches For This Screening
            </h2>
          </div>
          <p className="text-xs text-muted">
            Matches use the recommendation type and ZIP/location. Directory entries are not appointments, orders, or verified insurance coverage.
          </p>

          <div className="space-y-3">
            {localCareConnections.map((connection) => (
              <div
                key={connection.recommendationId}
                className="rounded-[22px] border border-white/10 bg-white/[0.055] p-4 shadow-sm"
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

      {assessment && localCareConnections.length === 0 && !locationZip.trim() && !intakePreview?.location && !snapshot.patient?.address ? (
        <div className="reveal reveal-delay-3 surface-card p-5">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-teal" />
            <h2 className="text-sm font-bold text-primary">Add Location For Nearby Care</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Add a ZIP code above and run the preview again to show providers, labs, or imaging centers tied to this plan.
          </p>
        </div>
      ) : null}
    </div>
  )
}
