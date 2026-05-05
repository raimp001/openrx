export const SCREENING_HANDOFF_STORAGE_KEY = "openrx:screening-handoff"
export const PROVIDER_HANDOFF_STORAGE_KEY = "openrx:provider-handoff"
export const SCHEDULING_HANDOFF_STORAGE_KEY = "openrx:scheduling-handoff"

export interface ScreeningHandoffPayload {
  source: "chat" | "link"
  narrative: string
  autorun: boolean
  createdAt: number
}

export interface ProviderHandoffPayload {
  source: "chat" | "link"
  query: string
  autorun: boolean
  createdAt: number
}

export interface SchedulingHandoffPayload {
  source: "provider" | "screening" | "chat"
  providerName: string
  providerKind: string
  specialty?: string
  npi?: string
  phone?: string
  fullAddress?: string
  reason: string
  query?: string
  createdAt: number
}

export interface CareHandoffAction {
  label: string
  href: string
  storageKey: typeof SCREENING_HANDOFF_STORAGE_KEY | typeof PROVIDER_HANDOFF_STORAGE_KEY | typeof SCHEDULING_HANDOFF_STORAGE_KEY
  payload: ScreeningHandoffPayload | ProviderHandoffPayload | SchedulingHandoffPayload
}

const SCREENING_TERMS = [
  "screening",
  "risk",
  "risk score",
  "recommendation",
  "recommendations",
  "recs",
  "colonoscopy",
  "mammogram",
  "pap",
  "hpv",
  "ldct",
  "psa",
  "prostate",
  "colon",
  "colorectal",
  "brca",
  "lynch",
  "mutation",
  "germline",
  "family history",
]

const CARE_SEARCH_TERMS = [
  "provider",
  "doctor",
  "physician",
  "pcp",
  "primary care",
  "find care",
  "find a",
  "book",
  "schedule",
  "appointment",
  "specialist",
  "caregiver",
  "care network",
  "npi",
  "near me",
  "near",
  "radiology",
  "imaging",
  "mammogram center",
  "lab",
  "laboratory",
  "colonoscopy center",
  "clinic",
  "clinician",
]

const BILLING_TERMS = [
  "bill",
  "billing",
  "claim",
  "denial",
  "denied",
  "coverage",
  "insurance",
  "prior auth",
  "prior authorization",
  "cost",
  "copay",
  "estimate",
]

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term))
}

function hasClinicalContext(value: string) {
  return /\b(?:age\s*)?\d{2}\b/.test(value) || includesAny(value, ["father", "mother", "sibling", "smoker", "mutation"])
}

export function isFreshCareHandoff(createdAt?: number, ttlMs = 15 * 60 * 1000) {
  return typeof createdAt === "number" && Number.isFinite(createdAt) && Date.now() - createdAt <= ttlMs
}

export function resolveCareHandoff(message: string, agentId: string): CareHandoffAction | null {
  const trimmed = message.trim()
  if (!trimmed) return null

  const lowered = trimmed.toLowerCase()
  const now = Date.now()
  const looksLikeScreening =
    agentId === "screening" ||
    includesAny(lowered, SCREENING_TERMS) ||
    (hasClinicalContext(lowered) && includesAny(lowered, ["what should", "what do i need", "recommend", "recs"]))

  if (looksLikeScreening) {
    return {
      label: "Open screening plan",
      href: "/screening?handoff=chat",
      storageKey: SCREENING_HANDOFF_STORAGE_KEY,
      payload: {
        source: "chat",
        narrative: trimmed,
        autorun: true,
        createdAt: now,
      },
    }
  }

  const looksLikeCareSearch =
    agentId === "scheduling" ||
    includesAny(lowered, CARE_SEARCH_TERMS)

  if (looksLikeCareSearch) {
    return {
      label: "Search care network",
      href: "/providers?handoff=chat",
      storageKey: PROVIDER_HANDOFF_STORAGE_KEY,
      payload: {
        source: "chat",
        query: trimmed,
        autorun: true,
        createdAt: now,
      },
    }
  }

  if (agentId === "billing" || includesAny(lowered, BILLING_TERMS)) {
    return null
  }

  return null
}
