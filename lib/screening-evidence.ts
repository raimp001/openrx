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

function buildEvidenceTerms(params: {
  assessment: ScreeningAssessment
  symptoms?: string[]
  familyHistory?: string[]
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

  return Array.from(new Set([...recTopics, ...riskTopics, ...symptomTopics, ...historyTopics]))
    .filter(Boolean)
    .slice(0, 4)
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

export async function buildScreeningEvidence(params: {
  assessment: ScreeningAssessment
  symptoms?: string[]
  familyHistory?: string[]
}): Promise<ScreeningEvidenceCitation[]> {
  const topics = buildEvidenceTerms(params)
  const pubmedResults = await Promise.all(
    topics.map(async (topic) => {
      try {
        return await searchPubMed(topic)
      } catch {
        return []
      }
    })
  )

  const papers = pubmedResults.flat()
  const dedupe = new Set<string>()
  const uniquePapers = papers.filter((paper) => {
    if (dedupe.has(paper.id)) return false
    dedupe.add(paper.id)
    return true
  })

  const guidelines = buildUspstfGuidelineCitations()

  return [...guidelines, ...uniquePapers].slice(0, 10)
}
