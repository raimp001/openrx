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

export function safeSessionGetItem(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSessionSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false
  try {
    window.sessionStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function safeSessionRemoveItem(key: string): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Storage can be blocked in sandboxed iframes. Handoffs should still work
    // through URL parameters for non-PHI operational context.
  }
}

export function providerSearchHrefFromHandoff(query: string, source: ProviderHandoffPayload["source"] = "link") {
  const params = new URLSearchParams({
    handoff: source === "chat" ? "chat" : "screening",
    autorun: "1",
    q: query,
  })
  return `/providers?${params.toString()}`
}

export function schedulingHrefFromHandoff(payload: SchedulingHandoffPayload) {
  const params = new URLSearchParams({
    handoff: "provider",
    source: payload.source,
    providerName: payload.providerName,
    providerKind: payload.providerKind,
    reason: payload.reason,
  })
  if (payload.specialty) params.set("specialty", payload.specialty)
  if (payload.npi) params.set("npi", payload.npi)
  if (payload.phone) params.set("phone", payload.phone)
  if (payload.fullAddress) params.set("fullAddress", payload.fullAddress)
  if (payload.query) params.set("query", payload.query)
  return `/scheduling?${params.toString()}`
}

export function fallbackHrefForCareHandoff(action: CareHandoffAction) {
  if (action.storageKey === PROVIDER_HANDOFF_STORAGE_KEY) {
    return providerSearchHrefFromHandoff((action.payload as ProviderHandoffPayload).query, (action.payload as ProviderHandoffPayload).source)
  }
  if (action.storageKey === SCHEDULING_HANDOFF_STORAGE_KEY) {
    return schedulingHrefFromHandoff(action.payload as SchedulingHandoffPayload)
  }
  const payload = action.payload as ScreeningHandoffPayload
  const params = new URLSearchParams({
    handoff: payload.source,
    autorun: payload.autorun ? "1" : "0",
    prompt: payload.narrative,
  })
  return `/screening?${params.toString()}`
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

// A small, in-process "action plan" derivation that produces clinically
// restrained next-step cards for the chat UI. This is intentionally rule-based
// — keep it conservative so we never imply ordering/booking has happened.
export interface ActionPlanItem {
  id: string
  label: string
  description: string
  href: string
  kind: "schedule" | "screening" | "lab" | "referral" | "message" | "call" | "education"
}

const SOURCE_LINKS: Array<{ pattern: RegExp; label: string; url: string }> = [
  {
    pattern: /\b(colon|colorectal|fit-?dna|fobt|colonoscop|sigmoidoscop)/i,
    label: "USPSTF: Colorectal cancer screening",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening",
  },
  {
    pattern: /\b(mammogram|breast\s*cancer|brca)/i,
    label: "USPSTF: Breast cancer screening",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/breast-cancer-screening",
  },
  {
    pattern: /\b(lung|ldct|smoker|smoking)/i,
    label: "USPSTF: Lung cancer screening",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/lung-cancer-screening",
  },
  {
    pattern: /\b(cervical|pap|hpv)/i,
    label: "USPSTF: Cervical cancer screening",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/cervical-cancer-screening",
  },
]

export function buildActionPlan(message: string, agentId: string): ActionPlanItem[] {
  const trimmed = message.trim()
  if (!trimmed) return []
  const lowered = trimmed.toLowerCase()
  const items: ActionPlanItem[] = []

  const pushUnique = (item: ActionPlanItem) => {
    if (!items.find((i) => i.id === item.id)) items.push(item)
  }

  const screeningKeywords = includesAny(lowered, SCREENING_TERMS) || agentId === "screening"
  const careSearchKeywords = includesAny(lowered, CARE_SEARCH_TERMS) || agentId === "scheduling"
  const billingKeywords = includesAny(lowered, BILLING_TERMS) || agentId === "billing"

  if (screeningKeywords) {
    pushUnique({
      id: "check-screening-eligibility",
      label: "Review screening eligibility",
      description: "Run the OpenRx screening engine against this patient context.",
      href: `/screening?handoff=chat&autorun=1&prompt=${encodeURIComponent(trimmed)}`,
      kind: "screening",
    })
    pushUnique({
      id: "schedule-screening",
      label: "Find a screening center",
      description: "Search nearby imaging, lab, or endoscopy partners.",
      href: `/providers?handoff=chat&autorun=1&q=${encodeURIComponent(trimmed)}`,
      kind: "lab",
    })
    pushUnique({
      id: "schedule-followup",
      label: "Schedule clinician follow-up",
      description: "Book a visit to confirm and order the study.",
      href: "/scheduling?handoff=chat&reason=screening-followup",
      kind: "schedule",
    })
  } else if (careSearchKeywords) {
    pushUnique({
      id: "find-provider",
      label: "Search the care network",
      description: "Find an in-network provider for this need.",
      href: `/providers?handoff=chat&autorun=1&q=${encodeURIComponent(trimmed)}`,
      kind: "referral",
    })
    pushUnique({
      id: "schedule-appointment",
      label: "Book an appointment",
      description: "Hand off to scheduling with this context.",
      href: "/scheduling?handoff=chat",
      kind: "schedule",
    })
  } else if (billingKeywords) {
    pushUnique({
      id: "open-billing",
      label: "Review coverage &amp; billing",
      description: "Open the billing workspace for this question.",
      href: "/billing?handoff=chat",
      kind: "education",
    })
    pushUnique({
      id: "open-prior-auth",
      label: "Open prior auth",
      description: "If a service is being denied, draft a PA.",
      href: "/prior-auth?handoff=chat",
      kind: "referral",
    })
  } else if (agentId === "rx" || /\b(medication|prescription|drug|interaction|refill|pharmacy)\b/.test(lowered)) {
    pushUnique({
      id: "find-pharmacy",
      label: "Find a pharmacy",
      description: "Search nearby pharmacies and check stock.",
      href: "/pharmacy?handoff=chat",
      kind: "referral",
    })
    pushUnique({
      id: "review-prescriptions",
      label: "Review medications",
      description: "Open the prescription list for reconciliation.",
      href: "/prescriptions?handoff=chat",
      kind: "education",
    })
  } else if (agentId === "triage" || /\b(symptom|pain|fever|cough|chest|shortness|stroke)\b/.test(lowered)) {
    pushUnique({
      id: "triage-followup",
      label: "Open triage workspace",
      description: "Capture symptoms and route urgency.",
      href: "/dashboard",
      kind: "schedule",
    })
    pushUnique({
      id: "triage-call",
      label: "Call patient (private)",
      description: "Use the OpenRx outreach line — your number stays private.",
      href: "/outreach",
      kind: "call",
    })
  }

  // Always provide a guideline source link when one of the canned topics matches.
  for (const source of SOURCE_LINKS) {
    if (source.pattern.test(trimmed) || source.pattern.test(agentId)) {
      pushUnique({
        id: `source-${source.url}`,
        label: source.label,
        description: "Open the official guideline.",
        href: source.url,
        kind: "education",
      })
      break
    }
  }

  return items.slice(0, 4)
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
    return null
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
