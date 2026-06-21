"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardCheck,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react"
import { BaseUsdcTransaction } from "@/components/payments/base-usdc-transaction"
import { CarePlanPreview } from "@/components/care-plan-preview"
import { RedFlagAlert } from "@/components/red-flag-alert"
import { TrustDrawer } from "@/components/trust-drawer"
import {
  ChoiceChip,
  ClinicalField,
  ClinicalInput,
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
import { usePrefetchLinks } from "@/lib/hooks/use-prefetch-links"
import {
  PROVIDER_HANDOFF_STORAGE_KEY,
  SCREENING_HANDOFF_STORAGE_KEY,
  isFreshCareHandoff,
  providerSearchHrefFromHandoff,
  safeSessionGetItem,
  safeSessionRemoveItem,
  safeSessionSetItem,
  type ProviderHandoffPayload,
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

interface ReferralProviderOption {
  id: string
  npi: string
  source: "self_onboarded" | "seeded"
  name: string
  specialty?: string
  services: string[]
  address?: string
  phone?: string
  acceptingNew?: boolean
  telehealth?: boolean
  insurance: string[]
  statusLabel: string
}

interface ScreeningReferralPreviewResponse {
  supported: boolean
  message: string
  patientId: string
  databaseReady?: boolean
  databaseMessage?: string
  displayedFields: Array<{ path: string; label: string; value: unknown; required: boolean; requiredReason?: string }>
  disclosurePayloadHash?: string
  disclosureTemplateVersion?: string
  consentTextVersion?: string
  legalBasis?: "undetermined"
  requiredServices: string[]
  referralTargets: ReferralProviderOption[]
  seededContactOnly: ReferralProviderOption[]
  recommendation?: StructuredScreeningRecommendation
  evidence?: {
    sourceId?: string
    sourceSystem: string
    sourceVersion?: string
    evidenceGrade?: string
    sourceUrl?: string
  }
  created?: {
    referral: {
      id: string
      status: string
      providerId: string
      recommendationId: string
      disclosureTemplateVersion: string
      scopeHash: string
    }
    consent: {
      id: string
      scopeHash: string
      disclosurePayloadHash?: string
      grantedAt: string
      expiresAt?: string
      legalBasis?: "patient_directed" | "baa_governed" | "undetermined"
      consentTextVersion?: string
      receipt?: {
        consentId: string
        patientId: string
        providerName: string
        fields: Array<{ path: string; label: string; value: unknown; required: boolean }>
        grantedAt: string
        sourceRec: {
          recommendationId: string
          screeningName: string
          sourceSystem: string
          sourceVersion?: string
          evidenceGrade?: string
        }
      }
    }
  }
  error?: string
}

interface ReferralPanelState {
  recommendationId: string
  action: ScreeningNextStep
  loading: boolean
  selectedFieldIds: string[]
  selectedProviderId: string
  preview?: ScreeningReferralPreviewResponse
  status?: string
  error?: string
}

const NARRATIVE_STARTERS = [
  "I am 58. Father had prostate cancer at 52. BRCA2 mutation carrier.",
  "I am 46 with family history of colon cancer and polyposis.",
  "I am 39, current smoker, mother had breast cancer at 44.",
  "I am 67 with diabetes, hypertension, and prior abnormal colon polyp.",
]

const SAFE_SCREENING_RETRY_MESSAGE =
  "We couldn’t finish that request. Try again in a moment, or shorten your summary to age, sex used for screening, family history, mutations, and prior tests."
const SAFE_PAYMENT_RETRY_MESSAGE =
  "We couldn’t finish the payment step. Try again in a moment. No screening recommendation was changed."
const SAFE_REFERRAL_RETRY_MESSAGE =
  "We couldn’t finish the referral step. Try again in a moment. No PHI was transmitted."

function formatGrade(value?: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^grade\b/i.test(trimmed) ? trimmed : `Grade ${trimmed}`
}

function visibleSourceVersion(
  rec: StructuredScreeningRecommendation,
  source?: ReturnType<typeof getGuidelineSource>
): string {
  const version = rec.sourceVersion || source?.versionOrDate || ""
  return version && version !== "not_implemented" ? version : "Clinician-review pathway"
}

function sourceUrlForRecommendation(
  rec: StructuredScreeningRecommendation,
  source?: ReturnType<typeof getGuidelineSource>
): string | undefined {
  return rec.sourceUrl || source?.url
}

function ScreeningPlanSkeleton() {
  return (
    <section
      data-testid="screening-plan-skeleton"
      aria-live="polite"
      aria-label="Screening plan loading"
      className="surface-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl flex-1">
          <div className="orx-skeleton h-3 w-32 rounded-full" />
          <div className="orx-skeleton mt-4 h-8 w-72 max-w-full rounded-lg" />
          <div className="orx-skeleton mt-3 h-4 w-full rounded-full" />
          <div className="orx-skeleton mt-2 h-4 w-4/5 rounded-full" />
        </div>
        <div className="grid w-full max-w-xs grid-cols-3 gap-2">
          <div className="orx-skeleton h-8 rounded-full" />
          <div className="orx-skeleton h-8 rounded-full" />
          <div className="orx-skeleton h-8 rounded-full" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="rounded-[20px] border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="orx-skeleton h-5 w-44 rounded-lg" />
              <div className="orx-skeleton h-6 w-20 rounded-full" />
            </div>
            <div className="mt-3 flex gap-2">
              <div className="orx-skeleton h-6 w-24 rounded-full" />
              <div className="orx-skeleton h-6 w-20 rounded-full" />
              <div className="orx-skeleton h-6 w-28 rounded-full" />
            </div>
            <div className="orx-skeleton mt-4 h-4 w-full rounded-full" />
            <div className="orx-skeleton mt-2 h-4 w-5/6 rounded-full" />
            <div className="orx-skeleton mt-4 h-10 w-40 rounded-xl" />
          </div>
        ))}
      </div>
    </section>
  )
}

function formatWallet(address?: string): string {
  if (!address) return ""
  if (address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDisclosureValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not reported"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    if (value.length === 0) return "None reported"
    return value
      .map((entry) => {
        if (!entry || typeof entry !== "object") return String(entry)
        const data = entry as Record<string, unknown>
        return Object.entries(data)
          .filter(([, item]) => item !== undefined && item !== null && item !== "")
          .map(([key, item]) => `${key}: ${String(item)}`)
          .join("; ")
      })
      .join(" | ")
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && item !== null && item !== "")
      .map(([key, item]) => `${key}: ${String(item)}`)
    return entries.length ? entries.join("; ") : "None reported"
  }
  return String(value)
}

function requiredDisclosureIds(preview?: ScreeningReferralPreviewResponse): string[] {
  return preview?.displayedFields.filter((field) => field.required).map((field) => field.path) || []
}

function selectedDisclosureFields(preview: ScreeningReferralPreviewResponse, selectedFieldIds: string[]) {
  const selected = new Set(selectedFieldIds)
  return preview.displayedFields.filter((field) => selected.has(field.path))
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

const LOCATION_SIGNAL = /\b(?:near|in|around)\b|\b\d{5}(?:-\d{4})?\b/i

function recommendationHasAnyStep(rec: StructuredScreeningRecommendation, steps: ScreeningNextStep[]) {
  return steps.some((step) => rec.nextSteps.includes(step))
}

function careSearchQueryForRecommendation(rec: StructuredScreeningRecommendation): string {
  const signal = `${rec.screeningName} ${rec.cancerType} ${rec.recommendedNextStep}`.toLowerCase()

  if (recommendationHasAnyStep(rec, ["request_colonoscopy"]) || /colorectal|colonoscop|colon/.test(signal)) {
    return "gastroenterology providers for colonoscopy"
  }
  if (recommendationHasAnyStep(rec, ["request_mammogram"]) || /mammogram|breast/.test(signal)) {
    return "mammogram imaging centers"
  }
  if (recommendationHasAnyStep(rec, ["request_ldct", "request_imaging"]) || /lung|ldct|low-dose ct/.test(signal)) {
    return "radiology centers for low-dose CT screening"
  }
  if (recommendationHasAnyStep(rec, ["request_cervical_screening"]) || /cervical|pap|hpv/.test(signal)) {
    return "primary care or gynecology providers for cervical cancer screening"
  }
  if (recommendationHasAnyStep(rec, ["request_psa_discussion"]) || /prostate|psa/.test(signal)) {
    return "primary care or urology providers for prostate screening discussion"
  }
  if (recommendationHasAnyStep(rec, ["request_genetic_counseling"]) || /genetic|hereditary|brca|lynch/.test(signal)) {
    return "genetic counseling providers"
  }

  return `providers for ${rec.screeningName}`
}

function appendLocationHint(query: string, locationHint: string) {
  const cleanQuery = query.trim()
  const cleanLocation = locationHint.trim()
  if (!cleanQuery || !cleanLocation || LOCATION_SIGNAL.test(cleanQuery)) return cleanQuery
  return `${cleanQuery} near ${cleanLocation}`
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
  const [referralPanel, setReferralPanel] = useState<ReferralPanelState | null>(null)
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
  const sourcePrefetchUrls = useMemo(() => {
    const recommendationUrls = structuredRecommendations
      .map((rec) => sourceUrlForRecommendation(rec, getGuidelineSource(rec.sourceId)))
      .filter((url): url is string => Boolean(url))
    const evidenceUrls = evidenceCitations.map((citation) => citation.url)
    return [...recommendationUrls, ...evidenceUrls]
  }, [evidenceCitations, structuredRecommendations])
  usePrefetchLinks(sourcePrefetchUrls, "screening-guideline-sources")
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
    setError("Payment is required before advanced inherited-risk recommendations are released.")
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
        throw new Error("payment_intent_failed")
      }

      setPaymentIntent(data.payment)
      setPaymentId(data.payment.id)
      setFee(data.fee || fee)
      setRecipientAddress(data.recipientAddress || data.payment.recipientAddress)
      setVerifyTxHash("")
      setPaymentReady(false)
      return data.payment
    } catch {
      setError(SAFE_PAYMENT_RETRY_MESSAGE)
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
    } catch {
      setError(SAFE_PAYMENT_RETRY_MESSAGE)
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
        throw new Error("payment_verification_failed")
      }
      setVerifyTxHash(txHash)
      setPaymentId(resolvedPaymentId)
      setPaymentReady(true)
    } catch {
      setPaymentReady(false)
      setError(SAFE_PAYMENT_RETRY_MESSAGE)
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
        throw new Error("screening_assessment_failed")
      }

      setAssessment(data)
      setLocalCareConnections(data.localCareConnections || [])
      setEvidenceCitations(data.evidenceCitations || [])
      trackWorkflowEvent("screening_completed", { surface: "screening", category: level, count: data.structuredRecommendations?.length || 0 })
      if (data.accessLevel === "deep") {
        setShowPaymentGate(false)
      }
    } catch {
      setError(SAFE_SCREENING_RETRY_MESSAGE)
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
        throw new Error("next_step_failed")
      }
      setNextStepStatus((current) => ({
        ...current,
        [key]: data.message || `Request ${data.request?.id || ""} is ${data.request?.status || "requested"}.`,
      }))
    } catch {
      setNextStepStatus((current) => ({
        ...current,
        [key]: "Couldn’t prepare that request. Try again in a moment.",
      }))
    }
  }

  function currentScreeningReferralInput() {
    const manualSymptoms = parseTerms(symptoms)
    const manualFamilyHistory = parseTerms(familyHistory)
    const manualConditions = parseTerms(conditions)

    return {
      patientId: snapshot.patient?.id,
      age: parseOptionalNumber(age) ?? intakePreview?.age,
      gender: gender.trim() || intakePreview?.gender || profile?.gender || snapshot.patient?.gender || undefined,
      sexAtBirth: gender.trim() || intakePreview?.sexAtBirth || intakePreview?.gender || undefined,
      smoker: smokerTouched ? smoker : intakePreview?.smoker ?? smoker,
      smokingPackYears: intakePreview?.smokingPackYears,
      quitYearsAgo: intakePreview?.quitYearsAgo,
      symptoms: manualSymptoms.length > 0 ? manualSymptoms : intakePreview?.symptoms || [],
      familyHistory: manualFamilyHistory.length > 0 ? manualFamilyHistory : intakePreview?.familyHistory || [],
      conditions: manualConditions.length > 0 ? manualConditions : intakePreview?.conditions || [],
      locationZip: locationZip.trim() || intakePreview?.location || snapshot.patient?.address || undefined,
    }
  }

  function directoryMatchesForRecommendation(rec: StructuredScreeningRecommendation): CareDirectoryMatch[] {
    const direct = localCareConnections.find((connection) => connection.recommendationId === rec.id)
    const byName = localCareConnections.find((connection) => connection.recommendationName === rec.screeningName)
    return (direct || byName)?.matches || []
  }

  function careConnectionForRecommendation(rec: StructuredScreeningRecommendation): LocalCareConnection | undefined {
    return (
      localCareConnections.find((connection) => connection.recommendationId === rec.id) ||
      localCareConnections.find((connection) => connection.recommendationName === rec.screeningName)
    )
  }

  async function startReferralConsent(rec: StructuredScreeningRecommendation, action: ScreeningNextStep) {
    setReferralPanel({
      recommendationId: rec.id,
      action,
      loading: true,
      selectedFieldIds: [],
      selectedProviderId: "",
      status: "Checking verified referral options...",
    })
    try {
      const response = await fetch("/api/referrals/screening", {
        method: "POST",
        headers: await getJsonHeaders(),
        body: JSON.stringify({
          action: "preview",
          walletAddress,
          patientId: snapshot.patient?.id,
          recommendationId: rec.id,
          screeningInput: currentScreeningReferralInput(),
          directoryMatches: directoryMatchesForRecommendation(rec),
        }),
      })
      const data = (await response.json()) as ScreeningReferralPreviewResponse
      if (!response.ok || data.error) {
        throw new Error("referral_preview_failed")
      }
      const defaultFieldIds = requiredDisclosureIds(data)
      setReferralPanel({
        recommendationId: rec.id,
        action,
        loading: false,
        selectedFieldIds: defaultFieldIds,
        selectedProviderId: "",
        preview: data,
        status: data.message,
      })
      trackWorkflowEvent("screening_referral_previewed", {
        surface: "screening",
        recommendationId: rec.id,
        referralTargets: data.referralTargets.length,
        contactOnly: data.seededContactOnly.length,
      })
    } catch {
      setReferralPanel({
        recommendationId: rec.id,
        action,
        loading: false,
        selectedFieldIds: [],
        selectedProviderId: "",
        error: SAFE_REFERRAL_RETRY_MESSAGE,
      })
    }
  }

  async function submitReferralConsent() {
    if (!referralPanel?.preview || !referralPanel.selectedProviderId) return
    const missingRequired = requiredDisclosureIds(referralPanel.preview).filter((fieldId) => !referralPanel.selectedFieldIds.includes(fieldId))
    if (missingRequired.length) {
      setReferralPanel((current) => current ? {
        ...current,
        error: "Required fields were removed. Share them to continue, or decline the referral without sharing PHI.",
      } : current)
      return
    }
    setReferralPanel((current) => current ? {
      ...current,
      loading: true,
      error: undefined,
      status: "Creating referral after consent...",
    } : current)
    try {
      const response = await fetch("/api/referrals/screening", {
        method: "POST",
        headers: await getJsonHeaders(),
        body: JSON.stringify({
          action: "create",
          walletAddress,
          patientId: snapshot.patient?.id,
          recommendationId: referralPanel.recommendationId,
          screeningInput: currentScreeningReferralInput(),
          providerId: referralPanel.selectedProviderId,
          consentAccepted: true,
          selectedFieldIds: referralPanel.selectedFieldIds,
        }),
      })
      const data = (await response.json()) as ScreeningReferralPreviewResponse
      if (!response.ok || data.error) {
        throw new Error("referral_create_failed")
      }
      setReferralPanel((current) => current ? {
        ...current,
        loading: false,
        preview: data,
        status: data.message || `Referral ${data.created?.referral.id || ""} created.`,
      } : current)
      trackWorkflowEvent("screening_referral_created", {
        surface: "screening",
        recommendationId: referralPanel.recommendationId,
      })
    } catch {
      setReferralPanel((current) => current ? {
        ...current,
        loading: false,
        error: SAFE_REFERRAL_RETRY_MESSAGE,
      } : current)
    }
  }

  function openProviderSearchFromRecommendation(rec: StructuredScreeningRecommendation) {
    if (typeof window === "undefined") return
    const locationHint = locationZip.trim() || intakePreview?.location || snapshot.patient?.address || ""
    const connection = careConnectionForRecommendation(rec)
    const baseQuery = connection?.query?.trim() || careSearchQueryForRecommendation(rec)
    const query = appendLocationHint(baseQuery, locationHint)
    const payload: ProviderHandoffPayload = {
      source: "screening",
      query,
      autorun: true,
      createdAt: Date.now(),
      recommendationId: rec.id,
      recommendationName: rec.screeningName,
      sourceSystem: rec.sourceSystem,
      sourceVersion: rec.sourceVersion,
      evidenceGrade: rec.evidenceGrade,
      sourceUrl: rec.sourceUrl,
      locationHint: locationHint || undefined,
    }

    safeSessionSetItem(PROVIDER_HANDOFF_STORAGE_KEY, JSON.stringify(payload))
    window.location.href = providerSearchHrefFromHandoff(query, "screening")
  }

  function draftClinicianMessage(rec: StructuredScreeningRecommendation) {
    const prompt = `Draft a short message to my clinician about ${rec.screeningName} and the next step.`
    window.location.href = `/chat?topic=coordinator&autorun=1&prompt=${encodeURIComponent(prompt)}`
  }

  return (
    <div ref={scrollRef} data-openrx-screening-workspace className="animate-slide-up space-y-4 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#050707] px-4 py-8 shadow-[0_24px_90px_rgba(0,0,0,0.36)] sm:px-6 sm:py-10 lg:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(103,232,249,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_38%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[12px] font-medium text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
            OpenRx screening
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl text-balance font-serif text-[clamp(2.45rem,8vw,5.25rem)] font-semibold leading-[0.96] text-primary">
            What screening is due?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-secondary">
            Ask once. Get a sourced plan and the next useful action.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <span className="metric-chip">
              <Activity size={11} className="text-accent" />
              Deterministic rules
            </span>
            <span className="metric-chip">
              <ShieldCheck size={11} className="text-teal" />
              Source + grade on every recommendation
            </span>
            {recipientAddress ? (
              <span className="metric-chip">
                <Wallet size={11} className="text-soft-blue" />
                Secure payment ready
              </span>
            ) : null}
          </div>
        </div>
      </section>

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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#090d0d]/95 p-4 shadow-[0_18px_64px_rgba(0,0,0,0.28)] sm:p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">Ask OpenRx</p>
                <h2 className="mt-2 text-[1.45rem] font-semibold leading-tight text-primary sm:text-[1.7rem]">
                  One sentence is enough.
                </h2>
              </div>
              <Link
                href="/chat?prompt=What%20screening%20is%20due%20for%20me%3F%20Ask%20one%20follow-up%20only%20if%20needed%2C%20then%20give%20recommendations%20in%20chat.&topic=screening"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.055] px-3 text-xs font-semibold text-secondary transition hover:border-cyan-200/30 hover:text-primary"
              >
                Ask in chat
              </Link>
            </div>
            <div className="mt-5 space-y-4">
              <ClinicalField
                label="Plain-English history"
                htmlFor="screening-narrative"
              >
                <ClinicalTextarea
                  id="screening-narrative"
                  data-testid="screening-narrative-input"
                  aria-label="Tell us your history in plain English"
                  value={narrative}
                  onInput={(event) => setNarrative(event.currentTarget.value)}
                  onChange={(event) => setNarrative(event.target.value)}
                  rows={4}
                  placeholder="Example: 45 male, no symptoms, what cancer screening is due?"
                  className="min-h-[132px] resize-y rounded-[24px] border-white/12 bg-[#050707] px-5 py-4 text-base leading-7 placeholder:text-zinc-400"
                />
              </ClinicalField>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <ClinicalField
                  label="ZIP for nearby care"
                  htmlFor="screening-location-zip"
                  optional
                >
                  <ClinicalInput
                    id="screening-location-zip"
                    data-testid="screening-location-zip"
                    value={locationZip}
                    onChange={(event) => setLocationZip(event.target.value)}
                    inputMode="numeric"
                    placeholder="97123"
                    className="rounded-full"
                  />
                </ClinicalField>
                <button
                  data-testid="screening-submit-preview"
                  onClick={() => void runScreening("preview")}
                  disabled={running || !canRunPreview}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-cyan-200 px-5 py-3 text-sm font-bold text-black transition hover:bg-cyan-100 disabled:opacity-60 sm:w-auto"
                >
                  {running ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                  Get sourced plan
                </button>
              </div>

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
                  className="text-[12px] font-semibold text-cyan-100 transition hover:text-cyan-50"
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
          </section>

          {(assessment?.accessLevel === "preview" || paymentIntent || paymentReady) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void runScreening("deep")}
                disabled={running || creatingIntent}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-semibold text-secondary transition hover:border-cyan-200/30 hover:text-primary disabled:opacity-60"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                Generate Advanced Review
              </button>
            </div>
          )}

          {assessment?.accessLevel === "preview" && (
            <p className="text-[11px] text-muted mt-2">
              {assessment.upgradeMessage ||
                "Preview is ready. Add advanced review if you want mutation-aware, inherited-risk personalization."}
            </p>
          )}
        </div>

        <aside className="reveal reveal-delay-1 overflow-hidden rounded-[28px] border border-white/10 bg-[#090d0d]/95 p-5 text-white shadow-[0_18px_64px_rgba(0,0,0,0.28)] xl:sticky xl:top-28">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Answer rail</h2>
            {assessment ? <span className="rounded-full border border-cyan-200/18 bg-cyan-200/[0.08] px-2 py-1 text-[10px] font-bold uppercase text-cyan-100">ready</span> : null}
          </div>
          {!assessment ? (
            running ? (
              <div className="space-y-3" data-testid="screening-next-steps-skeleton">
                <div className="orx-skeleton h-4 w-44 rounded-full bg-white/15" />
                <div className="orx-skeleton h-16 rounded-[16px] bg-white/12" />
                <div className="orx-skeleton h-16 rounded-[16px] bg-white/12" />
              </div>
            ) : (
              <div className="space-y-3 text-xs leading-6 text-white/78">
                <p>Ask a screening question and OpenRx will return a sourced plan.</p>
                <p>Actions appear here when a provider, lab, imaging center, or clinician message is useful.</p>
              </div>
            )
          ) : (
            <>
              <p className="text-sm leading-6 text-white/82">OpenRx found {structuredRecommendations.length || assessment.recommendedScreenings.length} care item{structuredRecommendations.length === 1 ? "" : "s"} from the information supplied.</p>
              {briefRecommendationItems.length > 0 && (
                <div className="mt-4 rounded-[20px] border border-white/12 bg-white/8 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/56">
                    Recommendations
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
                  Next action
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
        </aside>
      </div>

      {running && !assessment ? <ScreeningPlanSkeleton /> : null}

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
                          const sourceUrl = sourceUrlForRecommendation(rec, source)
                          const sourceVersion = visibleSourceVersion(rec, source)
                          const gradeLabel = formatGrade(rec.evidenceGrade)
                          const activeReferralPanel = referralPanel?.recommendationId === rec.id ? referralPanel : null
                          const activePreview = activeReferralPanel?.preview
                          const selectedProvider = activePreview?.referralTargets.find((provider) => provider.id === activeReferralPanel?.selectedProviderId)
                          const selectedFields = activePreview && activeReferralPanel
                            ? selectedDisclosureFields(activePreview, activeReferralPanel.selectedFieldIds)
                            : []
                          const missingRequiredFields = activePreview && activeReferralPanel
                            ? activePreview.displayedFields.filter((field) => field.required && !activeReferralPanel.selectedFieldIds.includes(field.path))
                            : []
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
                                {sourceUrl ? (
                                  <a
                                    href={sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="chip border-teal/20 bg-teal/10 text-teal hover:border-teal/40"
                                    data-testid="recommendation-source-link"
                                  >
                                    {rec.sourceSystem}
                                    <span data-testid="recommendation-source-version"> · {sourceVersion}</span>
                                    <ExternalLink size={10} />
                                  </a>
                                ) : <span className="chip">Needs clinician review</span>}
                                {gradeLabel ? (
                                  <span className="chip border-teal/20 bg-teal/10 text-teal" data-testid="recommendation-evidence-grade">{gradeLabel}</span>
                                ) : null}
                                {rec.suggestedTiming ? <span className="chip">{rec.suggestedTiming}</span> : null}
                                {rec.requiresClinicianReview ? <span className="chip">clinician review</span> : null}
                              </div>
                              <div
                                data-testid="recommendation-trust-strip"
                                className="mt-3 grid grid-cols-1 gap-2 rounded-[16px] border border-teal/15 bg-teal/[0.055] p-3 text-[11px] leading-5 text-secondary sm:grid-cols-3"
                              >
                                <span>
                                  <span className="block font-bold uppercase tracking-[0.12em] text-teal">Source</span>
                                  {rec.sourceSystem} · {sourceVersion}
                                </span>
                                <span>
                                  <span className="block font-bold uppercase tracking-[0.12em] text-teal">Grade</span>
                                  {gradeLabel || "Clinician review"}
                                </span>
                                <span>
                                  <span className="block font-bold uppercase tracking-[0.12em] text-teal">Rule version</span>
                                  <span className="font-mono text-[10px]" data-testid="recommendation-engine-stamp">
                                    {rec.engineVersion || "unstamped"}
                                  </span>
                                </span>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-secondary">{rec.patientFriendlyExplanation}</p>
                              <p className="mt-2 text-xs leading-5 text-muted">{rec.rationale}</p>
                              <div className="mt-4 rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-white/[0.045] p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Next step</p>
                                  <span className="text-[10px] text-muted">
                                    Opens the care directory. No order is placed here.
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
                                      onClick={() => void startReferralConsent(rec, primaryAction)}
                                      className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-muted transition hover:border-teal/25 hover:text-teal"
                                    >
                                      Start referral
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
                                  {activeReferralPanel?.loading ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                                      <Loader2 size={11} className="animate-spin" />
                                      {activeReferralPanel.status || "Working..."}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-[11px] leading-5 text-muted">
                                  {primaryAction ? `${nextStepLabel(primaryAction)} is the clinical task. ` : ""}
                                  {hasLocationContext
                                    ? "Provider search will use the location context you provided."
                                    : "Provider search will ask for a city or ZIP before returning local results."}
                                </p>
                                {activeReferralPanel && !activeReferralPanel.loading ? (
                                  <div
                                    data-testid="screening-referral-consent-panel"
                                    className="mt-4 overflow-hidden rounded-[24px] border border-white/12 bg-[#070b0b]/92 shadow-[0_22px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl"
                                  >
                                    {activeReferralPanel.error ? (
                                      <p className="m-4 rounded-[16px] border border-red-300/20 bg-red-400/[0.08] p-3 text-xs leading-5 text-red-100">{activeReferralPanel.error}</p>
                                    ) : null}
                                    {activeReferralPanel.preview ? (
                                      <div className="space-y-4 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
                                          <div>
                                            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100">
                                              <ShieldCheck size={13} />
                                              Consent preview
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-primary">Choose exactly what OpenRx may share.</p>
                                          </div>
                                          {activeReferralPanel.preview.evidence?.sourceUrl ? (
                                            <a
                                              href={activeReferralPanel.preview.evidence.sourceUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-2.5 py-1 text-[11px] font-semibold text-cyan-100 hover:border-cyan-200/40"
                                            >
                                              {activeReferralPanel.preview.evidence.sourceSystem} {activeReferralPanel.preview.evidence.evidenceGrade}
                                              <ExternalLink size={10} />
                                            </a>
                                          ) : null}
                                        </div>
                                        <p className="text-xs leading-5 text-secondary">
                                          {activeReferralPanel.preview.message}
                                        </p>

                                        {activeReferralPanel.preview.referralTargets.length > 0 ? (
                                          <div className="space-y-2">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Choose one verified provider</p>
                                            {activeReferralPanel.preview.referralTargets.map((provider) => (
                                              <label
                                                key={provider.id}
                                                className={cn(
                                                  "flex cursor-pointer items-start gap-3 rounded-[18px] border p-3 transition",
                                                  activeReferralPanel.selectedProviderId === provider.id
                                                    ? "border-cyan-200/28 bg-cyan-200/[0.08]"
                                                    : "border-white/10 bg-white/[0.045] hover:border-white/18 hover:bg-white/[0.07]"
                                                )}
                                              >
                                                <input
                                                  type="radio"
                                                  name={`referral-provider-${rec.id}`}
                                                  className="mt-1 accent-cyan-200"
                                                  checked={activeReferralPanel.selectedProviderId === provider.id}
                                                  onChange={() => setReferralPanel((current) => current ? {
                                                    ...current,
                                                    selectedProviderId: provider.id,
                                                    error: undefined,
                                                  } : current)}
                                                />
                                                <span className="min-w-0 flex-1">
                                                  <span className="block text-xs font-semibold text-primary">{provider.name}</span>
                                                  <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-cyan-200/18 bg-cyan-200/[0.08] px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                                                    <ShieldCheck size={10} />
                                                    {provider.specialty || "OpenRx network provider"} - verified + BAA
                                                  </span>
                                                  {provider.address ? (
                                                    <span className="mt-1 block text-[11px] text-muted">{provider.address}</span>
                                                  ) : null}
                                                  <span className="mt-1 block text-[10px] text-muted">
                                                    Listed insurance is self-reported; confirm with the provider.
                                                  </span>
                                                </span>
                                              </label>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="rounded-xl border border-yellow-700/20 bg-yellow-100/20 p-3">
                                            <p className="text-xs leading-5 text-yellow-900">
                                              No partnered provider can receive PHI for this recommendation yet. You can still prepare a navigation request or contact public directory entries directly.
                                            </p>
                                            {primaryAction ? (
                                              <button
                                                type="button"
                                                className="mt-2 rounded-2xl border border-yellow-700/20 bg-white/60 px-3 py-2 text-xs font-semibold text-yellow-900"
                                                onClick={() => void requestScreeningNextStep(rec, primaryAction)}
                                              >
                                                Prepare navigation request
                                              </button>
                                            ) : null}
                                          </div>
                                        )}

                                        {activeReferralPanel.preview.seededContactOnly.length > 0 ? (
                                          <div className="space-y-2">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Public directory only</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                              {activeReferralPanel.preview.seededContactOnly.slice(0, 4).map((provider) => (
                                                <div key={provider.id} className="rounded-[16px] border border-white/10 bg-white/[0.04] p-3">
                                                  <p className="text-xs font-semibold text-primary">{provider.name}</p>
                                                  <p className="text-[11px] text-muted mt-1">{provider.statusLabel}</p>
                                                  {provider.phone ? <p className="text-[11px] text-muted mt-1">{provider.phone}</p> : null}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : null}

                                        {activeReferralPanel.preview.supported ? (
                                          <div className="space-y-3 rounded-[22px] border border-white/12 bg-white/[0.045] p-3">
                                            <div className="grid gap-2 sm:grid-cols-3">
                                              <div className="rounded-[16px] border border-white/10 bg-black/20 p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100">Who</p>
                                                <p className="mt-1 text-sm font-semibold text-primary">{selectedProvider?.name || "Choose a verified provider"}</p>
                                                <p className="mt-1 text-[11px] leading-5 text-secondary">
                                                  {selectedProvider ? `${selectedProvider.specialty || "OpenRx network provider"} - verified + BAA` : "No PHI can move until one provider is selected."}
                                                </p>
                                              </div>
                                              <div className="rounded-[16px] border border-white/10 bg-black/20 p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100">Why</p>
                                                <p className="mt-1 text-sm font-semibold text-primary">{rec.screeningName}</p>
                                                <p className="mt-1 text-[11px] leading-5 text-secondary">{rec.sourceSystem} - {sourceVersion} - {gradeLabel || "Clinician review"}</p>
                                              </div>
                                              <div className="rounded-[16px] border border-white/10 bg-black/20 p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100">Proof</p>
                                                <p className="mt-1 break-all font-mono text-[10px] leading-5 text-secondary">
                                                  {(activeReferralPanel.preview.disclosurePayloadHash || "").slice(0, 18) || "Preview hash"}...
                                                </p>
                                                <p className="mt-1 text-[11px] leading-5 text-secondary">
                                                  Consent text {activeReferralPanel.preview.consentTextVersion || "versioned"}; legal basis {activeReferralPanel.preview.legalBasis || "undetermined"}.
                                                </p>
                                              </div>
                                            </div>

                                            <details className="group rounded-[18px] border border-white/10 bg-black/18 p-3" open>
                                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left">
                                                <span>
                                                  <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                                                    <FileText size={13} />
                                                    Exact payload values
                                                  </span>
                                                  <span className="mt-1 block text-[11px] leading-5 text-secondary">
                                                    Required fields are the minimum needed for this referral. Optional fields start off and only share if you select them.
                                                  </span>
                                                </span>
                                                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] font-semibold text-secondary">
                                                  {selectedFields.length}/{activeReferralPanel.preview.displayedFields.length} selected
                                                </span>
                                              </summary>
                                              <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                                                {activeReferralPanel.preview.displayedFields.map((field) => {
                                                  const checked = activeReferralPanel.selectedFieldIds.includes(field.path)
                                                  return (
                                                    <li
                                                      key={field.path}
                                                      data-testid="referral-disclosure-field"
                                                      data-required={field.required ? "true" : "false"}
                                                      className={cn(
                                                        "rounded-[16px] border p-3 transition",
                                                        checked ? "border-cyan-200/22 bg-cyan-200/[0.07]" : "border-white/10 bg-white/[0.035]"
                                                      )}
                                                    >
                                                      <label className="flex cursor-pointer items-start gap-2">
                                                        <input
                                                          type="checkbox"
                                                          className="mt-1"
                                                          checked={checked}
                                                          data-testid={field.required ? "referral-required-field-toggle" : "referral-optional-field-toggle"}
                                                          onChange={(event) => setReferralPanel((current) => {
                                                            if (!current) return current
                                                            const next = new Set(current.selectedFieldIds)
                                                            if (event.target.checked) next.add(field.path)
                                                            else next.delete(field.path)
                                                            return {
                                                              ...current,
                                                              selectedFieldIds: Array.from(next),
                                                              error: undefined,
                                                            }
                                                          })}
                                                        />
                                                        <span className="min-w-0 flex-1">
                                                          <span className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-primary">
                                                            {field.label}
                                                            <span className={cn(
                                                              "rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em]",
                                                              field.required ? "border-cyan-200/24 text-cyan-100" : "border-white/12 text-secondary"
                                                            )}>
                                                              {field.required ? "required" : "optional"}
                                                            </span>
                                                          </span>
                                                          <span className="mt-1 block break-words text-[11px] leading-5 text-secondary">
                                                            {formatDisclosureValue(field.value)}
                                                          </span>
                                                          <span className="mt-1 block break-all font-mono text-[10px] text-muted">{field.path}</span>
                                                          {field.required && !checked ? (
                                                            <span className="mt-2 block rounded-lg border border-amber-300/20 bg-amber-300/[0.08] px-2 py-1.5 text-[10.5px] leading-5 text-amber-100">
                                                              {field.requiredReason || "This field is required to make the referral meaningful."}
                                                            </span>
                                                          ) : null}
                                                        </span>
                                                      </label>
                                                    </li>
                                                  )
                                                })}
                                              </ul>
                                            </details>

                                            <div className="rounded-[18px] border border-white/10 bg-black/18 p-3 text-[11px] leading-5 text-secondary">
                                              <p className="flex items-start gap-2">
                                                <ClipboardCheck size={14} className="mt-0.5 shrink-0 text-cyan-100" />
                                                Share creates one consent for this provider and this recommendation only. OpenRx does not place an order.
                                              </p>
                                              <p className="mt-2 flex items-start gap-2">
                                                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-cyan-100" />
                                                You can revoke future disclosures. Already-sent data cannot be recalled from the provider.
                                              </p>
                                            </div>

                                            {missingRequiredFields.length ? (
                                              <div
                                                role="alert"
                                                data-testid="referral-required-field-warning"
                                                className="rounded-[16px] border border-amber-300/24 bg-amber-300/[0.08] p-3 text-[11px] leading-5 text-amber-100"
                                              >
                                                Share is paused because required fields were removed. Re-select them or decline without sharing.
                                              </div>
                                            ) : null}

                                            <div className="grid gap-2 sm:grid-cols-2">
                                              <button
                                                type="button"
                                                data-testid="referral-decline-share"
                                                onClick={() => setReferralPanel(null)}
                                                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-white/14 bg-white/[0.045] px-4 py-2 text-xs font-semibold text-primary transition hover:bg-white/[0.08]"
                                              >
                                                <X size={13} />
                                                Decline / do not share
                                              </button>
                                              <button
                                                type="button"
                                                data-testid="referral-create-request"
                                                disabled={
                                                  !activeReferralPanel.selectedProviderId ||
                                                  missingRequiredFields.length > 0 ||
                                                  Boolean(activeReferralPanel.preview.created)
                                                }
                                                onClick={() => void submitReferralConsent()}
                                                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-cyan-200/18 bg-cyan-200 px-4 py-2 text-xs font-semibold text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                                              >
                                                <Check size={13} />
                                                Share selected fields
                                                <ArrowRight size={12} />
                                              </button>
                                            </div>
                                          </div>
                                        ) : null}

                                        {activeReferralPanel.preview.created ? (
                                          <div className="rounded-[20px] border border-emerald-300/20 bg-emerald-300/[0.08] p-4 text-xs leading-5 text-emerald-100">
                                            <p className="flex items-center gap-2 font-semibold text-emerald-50">
                                              <Check size={14} />
                                              Consent receipt issued
                                            </p>
                                            <p className="mt-2">
                                              Referral {activeReferralPanel.preview.created.referral.id} is {activeReferralPanel.preview.created.referral.status}. Payload hash {activeReferralPanel.preview.created.consent.disclosurePayloadHash || activeReferralPanel.preview.created.consent.scopeHash}.
                                            </p>
                                            {activeReferralPanel.preview.created.consent.receipt ? (
                                              <p className="mt-2">
                                                Shared {activeReferralPanel.preview.created.consent.receipt.fields.length} field(s) with {activeReferralPanel.preview.created.consent.receipt.providerName} for {activeReferralPanel.preview.created.consent.receipt.sourceRec.screeningName}.
                                              </p>
                                            ) : null}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
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
