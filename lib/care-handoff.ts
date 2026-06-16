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
  source: "chat" | "link" | "screening"
  query: string
  autorun: boolean
  createdAt: number
  recommendationId?: string
  recommendationName?: string
  sourceSystem?: string
  sourceVersion?: string
  evidenceGrade?: string
  sourceUrl?: string
  locationHint?: string
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

const TRIAL_TERMS = [
  "clinical trial",
  "trial",
  "study",
  "studies",
  "research",
  "enrollment",
  "enroll",
  "recruiting",
]

const PROVIDER_NETWORK_TERMS = [
  "join network",
  "provider onboarding",
  "provider sign up",
  "physician participate",
  "provider participate",
  "clinician participate",
  "onboard",
  "accept referrals",
  "receive referrals",
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

function careDirectoryQueryForMessage(value: string) {
  const lowered = value.toLowerCase()
  const location = value.match(/\b\d{5}(?:-\d{4})?\b/)?.[0]

  if (/\b(colon|colorectal|fit|cologuard|colonoscop)/.test(lowered)) {
    return `Find primary care, gastroenterology, and colonoscopy centers${location ? ` near ${location}` : " near me"}`
  }
  if (/\b(mammogram|breast|brca)/.test(lowered)) {
    return `Find primary care and mammography imaging centers${location ? ` near ${location}` : " near me"}`
  }
  if (/\b(cervical|pap|hpv)/.test(lowered)) {
    return `Find primary care and gynecology clinics${location ? ` near ${location}` : " near me"}`
  }
  if (/\b(lung|ldct|smok|pack[- ]?years?)/.test(lowered)) {
    return `Find primary care and radiology centers for lung cancer screening${location ? ` near ${location}` : " near me"}`
  }
  if (/\b(prostate|psa)/.test(lowered)) {
    return `Find primary care and urology clinics${location ? ` near ${location}` : " near me"}`
  }
  if (/\b(lab|laboratory|blood work|blood test|testing)/.test(lowered)) {
    return `Find labs${location ? ` near ${location}` : " near me"}`
  }
  if (/\b(radiology|imaging|scan|mri|ct|ultrasound|x-?ray)/.test(lowered)) {
    return `Find imaging centers${location ? ` near ${location}` : " near me"}`
  }
  if (/\b(caregiver|home care|home health)/.test(lowered)) {
    return `Find caregiver and home health options${location ? ` near ${location}` : " near me"}`
  }

  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length >= 8 && compact.length <= 130) return compact
  return `Find primary care and screening options${location ? ` near ${location}` : " near me"}`
}

function trialConditionForMessage(value: string) {
  const lowered = value.toLowerCase()
  if (/\b(prostate|psa)\b/.test(lowered)) return "prostate cancer"
  if (/\b(breast|brca)\b/.test(lowered)) return "breast cancer"
  if (/\b(colon|colorectal|fit|colonoscop)\b/.test(lowered)) return "colorectal cancer"
  if (/\b(lung|ldct|smok)\b/.test(lowered)) return "lung cancer"
  if (/\b(cervical|pap|hpv)\b/.test(lowered)) return "cervical cancer"
  if (/\bcancer\b/.test(lowered)) return "cancer"
  return ""
}

function clinicalTrialsHrefFromMessage(value: string) {
  const condition = trialConditionForMessage(value)
  const location = value.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] || ""
  const params = new URLSearchParams({ handoff: "chat", autorun: "1" })
  if (condition) params.set("condition", condition)
  if (location) params.set("location", location)
  return `/clinical-trials?${params.toString()}`
}

function pharmacyHrefFromMessage(value: string) {
  const location = value.match(/\b\d{5}(?:-\d{4})?\b/)?.[0]
  const q = /\b(pharmacy|prescription|refill|medication|drug)\b/i.test(value)
    ? value.replace(/\s+/g, " ").trim()
    : `Find pharmacy${location ? ` near ${location}` : " near me"}`
  const params = new URLSearchParams({ handoff: "chat", autorun: "1", q })
  return `/pharmacy?${params.toString()}`
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
  actionType: "chat_prompt" | "external_link" | "tel_link" | "deep_link"
  href?: string
  prompt?: string
  targetAgentId?: "scheduling"
  requiresLocation?: boolean
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
  {
    pattern: /\b(prostate|psa)\b/i,
    label: "USPSTF: Prostate cancer screening discussion",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/prostate-cancer-screening",
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
  const trialKeywords = includesAny(lowered, TRIAL_TERMS) || agentId === "trials"
  const providerNetworkKeywords = includesAny(lowered, PROVIDER_NETWORK_TERMS)
  const billingKeywords = includesAny(lowered, BILLING_TERMS) || agentId === "billing"
  if (screeningKeywords) {
    const directoryQuery = careDirectoryQueryForMessage(trimmed)
    pushUnique({
      id: "schedule-screening",
      label: "Find who to call",
      description: "Stay in chat, ask for ZIP if needed, then list public clinic phone numbers.",
      actionType: "chat_prompt",
      prompt: "Find a clinic or screening site for these recommendations.",
      targetAgentId: "scheduling",
      requiresLocation: true,
      kind: "lab",
    })
    pushUnique({
      id: "open-care-directory",
      label: "Open care directory",
      description: "Search providers, labs, and imaging centers for this screening need.",
      actionType: "deep_link",
      href: providerSearchHrefFromHandoff(directoryQuery, "screening"),
      kind: "referral",
    })
    pushUnique({
      id: "schedule-followup",
      label: "Prepare call script",
      description: "Turn this answer into a short script for primary care or the screening site.",
      actionType: "chat_prompt",
      prompt: "Help me prepare what to say when I call about these recommendations.",
      kind: "schedule",
    })
    const trialHref = clinicalTrialsHrefFromMessage(trimmed)
    if (trialKeywords || trialConditionForMessage(trimmed)) {
      pushUnique({
        id: "open-trials",
        label: "Search trials",
        description: "Open clinical trial candidates. This does not assert eligibility.",
        actionType: "deep_link",
        href: trialHref,
        kind: "education",
      })
    }
  } else if (careSearchKeywords) {
    const directoryQuery = careDirectoryQueryForMessage(trimmed)
    pushUnique({
      id: "open-care-directory",
      label: "Open care directory",
      description: "Search public provider, lab, imaging, and caregiver results with this request.",
      actionType: "deep_link",
      href: providerSearchHrefFromHandoff(directoryQuery, "chat"),
      kind: "referral",
    })
    pushUnique({
      id: "find-provider",
      label: "Find phone numbers",
      description: "Ask for ZIP if needed, then return public clinic numbers.",
      actionType: "chat_prompt",
      prompt: "Find care options near me.",
      targetAgentId: "scheduling",
      requiresLocation: true,
      kind: "referral",
    })
    pushUnique({
      id: "schedule-appointment",
      label: "Call script",
      description: "Prepare a concise script for calling the clinic.",
      actionType: "chat_prompt",
      prompt: "Help me prepare a short call script for this appointment.",
      kind: "schedule",
    })
    if (/\b(provider|physician|clinician|doctor|clinic).*\b(join|onboard|participate|network|referral)/.test(lowered) || providerNetworkKeywords) {
      pushUnique({
        id: "join-provider-network",
        label: "Join as provider",
        description: "Open provider onboarding for verified referral participation.",
        actionType: "deep_link",
        href: "/join-network",
        kind: "referral",
      })
    }
  } else if (billingKeywords) {
    pushUnique({
      id: "open-billing",
      label: "Explain coverage",
      description: "Stay in chat and ask only for the bill/plan details needed.",
      actionType: "chat_prompt",
      prompt: "Help me understand my bill or coverage question.",
      kind: "education",
    })
    pushUnique({
      id: "open-prior-auth",
      label: "Prior auth help",
      description: "Clarify whether prior auth support may be needed.",
      actionType: "chat_prompt",
      prompt: "Could this next step need prior authorization?",
      kind: "referral",
    })
  } else if (agentId === "rx" || /\b(medication|prescription|drug|interaction|refill|pharmacy)\b/.test(lowered)) {
    pushUnique({
      id: "open-pharmacy-search",
      label: "Open pharmacy search",
      description: "Search public pharmacy directory results with this request.",
      actionType: "deep_link",
      href: pharmacyHrefFromMessage(trimmed),
      kind: "referral",
    })
    pushUnique({
      id: "find-pharmacy",
      label: "Find pharmacy numbers",
      description: "Ask for ZIP if needed, then list public pharmacy phone numbers.",
      actionType: "chat_prompt",
      prompt: "Find a pharmacy near me.",
      targetAgentId: "scheduling",
      requiresLocation: true,
      kind: "referral",
    })
    pushUnique({
      id: "review-prescriptions",
      label: "Review meds safely",
      description: "Stay in chat and clarify medication names, doses, and red flags.",
      actionType: "chat_prompt",
      prompt: "Help me review this medication question safely.",
      kind: "education",
    })
  } else if (agentId === "triage" || /\b(symptom|pain|fever|cough|chest|shortness|stroke)\b/.test(lowered)) {
    pushUnique({
      id: "triage-followup",
      label: "Find urgent care numbers",
      description: "If not an emergency, ask for ZIP and list places to call.",
      actionType: "chat_prompt",
      prompt: "If this is not an emergency, find urgent care near me.",
      targetAgentId: "scheduling",
      requiresLocation: true,
      kind: "referral",
    })
    pushUnique({
      id: "triage-safety",
      label: "check red flags",
      description: "Stay in chat and clarify red flags before choosing the next step.",
      actionType: "chat_prompt",
      prompt: "What warning signs would make this urgent?",
      kind: "message",
    })
  }

  if (trialKeywords && !items.find((item) => item.id === "open-trials")) {
    pushUnique({
      id: "open-trials",
      label: "Search trials",
      description: "Open clinical trial candidates. This does not assert eligibility.",
      actionType: "deep_link",
      href: clinicalTrialsHrefFromMessage(trimmed),
      kind: "education",
    })
  }

  if (providerNetworkKeywords && !items.find((item) => item.id === "join-provider-network")) {
    pushUnique({
      id: "join-provider-network",
      label: "Join as provider",
      description: "Open provider onboarding for verified referral participation.",
      actionType: "deep_link",
      href: "/join-network",
      kind: "referral",
    })
  }

  // Always provide a guideline source link when one of the canned topics matches.
  for (const source of SOURCE_LINKS) {
    if (source.pattern.test(trimmed) || source.pattern.test(agentId)) {
      pushUnique({
        id: `source-${source.url}`,
        label: source.label,
        description: "Open the official guideline.",
        actionType: "external_link",
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
