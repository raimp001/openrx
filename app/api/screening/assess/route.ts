import { NextRequest, NextResponse } from "next/server"
import {
  assessHealthScreening,
  type ScreeningAssessment,
  type ScreeningFactor,
  type ScreeningInput,
  type ScreeningRecommendation,
} from "@/lib/basehealth"
import {
  buildScreeningEvidence,
  buildUspstfGuidelineCitations,
  type ScreeningEvidenceCitation,
} from "@/lib/screening-evidence"
import {
  CARE_SEARCH_PROMPT_ID,
  CARE_SEARCH_PROMPT_IMAGE_PATH,
  CARE_SEARCH_PROMPT_TEXT,
  buildPatientLocalCareQuery,
  searchNpiCareDirectory,
  type CareDirectoryMatch,
  type CareSearchType,
} from "@/lib/npi-care-search"
import { getLiveSnapshotByWallet } from "@/lib/live-data.server"
import { createEmptyLiveSnapshot } from "@/lib/live-data-types"
import { prisma } from "@/lib/db"
import { verifyScreeningAccess } from "@/lib/screening-access"

type ScreeningAnalysisLevel = "preview" | "deep"

interface ScreeningLocalCareConnection {
  recommendationId: string
  recommendationName: string
  reason: string
  services: CareSearchType[]
  query: string
  riskContext: string
  ready: boolean
  clarificationQuestion?: string
  prompt: {
    id: typeof CARE_SEARCH_PROMPT_ID
    image: typeof CARE_SEARCH_PROMPT_IMAGE_PATH
    text: string
  }
  matches: CareDirectoryMatch[]
}

type ScreeningAssessmentPayload = ScreeningAssessment & {
  localCareConnections: ScreeningLocalCareConnection[]
  evidenceCitations: ScreeningEvidenceCitation[]
  accessLevel: ScreeningAnalysisLevel
  isPreview: boolean
  upgradeMessage?: string
}

const CARE_MATCH_LIMIT = 10
const MAX_CONNECTIONS = 3
const GENETIC_MARKERS = [
  "brca1",
  "brca2",
  "palb2",
  "atm",
  "chek2",
  "hoxb13",
  "lynch",
  "mlh1",
  "msh2",
  "msh6",
  "pms2",
  "apc",
  "mutyh",
  "epcam",
]
const FAMILY_TERMS = [
  "family history",
  "mother",
  "father",
  "brother",
  "sister",
  "sibling",
  "parent",
  "uncle",
  "aunt",
  "grandmother",
  "grandfather",
  "cousin",
]
const BRCA_PROSTATE_MARKERS = ["brca1", "brca2", "palb2", "atm", "chek2", "hoxb13", "prostate cancer"]
const COLORECTAL_MARKERS = ["colorectal cancer", "colon cancer", "rectal cancer", "colorectal", "colon"]
const POLYPOSIS_MARKERS = [
  "polyposis",
  "familial adenomatous polyposis",
  "fap",
  "mutyh-associated polyposis",
  "apc",
  "mutyh",
]
const LYNCH_MARKERS = ["lynch", "mlh1", "msh2", "msh6", "pms2", "epcam"]

function resolveAnalysisLevel(value?: string | null): ScreeningAnalysisLevel {
  return value === "deep" ? "deep" : "preview"
}

function normalizeTerms(input?: string[]): string[] {
  return Array.isArray(input) ? input.map((item) => item.toLowerCase().trim()).filter(Boolean) : []
}

function hasGeneticSignal(term: string): boolean {
  if (!term) return false
  return (
    GENETIC_MARKERS.some((marker) => term.includes(marker)) ||
    term.includes("mutation") ||
    term.includes("carrier") ||
    term.includes("genetic") ||
    term.includes("gene")
  )
}

function sanitizePreviewInput(input: ScreeningInput): ScreeningInput {
  return {
    ...input,
    conditions: (input.conditions || []).filter((condition) => !hasGeneticSignal(condition.toLowerCase())),
    familyHistory: (input.familyHistory || []).filter((entry) => !hasGeneticSignal(entry.toLowerCase())),
  }
}

function withRecommendation(
  recommendations: ScreeningRecommendation[],
  candidate: ScreeningRecommendation
): ScreeningRecommendation[] {
  if (recommendations.some((entry) => entry.id === candidate.id)) return recommendations
  return [...recommendations, candidate]
}

function withAction(actions: string[], candidate: string): string[] {
  if (actions.includes(candidate)) return actions
  return [...actions, candidate]
}

function withFactor(factors: ScreeningFactor[], candidate: ScreeningFactor): ScreeningFactor[] {
  if (factors.some((factor) => factor.label === candidate.label)) return factors
  return [...factors, candidate]
}

function hasAnySignal(terms: string[], targets: string[]): boolean {
  return terms.some((term) => targets.some((target) => term.includes(target)))
}

function applyGeneticsDeepDive(
  assessment: ScreeningAssessment,
  input: ScreeningInput
): ScreeningAssessment {
  const terms = [...normalizeTerms(input.conditions), ...normalizeTerms(input.familyHistory)]
  const geneticsTerms = terms.filter((term) => hasGeneticSignal(term))
  const hasFamilyContext = hasAnySignal(terms, FAMILY_TERMS)
  const hasProstateSignal = hasAnySignal(terms, BRCA_PROSTATE_MARKERS)
  const hasColorectalSignal = hasAnySignal(terms, COLORECTAL_MARKERS)
  const hasPolyposisSignal = hasAnySignal(terms, POLYPOSIS_MARKERS)
  const hasLynchSignal = hasAnySignal(terms, LYNCH_MARKERS)
  const hasProstateFamilyRisk = hasFamilyContext && hasProstateSignal
  const hasColorectalFamilyRisk = hasFamilyContext && (hasColorectalSignal || hasPolyposisSignal)

  if (
    geneticsTerms.length === 0 &&
    !hasProstateFamilyRisk &&
    !hasColorectalFamilyRisk &&
    !hasLynchSignal &&
    !hasPolyposisSignal
  ) {
    return assessment
  }

  let recommendations = assessment.recommendedScreenings
  let nextActions = assessment.nextActions
  let factors = assessment.factors
  let riskBoost = 0
  const mention = GENETIC_MARKERS.filter((marker) => geneticsTerms.some((term) => term.includes(marker)))

  if (geneticsTerms.length > 0 || hasProstateFamilyRisk || hasColorectalFamilyRisk) {
    recommendations = withRecommendation(recommendations, {
      id: "genetics-counseling-cascade",
      name: "Hereditary-risk counseling and cascade testing",
      priority: "high",
      ownerAgent: "screening",
      reason:
        "Inherited-risk signals warrant counseling plus family cascade testing and personalized preventive intervals.",
    })
  }

  if (
    mention.some((marker) => ["brca1", "brca2", "palb2", "atm", "chek2", "hoxb13"].includes(marker)) ||
    hasProstateFamilyRisk
  ) {
    factors = withFactor(factors, {
      label: "Inherited prostate-cancer risk context",
      impact: "elevated",
      scoreDelta: 8,
      evidence:
        "Family prostate history and/or germline markers can warrant earlier or more intensive surveillance planning.",
    })
    riskBoost += 8

    recommendations = withRecommendation(recommendations, {
      id: "hereditary-prostate-screening-pathway",
      name: "Hereditary-risk prostate screening pathway",
      priority: "high",
      ownerAgent: "screening",
      reason:
        "Family prostate cancer and related germline markers can justify earlier or intensified prostate screening strategy.",
    })
    nextActions = withAction(
      nextActions,
      "Capture which relatives had prostate cancer and diagnosis ages so start-age decisions can be personalized."
    )
  }

  if (
    mention.some((marker) => ["lynch", "mlh1", "msh2", "msh6", "pms2", "apc", "mutyh", "epcam"].includes(marker)) ||
    hasLynchSignal ||
    hasPolyposisSignal ||
    hasColorectalFamilyRisk
  ) {
    factors = withFactor(factors, {
      label: "Inherited colorectal/polyposis risk context",
      impact: "elevated",
      scoreDelta: 9,
      evidence:
        "Family colorectal history, polyposis syndromes, or Lynch-spectrum markers support intensified colorectal surveillance.",
    })
    riskBoost += 9

    recommendations = withRecommendation(recommendations, {
      id: "hereditary-colorectal-surveillance",
      name: "Hereditary colorectal/polyposis surveillance pathway",
      priority: "high",
      ownerAgent: "screening",
      reason:
        "Family colorectal/polyposis or Lynch-spectrum signals support earlier and more frequent surveillance planning.",
    })
    nextActions = withAction(
      nextActions,
      "Bring prior colonoscopy records, pathology, and any APC/MUTYH/Lynch reports to your next screening visit."
    )
  }

  if (geneticsTerms.length > 0) {
    factors = withFactor(factors, {
      label: "Reported germline mutation signal",
      impact: "elevated",
      scoreDelta: 7,
      evidence: "Known germline mutation status can materially change preventive screening cadence.",
    })
    riskBoost += 7
  }

  nextActions = withAction(
    nextActions,
    "Share prior genetic test reports and family diagnosis ages with your care team to lock in precise screening timing."
  )

  const boostedScore = Math.max(0, Math.min(100, assessment.overallRiskScore + riskBoost))

  return {
    ...assessment,
    overallRiskScore: boostedScore,
    riskTier: boostedScore >= 65 ? "high" : boostedScore >= 35 ? "moderate" : "low",
    factors: factors.sort((a, b) => b.scoreDelta - a.scoreDelta),
    recommendedScreenings: recommendations,
    nextActions,
  }
}

function inferServiceTypes(rec: ScreeningRecommendation): CareSearchType[] {
  const text = `${rec.name} ${rec.reason}`.toLowerCase()
  const serviceTypes = new Set<CareSearchType>()

  if (
    text.includes("a1c") ||
    text.includes("panel") ||
    text.includes("microalbumin") ||
    text.includes("blood") ||
    text.includes("urine")
  ) {
    serviceTypes.add("lab")
  }

  if (
    text.includes("ct") ||
    text.includes("radiology") ||
    text.includes("imaging") ||
    text.includes("mammography") ||
    text.includes("x-ray") ||
    text.includes("xray")
  ) {
    serviceTypes.add("radiology")
  }

  if (
    text.includes("retinal") ||
    text.includes("exam") ||
    text.includes("screening") ||
    text.includes("vaccine") ||
    text.includes("clinician")
  ) {
    serviceTypes.add("provider")
  }

  if (serviceTypes.size === 0 || rec.priority !== "low") {
    serviceTypes.add("provider")
  }

  return Array.from(serviceTypes)
}

function inferSpecialtyHint(rec: ScreeningRecommendation): string | undefined {
  const text = `${rec.name} ${rec.reason}`.toLowerCase()
  if (text.includes("hereditary") || text.includes("genetic") || text.includes("mutation")) {
    return "Medical Genetics"
  }
  if (text.includes("diabetes") || text.includes("a1c")) return "Endocrinology"
  if (text.includes("kidney") || text.includes("microalbumin")) return "Nephrology"
  if (text.includes("retinal") || text.includes("eye")) return "Ophthalmology"
  if (text.includes("lung")) return "Pulmonary Disease"
  if (text.includes("colon")) return "Gastroenterology"
  if (text.includes("hypertension") || text.includes("blood pressure")) return "Cardiology"
  if (text.includes("vaccine")) return "Family Medicine"
  return undefined
}

function buildRiskContext(assessment: ScreeningAssessment): string {
  const drivers = assessment.factors
    .filter((factor) => factor.scoreDelta > 0)
    .slice(0, 3)
    .map((factor) => factor.label)
  if (drivers.length === 0) {
    return "Preventive continuity and routine monitoring."
  }
  return `Top risk drivers: ${drivers.join(", ")}.`
}

async function buildLocalCareConnections(
  assessment: ScreeningAssessment,
  patientAddress: string
): Promise<ScreeningLocalCareConnection[]> {
  const primaryRecommendations = assessment.recommendedScreenings
    .filter((rec) => rec.priority !== "low")
    .slice(0, MAX_CONNECTIONS)
  const selectedRecommendations =
    primaryRecommendations.length > 0
      ? primaryRecommendations
      : assessment.recommendedScreenings.slice(0, MAX_CONNECTIONS)
  const riskContext = buildRiskContext(assessment)
  const connections: ScreeningLocalCareConnection[] = []

  for (const recommendation of selectedRecommendations) {
    const services = inferServiceTypes(recommendation)
    const specialtyHint = inferSpecialtyHint(recommendation)
    const query = buildPatientLocalCareQuery({
      requestedServices: services,
      specialtyHint,
      patientAddress,
    })

    try {
      const searchResult = await searchNpiCareDirectory(query, {
        limit: CARE_MATCH_LIMIT,
      })

      connections.push({
        recommendationId: recommendation.id,
        recommendationName: recommendation.name,
        reason: recommendation.reason,
        services,
        query,
        riskContext,
        ready: searchResult.ready,
        clarificationQuestion: searchResult.clarificationQuestion,
        prompt: searchResult.prompt,
        matches: searchResult.matches,
      })
    } catch {
      connections.push({
        recommendationId: recommendation.id,
        recommendationName: recommendation.name,
        reason: recommendation.reason,
        services,
        query,
        riskContext,
        ready: false,
        clarificationQuestion: "Unable to fetch nearby NPI records right now.",
        prompt: {
          id: CARE_SEARCH_PROMPT_ID,
          image: CARE_SEARCH_PROMPT_IMAGE_PATH,
          text: CARE_SEARCH_PROMPT_TEXT,
        },
        matches: [],
      })
    }
  }

  return connections
}

async function loadSnapshotForRequest(params: {
  walletAddress?: string
  patientId?: string
}) {
  try {
    if (params.walletAddress) {
      return getLiveSnapshotByWallet(params.walletAddress)
    }

    if (params.patientId) {
      const patient = await prisma.patientProfile.findUnique({
        where: { id: params.patientId },
        include: { user: { select: { walletAddress: true } } },
      })
      const wallet = patient?.user.walletAddress || undefined
      return getLiveSnapshotByWallet(wallet)
    }

    return getLiveSnapshotByWallet(undefined)
  } catch (error) {
    console.error("Screening snapshot fallback engaged:", error)
    return createEmptyLiveSnapshot(params.walletAddress || null)
  }
}

async function buildAssessmentPayload(
  input: ScreeningInput & { walletAddress?: string },
  options: { analysisLevel: ScreeningAnalysisLevel }
): Promise<ScreeningAssessmentPayload> {
  const snapshot = await loadSnapshotForRequest({
    walletAddress: input.walletAddress,
    patientId: input.patientId,
  })

  const livePatient = snapshot.patient
  const screeningInput =
    options.analysisLevel === "preview" ? sanitizePreviewInput(input) : input

  const assessment = assessHealthScreening({
    ...screeningInput,
    patient: livePatient
      ? {
          id: livePatient.id,
          date_of_birth: livePatient.date_of_birth,
          medical_history: livePatient.medical_history,
        }
      : undefined,
    vitals: snapshot.vitals.map((vital) => ({
      systolic: vital.systolic,
      diastolic: vital.diastolic,
    })),
    labs: snapshot.labResults.map((lab) => ({
      test_name: lab.test_name,
      results: lab.results.map((result) => ({ value: result.value })),
      status: lab.status,
    })),
    vaccinations: snapshot.vaccinations.map((vaccination) => ({
      vaccine_name: vaccination.vaccine_name,
      status: vaccination.status,
    })),
  })
  const enrichedAssessment =
    options.analysisLevel === "deep" ? applyGeneticsDeepDive(assessment, input) : assessment

  const patientAddress = livePatient?.address || process.env.OPENRX_DEFAULT_PATIENT_LOCATION || ""
  const localCareConnections =
    options.analysisLevel === "deep"
      ? await buildLocalCareConnections(enrichedAssessment, patientAddress)
      : []
  const evidenceCitations =
    options.analysisLevel === "deep"
      ? await buildScreeningEvidence({
          assessment: enrichedAssessment,
          symptoms: input.symptoms,
          familyHistory: input.familyHistory,
        })
      : buildUspstfGuidelineCitations()
  const nextActions =
    options.analysisLevel === "preview"
      ? withAction(
          enrichedAssessment.nextActions,
          "Unlock the deep-dive for genetics-aware intervals, paper-backed evidence, and nearby care routing."
        )
      : enrichedAssessment.nextActions
  return {
    ...enrichedAssessment,
    nextActions,
    localCareConnections,
    evidenceCitations,
    accessLevel: options.analysisLevel,
    isPreview: options.analysisLevel === "preview",
    ...(options.analysisLevel === "preview"
      ? {
          upgradeMessage:
            "Free preview is ready. Deep dive unlocks inherited-risk personalization, full evidence synthesis, and local care routing.",
        }
      : {}),
  }
}

function paymentRequiredResponse(input: {
  reason?: string
  fee: string
  recipientAddress: string
}) {
  return NextResponse.json(
    {
      error: input.reason || "Personalized screening payment is required.",
      requiresPayment: true,
      fee: input.fee,
      currency: "USDC",
      recipientAddress: input.recipientAddress,
    },
    { status: 402 }
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get("patientId") || undefined
    const walletAddress = searchParams.get("walletAddress") || undefined
    const paymentId = searchParams.get("paymentId") || undefined
    const analysisLevel = resolveAnalysisLevel(searchParams.get("analysisLevel"))

    if (analysisLevel === "deep") {
      const access = await verifyScreeningAccess({ walletAddress, paymentId })
      if (!access.ok) {
        return paymentRequiredResponse({
          reason: access.reason,
          fee: access.fee,
          recipientAddress: access.recipientAddress,
        })
      }
    }

    const assessment = await buildAssessmentPayload(
      { patientId, walletAddress },
      { analysisLevel }
    )
    return NextResponse.json(assessment)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute screening assessment."
    return NextResponse.json(
      {
        error: message || "Failed to compute screening assessment.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScreeningInput & {
      walletAddress?: string
      paymentId?: string
      analysisLevel?: ScreeningAnalysisLevel
    }
    const analysisLevel = resolveAnalysisLevel(body.analysisLevel)
    if (analysisLevel === "deep") {
      const access = await verifyScreeningAccess({
        walletAddress: body.walletAddress,
        paymentId: body.paymentId,
      })
      if (!access.ok) {
        return paymentRequiredResponse({
          reason: access.reason,
          fee: access.fee,
          recipientAddress: access.recipientAddress,
        })
      }
    }
    const assessment = await buildAssessmentPayload(body, { analysisLevel })
    return NextResponse.json(assessment)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute screening assessment."
    return NextResponse.json(
      { error: message || "Failed to compute screening assessment." },
      { status: 500 }
    )
  }
}
