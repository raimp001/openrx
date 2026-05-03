import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

export const CARE_SEARCH_PROMPT_ID = "openrx.npi-care-search.v1" as const
export const CARE_SEARCH_PROMPT_IMAGE_PATH = "/prompts/npi-care-search-prompt.svg" as const

export const CARE_SEARCH_PROMPT_TEXT = `You are OpenRx Care Search.
Goal: Find providers, caregivers, laboratories, and radiology centers in NPI Registry using natural language.
Rules:
1) Extract intent (provider, caregiver, lab, radiology), specialty/role, and location (ZIP OR city OR city+state).
2) Do not run NPI search until enough info is present.
3) If info is missing, return one concise clarification question.
4) Prefer closest match for specialty and location, then active status.
5) Return structured results with NPI, type, specialty/taxonomy, phone, and full address.
6) Keep outputs patient-friendly and explain what was understood from the query.`

const NPPES_BASE = "https://npiregistry.cms.hhs.gov/api/?version=2.1"

const STATE_MAP: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
}

const STATE_ABBREVS = new Set(Object.values(STATE_MAP))

const SPECIALTY_MAP: Record<string, string> = {
  cardiologist: "Cardiology",
  cardiology: "Cardiology",
  dermatologist: "Dermatology",
  dermatology: "Dermatology",
  dentist: "Dentist",
  dental: "Dentist",
  endocrinologist: "Endocrinology",
  endocrinology: "Endocrinology",
  diabetes: "Endocrinology",
  "family medicine": "Family Medicine",
  "family doctor": "Family Medicine",
  "internal medicine": "Internal Medicine",
  "primary care": "Internal Medicine",
  pcp: "Internal Medicine",
  pediatrician: "Pediatrics",
  pediatrics: "Pediatrics",
  therapist: "Therapist",
  psychiatrist: "Psychiatry",
  psychiatry: "Psychiatry",
  radiology: "Radiology",
  radiologist: "Radiology",
  mammogram: "Radiology",
  mammography: "Radiology",
  ultrasound: "Radiology",
  imaging: "Radiology",
  neurology: "Neurology",
  neurologist: "Neurology",
  nephrology: "Nephrology",
  nephrologist: "Nephrology",
  oncology: "Oncology",
  oncologist: "Oncology",
  pulmonology: "Pulmonary Disease",
  pulmonologist: "Pulmonary Disease",
  ophthalmology: "Ophthalmology",
  ophthalmologist: "Ophthalmology",
  retina: "Ophthalmology",
  gastroenterology: "Gastroenterology",
  gastroenterologist: "Gastroenterology",
  colonoscopy: "Gastroenterology",
  "colon cancer screening": "Gastroenterology",
  "medical genetics": "Medical Genetics",
  geneticist: "Medical Genetics",
  "genetic counseling": "Genetic Counselor",
  "ob gyn": "Obstetrics & Gynecology",
  obgyn: "Obstetrics & Gynecology",
  gynecology: "Obstetrics & Gynecology",
}

const CAREGIVER_ROLE_MAP: Record<string, string> = {
  caregiver: "Home Health",
  "home health": "Home Health",
  "home health aide": "Home Health Aide",
  "personal care": "Personal Care Attendant",
  "personal care attendant": "Personal Care Attendant",
  nurse: "Registered Nurse",
  "registered nurse": "Registered Nurse",
  "nurse practitioner": "Nurse Practitioner",
  "social worker": "Clinical Social Worker",
  "occupational therapist": "Occupational Therapist",
  "physical therapist": "Physical Therapist",
  "speech therapist": "Speech-Language Pathologist",
  "behavior technician": "Behavior Technician",
}

const LAB_KEYWORDS = ["lab", "laboratory", "clinical laboratory", "pathology", "diagnostic lab"]
const RADIOLOGY_KEYWORDS = ["radiology", "imaging", "mri", "ct", "xray", "ultrasound", "mammogram", "mammography"]

const LOCATION_STOP_WORDS = new Set(
  [
    "find",
    "search",
    "look",
    "need",
    "want",
    "please",
    "for",
    "near",
    "in",
    "around",
    "nearby",
    "closest",
    "me",
    "provider",
    "providers",
    "doctor",
    "doctors",
    "caregiver",
    "caregivers",
    "lab",
    "labs",
    "laboratory",
    "radiology",
    "center",
    "centers",
    "clinic",
    "imaging",
  ]
    .concat(Object.keys(SPECIALTY_MAP).flatMap((item) => item.toLowerCase().split(/\s+/)))
    .concat(Object.keys(CAREGIVER_ROLE_MAP).flatMap((item) => item.toLowerCase().split(/\s+/)))
    .concat(LAB_KEYWORDS.flatMap((item) => item.toLowerCase().split(/\s+/)))
    .concat(RADIOLOGY_KEYWORDS.flatMap((item) => item.toLowerCase().split(/\s+/)))
)

export type CareSearchType = "provider" | "caregiver" | "lab" | "radiology"

export interface ParsedCareQuery {
  query: string
  serviceTypes: CareSearchType[]
  specialty?: string
  caregiverRole?: string
  city?: string
  state?: string
  zip?: string
  normalizedQuery: string
  ready: boolean
  missingInfo: string[]
  clarificationQuestion?: string
}

export interface CareDirectoryMatch {
  kind: CareSearchType
  npi: string
  name: string
  status: string
  specialty: string
  taxonomyCode: string
  phone: string
  fullAddress: string
  confidence: "high" | "medium"
}

interface RankedCareDirectoryMatch extends CareDirectoryMatch {
  locationMatched: boolean
  locationScore: number
  locationState: string
}

function toPublicCareDirectoryMatch(entry: RankedCareDirectoryMatch): CareDirectoryMatch {
  const { locationMatched, locationScore, locationState, ...publicEntry } = entry
  void locationMatched
  void locationScore
  void locationState
  return publicEntry
}

interface NppesAddress {
  address_purpose?: string
  address_1?: string
  address_2?: string
  city?: string
  state?: string
  postal_code?: string
  telephone_number?: string
  fax_number?: string
}

interface ParsedAddressMatch {
  address: NppesAddress
  matched: boolean
  score: number
}

interface NppesTaxonomy {
  code?: string
  desc?: string
  primary?: boolean
}

interface NppesBasic {
  first_name?: string
  last_name?: string
  organization_name?: string
  credential?: string
  gender?: string
  status?: string
  last_updated?: string
}

interface NppesResult {
  number?: string
  basic?: NppesBasic
  addresses?: NppesAddress[]
  taxonomies?: NppesTaxonomy[]
}

interface NppesResponse {
  result_count?: number
  results?: NppesResult[]
}

function includesAny(source: string, values: string[]): boolean {
  return values.some((value) => source.includes(value))
}

function parseLocation(working: string): {
  city?: string
  state?: string
  zip?: string
  cleaned: string
} {
  let text = working
  let zip: string | undefined
  let city: string | undefined
  let state: string | undefined
  const originalNormalized = working
    .toLowerCase()
    .replace(/[,.]+/g, " ")
    .replace(/\b(find|search|look|need|want|please|for|near|in|around|nearby|closest|me)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const zipMatch = text.match(/\b(\d{5})(?:-\d{4})?\b/)
  if (zipMatch) {
    zip = zipMatch[1]
    text = text.replace(zipMatch[0], " ")
  }

  if (originalNormalized === "new york") {
    city = "New York"
    state = "NY"
  }

  const lowered = text.toLowerCase()
  for (const [stateName, abbreviation] of Object.entries(STATE_MAP)) {
    if (!city && lowered.includes(stateName)) {
      state = abbreviation
      text = text.replace(new RegExp(stateName, "i"), " ")
      break
    }
  }

  if (!state) {
    const stateAbbrevMatch = text.match(/\b([A-Z]{2})\b/)
    if (stateAbbrevMatch && STATE_ABBREVS.has(stateAbbrevMatch[1])) {
      state = stateAbbrevMatch[1]
      text = text.replace(stateAbbrevMatch[0], " ")
    }
  }

  text = text.replace(/[,.]+/g, " ").replace(/\s+/g, " ").trim()

  const normalizedForCity = text
    .replace(/\b(find|search|look|need|want|please|for|near|in|around|nearby|closest|me)\b/gi, " ")
    .replace(
      /\b(provider|providers|doctor|doctors|caregiver|caregivers|lab|labs|laboratory|radiology|center|centers|clinic|imaging)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim()

  const normalizedSource = normalizedForCity.toLowerCase()

  if (normalizedSource === "new york") {
    city = "New York"
    state = "NY"
  }

  if (!city && normalizedForCity) {
    const words = normalizedForCity
      .split(" ")
      .map((word) => word.trim())
      .filter((word) => !!word && !LOCATION_STOP_WORDS.has(word.toLowerCase()))
    if (words.length <= 3) {
      city = words.join(" ")
    } else if (state && !zip) {
      city = words.slice(-3).join(" ")
    } else {
      city = words.slice(0, 3).join(" ")
    }
  }

  if (!city) {
    const nearMatch = working.match(/\b(?:near|in|around)\s+([a-zA-Z][a-zA-Z\s.'-]{1,80})$/i)
    if (nearMatch) {
      const fallbackWords = nearMatch[1]
        .replace(/[,.]+/g, " ")
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => !!word && !LOCATION_STOP_WORDS.has(word.toLowerCase()))
      if (fallbackWords.length > 0) {
        city = fallbackWords.slice(0, 3).join(" ")
      }
    }
  }

  return { city, state, zip, cleaned: text }
}

function extractMappedValue(input: string, map: Record<string, string>): string | undefined {
  const lowered = input.toLowerCase()
  let mapped: string | undefined
  for (const key of Object.keys(map)) {
    if (lowered.includes(key)) {
      mapped = map[key]
      break
    }
  }
  return mapped
}

function buildClarification(missingInfo: string[], parsed: ParsedCareQuery): string {
  if (missingInfo.length === 0) return ""
  if (missingInfo.length === 2) {
    return "Tell me both what you need and where. Example: 'Find a caregiver and radiology center near Seattle WA 98101'."
  }
  if (missingInfo[0] === "service") {
    return "What should I search for: provider, caregiver, lab, or radiology center?"
  }
  if (missingInfo.includes("location_detail") && parsed.state && !parsed.city && !parsed.zip) {
    return `I found state "${parsed.state}". Add a city, ZIP, or specialty so I can search that state accurately.`
  }
  if (!parsed.city && !parsed.zip && !parsed.state) {
    return "What city/state or ZIP should I search near?"
  }
  return "Please add the missing detail so I can run NPI search."
}

function requiresAdditionalStateDetail(parsed: {
  state?: string
  city?: string
  zip?: string
  specialty?: string
  caregiverRole?: string
  serviceTypes: CareSearchType[]
}): boolean {
  if (!parsed.state || parsed.city || parsed.zip) return false
  if (parsed.specialty || parsed.caregiverRole) return false
  return parsed.serviceTypes.length === 1 && parsed.serviceTypes[0] === "provider"
}

export function parseCareSearchQuery(query: string): ParsedCareQuery {
  const original = query.trim()
  let working = original
    .replace(/\b(find|search|look|need|want|please|for|near|in|around|nearby|closest|me)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

  const lowered = working.toLowerCase()
  const serviceTypes: CareSearchType[] = []

  if (includesAny(lowered, LAB_KEYWORDS)) serviceTypes.push("lab")
  if (includesAny(lowered, RADIOLOGY_KEYWORDS)) serviceTypes.push("radiology")
  if (extractMappedValue(lowered, CAREGIVER_ROLE_MAP)) serviceTypes.push("caregiver")
  if (extractMappedValue(lowered, SPECIALTY_MAP) || lowered.includes("provider") || lowered.includes("doctor")) {
    serviceTypes.push("provider")
  }

  const uniqueTypes: CareSearchType[] = Array.from(
    new Set<CareSearchType>(serviceTypes.length > 0 ? serviceTypes : ["provider"])
  )
  const specialty = extractMappedValue(lowered, SPECIALTY_MAP)
  const caregiverRole = extractMappedValue(lowered, CAREGIVER_ROLE_MAP)

  const location = parseLocation(original)
  working = location.cleaned

  const missingInfo: string[] = []
  if (!location.zip && !location.city && !location.state) missingInfo.push("location")
  const stateOnlyNeedsMoreDetail = requiresAdditionalStateDetail({
    state: location.state,
    city: location.city,
    zip: location.zip,
    specialty,
    caregiverRole,
    serviceTypes: uniqueTypes,
  })
  if (stateOnlyNeedsMoreDetail) missingInfo.push("location_detail")

  const ready = missingInfo.length === 0
  const parsed: ParsedCareQuery = {
    query: original,
    serviceTypes: uniqueTypes,
    specialty,
    caregiverRole,
    city: location.city,
    state: location.state,
    zip: location.zip,
    normalizedQuery: working,
    ready,
    missingInfo,
  }

  if (!ready) {
    parsed.clarificationQuestion = buildClarification(missingInfo, parsed)
  }

  return parsed
}

function applyLocation(params: URLSearchParams, parsed: ParsedCareQuery): void {
  if (parsed.city) params.set("city", parsed.city)
  if (parsed.state) params.set("state", parsed.state)
  if (parsed.zip) params.set("postal_code", parsed.zip)
}

interface SearchPlan {
  serviceType: CareSearchType
  params: URLSearchParams
  phase: "primary" | "fallback"
  note: string
}

function buildSearchPlan(parsed: ParsedCareQuery, limit: number): SearchPlan[] {
  const plans: SearchPlan[] = []
  const targetTypes = parsed.serviceTypes
  const normalizedHint = parsed.normalizedQuery.trim()
  const cityLower = (parsed.city || "").toLowerCase()
  const stateLower = (parsed.state || "").toLowerCase()
  const shouldUseOrgHint =
    normalizedHint.length >= 4 &&
    normalizedHint.toLowerCase() !== cityLower &&
    normalizedHint.toLowerCase() !== stateLower

  targetTypes.forEach((serviceType) => {
    const createParams = (input: {
      enumerationType: "NPI-1" | "NPI-2"
      taxonomyDescription?: string
      organizationName?: string
    }): URLSearchParams => {
      const params = new URLSearchParams()
      params.set("version", "2.1")
      params.set("limit", String(limit))
      params.set("skip", "0")
      params.set("enumeration_type", input.enumerationType)
      if (input.taxonomyDescription) params.set("taxonomy_description", input.taxonomyDescription)
      if (input.organizationName) params.set("organization_name", input.organizationName)
      applyLocation(params, parsed)
      return params
    }

    if (serviceType === "provider") {
      plans.push({
        serviceType,
        phase: "primary",
        note: "provider-individual-specialty",
        params: createParams({
          enumerationType: "NPI-1",
          ...(parsed.specialty ? { taxonomyDescription: parsed.specialty } : {}),
        }),
      })
      plans.push({
        serviceType,
        phase: "primary",
        note: "provider-organization-specialty",
        params: createParams({
          enumerationType: "NPI-2",
          ...(parsed.specialty ? { taxonomyDescription: parsed.specialty } : {}),
        }),
      })
      if (shouldUseOrgHint) {
        plans.push({
          serviceType,
          phase: "primary",
          note: "provider-organization-name",
          params: createParams({
            enumerationType: "NPI-2",
            organizationName: normalizedHint,
          }),
        })
      }
      plans.push({
        serviceType,
        phase: "fallback",
        note: "provider-individual-broad",
        params: createParams({ enumerationType: "NPI-1" }),
      })
      plans.push({
        serviceType,
        phase: "fallback",
        note: "provider-organization-broad",
        params: createParams({ enumerationType: "NPI-2" }),
      })
      return
    }

    if (serviceType === "caregiver") {
      plans.push({
        serviceType,
        phase: "primary",
        note: "caregiver-role",
        params: createParams({
          enumerationType: "NPI-1",
          taxonomyDescription: parsed.caregiverRole || "home health",
        }),
      })
      plans.push({
        serviceType,
        phase: "fallback",
        note: "caregiver-broad",
        params: createParams({ enumerationType: "NPI-1" }),
      })
      return
    }

    if (serviceType === "lab") {
      plans.push({
        serviceType,
        phase: "primary",
        note: "lab-taxonomy",
        params: createParams({ enumerationType: "NPI-2", taxonomyDescription: "laboratory" }),
      })
      plans.push({
        serviceType,
        phase: "fallback",
        note: "lab-broad",
        params: createParams({ enumerationType: "NPI-2" }),
      })
      return
    }

    if (serviceType === "radiology") {
      plans.push({
        serviceType,
        phase: "primary",
        note: "radiology-organization",
        params: createParams({ enumerationType: "NPI-2", taxonomyDescription: "radiology" }),
      })
      plans.push({
        serviceType,
        phase: "fallback",
        note: "radiology-individual",
        params: createParams({ enumerationType: "NPI-1", taxonomyDescription: "radiology" }),
      })
      plans.push({
        serviceType,
        phase: "fallback",
        note: "radiology-broad",
        params: createParams({ enumerationType: "NPI-2" }),
      })
    }
  })

  return plans
}

function classifyKind(desc: string, requested: CareSearchType): CareSearchType {
  const lowered = desc.toLowerCase()
  if (includesAny(lowered, RADIOLOGY_KEYWORDS)) return "radiology"
  if (includesAny(lowered, LAB_KEYWORDS)) return "lab"
  if (extractMappedValue(lowered, CAREGIVER_ROLE_MAP)) return "caregiver"
  if (requested === "provider") return "provider"
  return "provider"
}

function normalizeAddressText(value?: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function scoreAddressMatch(address: NppesAddress, parsed: ParsedCareQuery): number {
  const city = normalizeAddressText(address.city)
  const state = (address.state || "").toUpperCase()
  const zip = (address.postal_code || "").slice(0, 5)
  const parsedCity = normalizeAddressText(parsed.city)
  const parsedState = (parsed.state || "").toUpperCase()
  const parsedZip = (parsed.zip || "").slice(0, 5)

  if (parsedZip) {
    return zip === parsedZip ? 8 : 0
  }

  if (parsedCity && parsedState) {
    if (city !== parsedCity || state !== parsedState) return 0
    return 7
  }

  if (parsedCity) {
    return city === parsedCity ? 6 : 0
  }

  if (parsedState) {
    return state === parsedState ? 4 : 0
  }

  return 1
}

function chooseBestAddress(addresses: NppesAddress[], parsed: ParsedCareQuery): ParsedAddressMatch {
  const candidates = addresses.length > 0 ? addresses : [{}]
  let best: ParsedAddressMatch = {
    address: candidates[0] || {},
    matched: !parsed.city && !parsed.state && !parsed.zip,
    score: 0,
  }

  candidates.forEach((address) => {
    const score = scoreAddressMatch(address, parsed)
    const isLocation = address.address_purpose === "LOCATION"
    const bestIsLocation = best.address.address_purpose === "LOCATION"
    if (
      score > best.score ||
      (score === best.score && isLocation && !bestIsLocation)
    ) {
      best = {
        address,
        matched: score > 0 || (!parsed.city && !parsed.state && !parsed.zip),
        score,
      }
    }
  })

  return best
}

function mapResult(
  result: NppesResult,
  requested: CareSearchType,
  parsed: ParsedCareQuery
): RankedCareDirectoryMatch | null {
  if (!result.number) return null
  const basic = result.basic || {}
  const addresses = result.addresses || []
  const taxonomies = result.taxonomies || []
  const addressChoice = chooseBestAddress(addresses, parsed)
  const locationAddress = addressChoice.address || {}
  const taxonomy =
    taxonomies.find((entry) => entry.primary) ||
    taxonomies[0] ||
    {}
  const taxonomyDesc = taxonomy.desc || ""
  const kind = classifyKind(taxonomyDesc, requested)
  const taxonomyLower = taxonomyDesc.toLowerCase()
  const specialtyLower = parsed.specialty?.toLowerCase() || ""
  const roleLower = parsed.caregiverRole?.toLowerCase() || ""
  const parsedCityLower = normalizeAddressText(parsed.city)
  const resultCityLower = normalizeAddressText(locationAddress.city)
  const cityMatched = !!parsedCityLower && parsedCityLower === resultCityLower
  const isHighConfidence =
    (!!specialtyLower && taxonomyLower.includes(specialtyLower)) ||
    (!!roleLower && taxonomyLower.includes(roleLower)) ||
    cityMatched ||
    (kind === requested && (requested === "provider" || taxonomyLower.length > 0))

  const fullAddress = [
    locationAddress.address_1,
    locationAddress.address_2,
    `${locationAddress.city || ""}, ${locationAddress.state || ""} ${(locationAddress.postal_code || "").slice(0, 5)}`,
  ]
    .filter(Boolean)
    .join(", ")

  const fullName = basic.organization_name
    ? basic.organization_name
    : `${basic.first_name || ""} ${basic.last_name || ""}`.trim()

  return {
    kind,
    npi: result.number,
    name: fullName || "Unknown",
    status: basic.status === "A" ? "Active" : basic.status || "Active",
    specialty: taxonomyDesc,
    taxonomyCode: taxonomy.code || "",
    phone: locationAddress.telephone_number || "",
    fullAddress,
    confidence: isHighConfidence ? "high" : "medium",
    locationMatched: addressChoice.matched,
    locationScore: addressChoice.score,
    locationState: (locationAddress.state || "").toUpperCase(),
  }
}

function filterDominantStateForCityOnly(
  matches: RankedCareDirectoryMatch[],
  parsed: ParsedCareQuery
): RankedCareDirectoryMatch[] {
  if (!parsed.city || parsed.state || parsed.zip || matches.length === 0) return matches

  const counts = new Map<string, number>()
  matches.forEach((match) => {
    if (!match.locationState) return
    counts.set(match.locationState, (counts.get(match.locationState) || 0) + 1)
  })

  const rankedStates = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  if (rankedStates.length <= 1) return matches

  const [dominantState, dominantCount] = rankedStates[0]
  const secondCount = rankedStates[1]?.[1] || 0
  if (!dominantState || dominantCount <= secondCount) return matches

  return matches.filter((match) => match.locationState === dominantState)
}

export async function searchNpiCareDirectory(
  query: string,
  options?: { limit?: number }
): Promise<{
  ready: boolean
  parsed: ParsedCareQuery
  clarificationQuestion?: string
  prompt: {
    id: typeof CARE_SEARCH_PROMPT_ID
    image: typeof CARE_SEARCH_PROMPT_IMAGE_PATH
    text: string
  }
  matches: CareDirectoryMatch[]
}> {
  const parsed = parseCareSearchQuery(query)
  const limit = Math.min(Math.max(1, options?.limit || 20), 50)
  if (!parsed.ready) {
    return {
      ready: false,
      parsed,
      clarificationQuestion: parsed.clarificationQuestion,
      prompt: {
        id: CARE_SEARCH_PROMPT_ID,
        image: CARE_SEARCH_PROMPT_IMAGE_PATH,
        text: CARE_SEARCH_PROMPT_TEXT,
      },
      matches: [],
    }
  }

  const plan = buildSearchPlan(parsed, limit)
  const primaryPlan = plan.filter((step) => step.phase === "primary")
  const fallbackPlan = plan.filter((step) => step.phase === "fallback")
  const results: RankedCareDirectoryMatch[] = []
  const dedupe = new Set<string>()
  let successfulResponses = 0

  async function runPlans(steps: SearchPlan[]): Promise<void> {
    const payloads = await Promise.all(
      steps.map(async (searchStep) => {
        try {
          const response = await fetchWithTimeout(
            `${NPPES_BASE}&${searchStep.params.toString()}`,
            { next: { revalidate: 300 } },
            9000
          )
          if (!response.ok) return null
          successfulResponses += 1
          const payload = (await response.json()) as NppesResponse
          return {
            serviceType: searchStep.serviceType,
            list: payload.results || [],
          }
        } catch {
          return null
        }
      })
    )

    payloads.forEach((payload) => {
      if (!payload) return
      payload.list.forEach((entry) => {
        const mapped = mapResult(entry, payload.serviceType, parsed)
        if (!mapped) return
        if ((parsed.city || parsed.state || parsed.zip) && !mapped.locationMatched) return
        const key = `${mapped.kind}:${mapped.npi}`
        if (dedupe.has(key)) return
        dedupe.add(key)
        results.push(mapped)
      })
    })
  }

  await runPlans(primaryPlan)
  if (results.length < Math.min(limit, 8) && fallbackPlan.length > 0) {
    await runPlans(fallbackPlan)
  }

  const filteredResults = filterDominantStateForCityOnly(results, parsed)

  const sorted = filteredResults.sort((a, b) => {
    if (a.locationScore !== b.locationScore) return b.locationScore - a.locationScore
    if (a.confidence !== b.confidence) return a.confidence === "high" ? -1 : 1
    if (a.status !== b.status) return a.status === "Active" ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  if (successfulResponses === 0) {
    throw new Error("NPI registry unavailable")
  }

  return {
    ready: true,
    parsed,
    prompt: {
      id: CARE_SEARCH_PROMPT_ID,
      image: CARE_SEARCH_PROMPT_IMAGE_PATH,
      text: CARE_SEARCH_PROMPT_TEXT,
    },
    matches: sorted.slice(0, limit).map(toPublicCareDirectoryMatch),
  }
}

export function buildPatientLocalCareQuery(opts: {
  requestedServices: CareSearchType[]
  specialtyHint?: string
  patientAddress?: string
}): string {
  const servicePhrase = opts.requestedServices
    .map((service) => {
      if (service === "provider") return "providers"
      if (service === "caregiver") return "caregivers"
      if (service === "lab") return "labs"
      return "radiology centers"
    })
    .join(" and ")
  const specialty = opts.specialtyHint ? `${opts.specialtyHint} ` : ""
  const location = opts.patientAddress || process.env.OPENRX_DEFAULT_PATIENT_LOCATION || ""
  return `Find ${specialty}${servicePhrase} near ${location}`
}
