import OpenAI from "openai"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import type { ScreeningAssessment } from "@/lib/basehealth"

export interface ScreeningEvidenceCitation {
  id: string
  title: string
  source: string
  publishedAt?: string
  url: string
  type: "guideline" | "paper"
  summary: string
}

type OpenAIEvidenceMode = "auto" | "web" | "off"

export interface OpenAIClinicalEvidenceConfig {
  enabled: boolean
  mode: OpenAIEvidenceMode
  model: string
  allowedDomains: string[]
  timeoutMs: number
}

interface PubMedSearchResponse {
  esearchresult?: {
    idlist?: string[]
  }
}

interface PubMedSummaryArticle {
  uid?: string
  title?: string
  pubdate?: string
  fulljournalname?: string
}

interface PubMedSummaryResponse {
  result?: {
    uids?: string[]
    [uid: string]: unknown
  }
}

const DEFAULT_OPENAI_EVIDENCE_MODEL = "gpt-5.4"
const DEFAULT_OPENAI_EVIDENCE_TIMEOUT_MS = 16000
const DEFAULT_OPENAI_EVIDENCE_ALLOWED_DOMAINS = [
  "uspreventiveservicestaskforce.org",
  "cdc.gov",
  "cancer.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "nccn.org",
  "acog.org",
  "auanet.org",
  "cancer.org",
  "radiologyinfo.org",
]

const USPSTF_SCREENING_LINKS: Array<{
  id: string
  title: string
  url: string
  summary: string
}> = [
  {
    id: "uspstf-adults",
    title: "USPSTF A and B Recommendations",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-a-and-b-recommendations",
    summary: "High-priority preventive services recommended for adults.",
  },
  {
    id: "uspstf-brca",
    title: "USPSTF BRCA-Related Cancer Recommendation",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/brca-related-cancer-risk-assessment-genetic-counseling-and-genetic-testing",
    summary: "Guidance for BRCA risk assessment and referral for counseling/testing.",
  },
  {
    id: "uspstf-prostate",
    title: "USPSTF Prostate Cancer Screening",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/prostate-cancer-screening",
    summary: "Shared decision framework for PSA-based prostate cancer screening.",
  },
  {
    id: "uspstf-colorectal",
    title: "USPSTF Colorectal Cancer Screening",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening",
    summary: "Routine colorectal screening recommendations and intervals for adults.",
  },
  {
    id: "uspstf-breast",
    title: "USPSTF Breast Cancer Screening",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/breast-cancer-screening",
    summary: "Biennial mammography recommendations for women in the screening age range.",
  },
  {
    id: "uspstf-cervical",
    title: "USPSTF Cervical Cancer Screening",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/cervical-cancer-screening",
    summary: "Pap and HPV-based cervical cancer screening interval guidance.",
  },
  {
    id: "uspstf-lung",
    title: "USPSTF Lung Cancer Screening",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/lung-cancer-screening",
    summary: "Annual LDCT screening criteria for eligible adults with significant smoking history.",
  },
  {
    id: "uspstf-aaa",
    title: "USPSTF Abdominal Aortic Aneurysm Screening",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/abdominal-aortic-aneurysm-screening",
    summary: "One-time ultrasonography screening guidance for eligible men who have ever smoked.",
  },
  {
    id: "cdc-cancer-screening",
    title: "CDC Cancer Screening Overview",
    url: "https://www.cdc.gov/cancer/prevention/screening.html",
    summary: "Patient-friendly overview of breast, cervical, colorectal, and lung cancer screening.",
  },
]

export function buildUspstfGuidelineCitations(): ScreeningEvidenceCitation[] {
  return USPSTF_SCREENING_LINKS.map((entry) => ({
    id: entry.id,
    title: entry.title,
    source: "USPSTF",
    url: entry.url,
    type: "guideline",
    summary: entry.summary,
  }))
}

function parseList(input: string[] | undefined, fallback: string[] = []): string[] {
  return Array.isArray(input) ? input : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeEnvMode(value?: string): OpenAIEvidenceMode {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "off") return "off"
  if (normalized === "web") return "web"
  return "auto"
}

function parseAllowedDomains(value?: string): string[] {
  const domains = (value || "")
    .split(",")
    .map((item) => item.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter(Boolean)

  return Array.from(new Set(domains.length ? domains : DEFAULT_OPENAI_EVIDENCE_ALLOWED_DOMAINS))
}

function parseTimeoutMs(value?: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 3000) return DEFAULT_OPENAI_EVIDENCE_TIMEOUT_MS
  return Math.min(parsed, 30000)
}

export function resolveOpenAIClinicalEvidenceConfig(
  env: Record<string, string | undefined> = process.env
): OpenAIClinicalEvidenceConfig {
  const mode = normalizeEnvMode(env.OPENRX_OPENAI_EVIDENCE_MODE)
  const hasKey = Boolean(env.OPENAI_API_KEY?.trim())

  return {
    enabled: mode !== "off" && hasKey,
    mode,
    model: env.OPENRX_OPENAI_EVIDENCE_MODEL?.trim() || DEFAULT_OPENAI_EVIDENCE_MODEL,
    allowedDomains: parseAllowedDomains(env.OPENRX_OPENAI_EVIDENCE_ALLOWED_DOMAINS),
    timeoutMs: parseTimeoutMs(env.OPENRX_OPENAI_EVIDENCE_TIMEOUT_MS),
  }
}

function buildEvidenceTerms(params: {
  assessment: ScreeningAssessment
  symptoms?: string[]
  familyHistory?: string[]
  conditions?: string[]
}): string[] {
  const recTopics = params.assessment.recommendedScreenings
    .slice(0, 3)
    .map((item) => item.name.toLowerCase())
  const riskTopics = params.assessment.factors
    .filter((factor) => factor.scoreDelta > 0)
    .slice(0, 3)
    .map((factor) => factor.label.toLowerCase())
  const symptomTopics = parseList(params.symptoms)
    .map((item) => item.toLowerCase())
    .slice(0, 2)
  const historyTopics = parseList(params.familyHistory)
    .map((item) => item.toLowerCase())
    .slice(0, 2)
  const conditionTopics = parseList(params.conditions)
    .map((item) => item.toLowerCase())
    .slice(0, 2)

  return Array.from(new Set([...recTopics, ...riskTopics, ...symptomTopics, ...historyTopics, ...conditionTopics]))
    .filter(Boolean)
    .slice(0, 4)
}

function safeRecommendationSnapshot(assessment: ScreeningAssessment) {
  const structured = assessment.structuredRecommendations?.slice(0, 8).map((rec) => ({
    screeningName: rec.screeningName,
    status: rec.status,
    riskCategory: rec.riskCategory,
    sourceSystem: rec.sourceSystem,
    evidenceGrade: rec.evidenceGrade,
    requiresClinicianReview: rec.requiresClinicianReview,
    recommendedNextStep: rec.recommendedNextStep,
    patientFriendlyExplanation: rec.patientFriendlyExplanation,
    nextSteps: rec.nextSteps,
  }))

  return {
    riskTier: assessment.riskTier,
    riskFactors: assessment.factors.slice(0, 8).map((factor) => ({
      label: factor.label,
      impact: factor.impact,
      evidence: factor.evidence,
    })),
    recommendations:
      structured && structured.length > 0
        ? structured
        : assessment.recommendedScreenings.slice(0, 8).map((rec) => ({
            screeningName: rec.name,
            priority: rec.priority,
            recommendedNextStep: rec.reason,
          })),
    safetyMessages: assessment.safetyMessages || [],
  }
}

export function buildOpenAIClinicalEvidencePrompt(params: {
  assessment: ScreeningAssessment
  symptoms?: string[]
  familyHistory?: string[]
  conditions?: string[]
}): string {
  const safePayload = {
    assessment: safeRecommendationSnapshot(params.assessment),
    volunteeredContext: {
      symptoms: parseList(params.symptoms).slice(0, 6),
      familyHistory: parseList(params.familyHistory).slice(0, 6),
      conditions: parseList(params.conditions).slice(0, 6),
    },
  }

  return [
    "You are supporting OpenRx's preventive screening evidence review.",
    "Use web search to check current, source-backed clinical guideline and literature context for the screening recommendations below.",
    "Prioritize USPSTF for average-risk screening. Use NCCN, ACG/USMSTF, ACOG, AUA, CDC, NCI, ACS, and PubMed-indexed literature only when relevant.",
    "Do not diagnose, do not say a test is definitely required, do not imply OpenRx can order care, and do not guarantee insurance coverage.",
    "If hereditary risk, family history, symptoms, personal cancer history, or incomplete information changes the pathway, say clinician review is needed.",
    "Return concise clinician-readable bullets with visible source citations. Include what is supported, what is uncertain, and what question should be asked next.",
    "Do not include chain-of-thought. Do not include wallet addresses, patient identifiers, or other account identifiers.",
    "",
    JSON.stringify(safePayload, null, 2),
  ].join("\n")
}

async function searchPubMed(term: string): Promise<ScreeningEvidenceCitation[]> {
  const query = `${term} preventive screening`
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=2&term=${encodeURIComponent(query)}`
  const searchResponse = await fetchWithTimeout(searchUrl, { next: { revalidate: 86400 } }, 10000)
  if (!searchResponse.ok) return []

  const searchPayload = (await searchResponse.json()) as PubMedSearchResponse
  const ids = searchPayload.esearchresult?.idlist || []
  if (ids.length === 0) return []

  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`
  const summaryResponse = await fetchWithTimeout(summaryUrl, { next: { revalidate: 86400 } }, 10000)
  if (!summaryResponse.ok) return []

  const summaryPayload = (await summaryResponse.json()) as PubMedSummaryResponse
  const uids = summaryPayload.result?.uids || []
  const citations: ScreeningEvidenceCitation[] = []
  for (const uid of uids) {
    const raw = summaryPayload.result?.[uid]
    if (!raw || typeof raw !== "object") continue
    const article = raw as PubMedSummaryArticle
    if (!article.uid || !article.title) continue

    citations.push({
      id: `pubmed-${article.uid}`,
      title: article.title,
      source: article.fulljournalname || "PubMed",
      ...(article.pubdate ? { publishedAt: article.pubdate } : {}),
      url: `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`,
      type: "paper",
      summary: `Evidence source matched for topic: ${term}.`,
    })
  }

  return citations
}

function stableId(input: string): string {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0
  }
  return Math.abs(hash).toString(36)
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "OpenAI web search"
  }
}

function inferCitationType(url: string, title = ""): ScreeningEvidenceCitation["type"] {
  const source = `${url} ${title}`.toLowerCase()
  if (source.includes("pubmed") || source.includes("doi.org") || source.includes("journal")) return "paper"
  return "guideline"
}

function summarizeCitationContext(text: string, start?: number, end?: number): string {
  if (typeof start === "number" && typeof end === "number" && start >= 0 && end > start) {
    return text
      .slice(Math.max(0, start - 180), Math.min(text.length, end + 220))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 420)
  }

  return "Source cited by the OpenAI evidence search while checking the advanced screening review."
}

function extractOpenAIWebCitations(response: unknown): ScreeningEvidenceCitation[] {
  if (!isRecord(response)) return []

  const outputText = typeof response.output_text === "string" ? response.output_text : ""
  const output = Array.isArray(response.output) ? response.output : []
  const citations: ScreeningEvidenceCitation[] = []
  const seen = new Set<string>()

  const addCitation = (input: { url: string; title?: string; start?: number; end?: number }) => {
    if (!input.url || seen.has(input.url)) return
    seen.add(input.url)
    const host = hostFromUrl(input.url)
    citations.push({
      id: `openai-web-${stableId(input.url)}`,
      title: input.title || host,
      source: host,
      url: input.url,
      type: inferCitationType(input.url, input.title),
      summary: summarizeCitationContext(outputText, input.start, input.end),
    })
  }

  for (const item of output) {
    if (!isRecord(item)) continue

    if (item.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (!isRecord(part) || !Array.isArray(part.annotations)) continue
        for (const annotation of part.annotations) {
          if (!isRecord(annotation) || annotation.type !== "url_citation") continue
          const url = typeof annotation.url === "string" ? annotation.url : ""
          const title = typeof annotation.title === "string" ? annotation.title : undefined
          const start = typeof annotation.start_index === "number" ? annotation.start_index : undefined
          const end = typeof annotation.end_index === "number" ? annotation.end_index : undefined
          addCitation({ url, title, start, end })
        }
      }
    }

    if (item.type === "web_search_call" && isRecord(item.action) && Array.isArray(item.action.sources)) {
      for (const source of item.action.sources) {
        if (!isRecord(source)) continue
        const url = typeof source.url === "string" ? source.url : ""
        addCitation({ url })
      }
    }
  }

  return citations.slice(0, 6)
}

function evidenceModelFallbacks(primaryModel: string): string[] {
  return Array.from(new Set([primaryModel, "gpt-5.2", "gpt-5"]))
}

function getErrorStatus(error: unknown): number | undefined {
  return isRecord(error) && typeof error.status === "number" ? error.status : undefined
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.toLowerCase() : ""
}

function canRetryWithFallbackModel(error: unknown): boolean {
  const status = getErrorStatus(error)
  const message = getErrorMessage(error)
  return (
    status === 400 ||
    status === 404 ||
    message.includes("model") ||
    message.includes("unsupported")
  )
}

async function buildOpenAIClinicalEvidence(params: {
  assessment: ScreeningAssessment
  symptoms?: string[]
  familyHistory?: string[]
  conditions?: string[]
}): Promise<ScreeningEvidenceCitation[]> {
  const config = resolveOpenAIClinicalEvidenceConfig()
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!config.enabled || !apiKey) return []

  try {
    const client = new OpenAI({ apiKey })
    const input = buildOpenAIClinicalEvidencePrompt(params)
    let lastError: unknown = null

    for (const model of evidenceModelFallbacks(config.model)) {
      try {
        const response = await client.responses.create(
          {
            model,
            reasoning: { effort: "low" },
            store: false,
            max_output_tokens: 1000,
            include: ["web_search_call.action.sources"],
            tools: [
              {
                type: "web_search",
                search_context_size: "medium",
                filters: { allowed_domains: config.allowedDomains },
              },
            ],
            input,
          },
          { timeout: config.timeoutMs }
        )

        return extractOpenAIWebCitations(response)
      } catch (error) {
        lastError = error
        if (!canRetryWithFallbackModel(error)) break
      }
    }

    throw lastError
  } catch {
    return []
  }
}

export async function buildScreeningEvidence(params: {
  assessment: ScreeningAssessment
  symptoms?: string[]
  familyHistory?: string[]
  conditions?: string[]
}): Promise<ScreeningEvidenceCitation[]> {
  const topics = buildEvidenceTerms(params)
  const [openAIEvidence, pubmedResults] = await Promise.all([
    buildOpenAIClinicalEvidence(params),
    Promise.all(
      topics.map(async (topic) => {
        try {
          return await searchPubMed(topic)
        } catch {
          return []
        }
      })
    ),
  ])

  const papers = pubmedResults.flat()
  const dedupe = new Set<string>()
  const uniquePapers = papers.filter((paper) => {
    if (dedupe.has(paper.id)) return false
    dedupe.add(paper.id)
    return true
  })

  const guidelines = buildUspstfGuidelineCitations()

  return [...guidelines, ...openAIEvidence, ...uniquePapers].slice(0, 12)
}
