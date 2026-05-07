"use client"

import {
  BadgeCheck,
  Loader2,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
  Sparkles,
  Building2,
  ArrowRight,
  CalendarCheck,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import {
  ChoiceChip,
  ClinicalField,
  ClinicalInput,
  ClinicalSection,
} from "@/components/ui/clinical-forms"
import type { ParsedCareQuery, CareDirectoryMatch } from "@/lib/npi-care-search"
import { cn } from "@/lib/utils"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal"
import {
  PROVIDER_HANDOFF_STORAGE_KEY,
  isFreshCareHandoff,
  safeSessionGetItem,
  safeSessionRemoveItem,
  schedulingHrefFromHandoff,
  type ProviderHandoffPayload,
  type SchedulingHandoffPayload,
} from "@/lib/care-handoff"

const EXAMPLE_SEARCHES = [
  "hillsboro",
  "97123",
  "Find internal medicine providers near Hillsboro",
  "Need caregiver and lab around Seattle WA 98101",
  "Find a radiology center in Austin TX",
]

function parseProviderHandoff(raw: string | null): ProviderHandoffPayload | null {
  if (!raw) return null
  try {
    const payload = JSON.parse(raw) as Partial<ProviderHandoffPayload>
    if (!payload.query || !isFreshCareHandoff(payload.createdAt)) return null
    return {
      source: payload.source === "link" ? "link" : "chat",
      query: payload.query,
      autorun: payload.autorun !== false,
      createdAt: payload.createdAt || Date.now(),
    }
  } catch {
    return null
  }
}

export default function ProvidersPage() {
  const { snapshot } = useLiveSnapshot()
  const scrollRef = useScrollReveal()
  const seededHandoffRef = useRef(false)
  const profileLocation = snapshot.patient?.address || ""
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<CareDirectoryMatch[]>([])
  const [parsed, setParsed] = useState<ParsedCareQuery | null>(null)
  const [ready, setReady] = useState<boolean | null>(null)
  const [clarificationQuestion, setClarificationQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState("")
  const [autoLocationNote, setAutoLocationNote] = useState("")
  const [handoffNotice, setHandoffNotice] = useState("")
  const [activeGroup, setActiveGroup] = useState<"all" | CareDirectoryMatch["kind"]>("all")

  const grouped = useMemo(() => {
    return {
      providers: matches.filter((item) => item.kind === "provider"),
      caregivers: matches.filter((item) => item.kind === "caregiver"),
      labs: matches.filter((item) => item.kind === "lab"),
      radiology: matches.filter((item) => item.kind === "radiology"),
    }
  }, [matches])

  const groupItems = useMemo(
    () => [
      { id: "all" as const, label: "All", count: matches.length },
      { id: "provider" as const, label: "Providers", count: grouped.providers.length },
      { id: "caregiver" as const, label: "Caregivers", count: grouped.caregivers.length },
      { id: "lab" as const, label: "Labs", count: grouped.labs.length },
      { id: "radiology" as const, label: "Radiology", count: grouped.radiology.length },
    ],
    [grouped, matches.length]
  )

  const topMatch = useMemo(() => {
    return [...matches].sort((left, right) => scoreMatch(right) - scoreMatch(left))[0] || null
  }, [matches])

  const searchDirectory = useCallback(
    async (searchQuery?: string) => {
      const q = (searchQuery || query).trim()
      if (!q) {
        setError("Type what you need in natural language.")
        return
      }

      setIsLoading(true)
      setHasSearched(true)
      setError("")
      setAutoLocationNote("")
      if (searchQuery) setQuery(searchQuery)

      try {
        const response = await fetch(`/api/providers/search?q=${encodeURIComponent(q)}&limit=24`)
        const data = (await response.json()) as {
          error?: string
          ready?: boolean
          parsed?: ParsedCareQuery
          clarificationQuestion?: string
          matches?: CareDirectoryMatch[]
          prompt?: { image?: string }
        }

        if (!response.ok || data.error) {
          throw new Error(data.error || "Search failed.")
        }

        const missingLocation = !data.parsed?.city && !data.parsed?.zip
        const hasLocationHint = /\bnear\b|\bin\b|\baround\b|\d{5}/i.test(q)
        if (data.ready === false && missingLocation && profileLocation && !hasLocationHint) {
          const enrichedQuery = `${q} near ${profileLocation}`.trim()
          const retryResponse = await fetch(
            `/api/providers/search?q=${encodeURIComponent(enrichedQuery)}&limit=24`
          )
          const retryData = (await retryResponse.json()) as {
            error?: string
            ready?: boolean
            parsed?: ParsedCareQuery
            clarificationQuestion?: string
            matches?: CareDirectoryMatch[]
            prompt?: { image?: string }
          }
          if (retryResponse.ok && !retryData.error) {
            setQuery(enrichedQuery)
            setReady(Boolean(retryData.ready))
            setParsed(retryData.parsed || null)
            setClarificationQuestion(retryData.clarificationQuestion || "")
            setMatches(retryData.matches || [])
            setAutoLocationNote(`Used your profile location (${profileLocation}) to complete this search.`)
            setActiveGroup("all")
            return
          }
        }

        setReady(Boolean(data.ready))
        setParsed(data.parsed || null)
        setClarificationQuestion(data.clarificationQuestion || "")
        setMatches(data.matches || [])
        setActiveGroup("all")
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : "Failed to search.")
        setMatches([])
      } finally {
        setIsLoading(false)
      }
    },
    [profileLocation, query]
  )

  useEffect(() => {
    if (seededHandoffRef.current || typeof window === "undefined") return
    seededHandoffRef.current = true

    const params = new URLSearchParams(window.location.search)
    const prompt = params.get("q") || params.get("query") || ""
    const stored = parseProviderHandoff(safeSessionGetItem(PROVIDER_HANDOFF_STORAGE_KEY))
    safeSessionRemoveItem(PROVIDER_HANDOFF_STORAGE_KEY)

    const nextQuery = stored?.query || prompt
    if (!nextQuery.trim()) return

    setQuery(nextQuery.trim())
    const handoffSource = params.get("handoff")
    setHandoffNotice(
      stored?.source === "link" || handoffSource === "screening"
        ? "Loaded the screening recommendation and started the care-network search here."
        : "Loaded your chat context and started the care-network search here."
    )
    if (
      stored?.autorun ||
      params.get("autorun") === "1" ||
      params.get("handoff") === "chat" ||
      params.get("handoff") === "screening"
    ) {
      void searchDirectory(nextQuery.trim())
    }
  }, [searchDirectory])

  function useProfileLocation() {
    if (!profileLocation) return
    if (!query.trim()) {
      setQuery(`Find providers and caregivers near ${profileLocation}`)
      return
    }
    if (query.toLowerCase().includes("near ")) return
    setQuery(`${query.trim()} near ${profileLocation}`)
  }

  const visible = {
    providers: activeGroup === "all" || activeGroup === "provider",
    caregivers: activeGroup === "all" || activeGroup === "caregiver",
    labs: activeGroup === "all" || activeGroup === "lab",
    radiology: activeGroup === "all" || activeGroup === "radiology",
  }

  return (
    <div ref={scrollRef} className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Care Directory"
        title="Resolve care from one sentence."
        description="Describe the care you need in plain language. OpenRx resolves the service type, location, and NPI-backed options without making you think in directories."
        meta={
          <div className="flex flex-wrap gap-2">
            <span className="metric-chip">
              <BadgeCheck size={11} className="text-accent" />
              Live CMS NPI data
            </span>
            <span className="metric-chip">
              <Sparkles size={11} className="text-teal" />
              Natural-language only
            </span>
            {profileLocation ? (
              <span className="metric-chip">
                <MapPin size={11} className="text-soft-blue" />
                {profileLocation}
              </span>
            ) : null}
          </div>
        }
        actions={
          <AIAction
            agentId="scheduling"
            label="AI Match"
            prompt="Based on patient history and location, recommend a coordinated care network including provider, caregiver, lab, and radiology options."
          />
        }
      />

      <ClinicalSection
        kicker="Search request"
        title="Tell OpenRx what care you need."
        description="Use a city, ZIP, specialty, or one plain-English sentence. The search only runs when there is enough location context to avoid weak or misleading matches."
        aside={
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">How matching works</p>
            <StepRow
              icon={Search}
              title="You describe the need"
              description="Specialty, city, ZIP, or a short sentence are all valid."
            />
            <StepRow
              icon={BadgeCheck}
              title="We parse and match"
              description="OpenRx resolves service type and location, then pulls CMS NPI-backed directory candidates."
            />
            <StepRow
              icon={Building2}
              title="You get usable options"
              description="Each result includes specialty, status, address, phone, and next actions."
            />
            <div className="rounded-[22px] border border-amber-200/70 bg-amber-50/70 p-4">
              <p className="text-xs font-semibold text-primary">Important safety boundary</p>
              <p className="mt-1 text-sm leading-6 text-secondary">
                NPI results are directory matches, not proof that a clinician can order for a specific patient in a specific state. Scripts, imaging, labs, referrals, claims, and prior auth still require licensed clinician review.
              </p>
            </div>
            <div className="rounded-[22px] border border-[rgba(82,108,139,0.12)] bg-white/84 p-4">
              <p className="text-xs font-semibold text-primary">Current search readiness</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {hasSearched
                  ? ready
                    ? "Enough context received. Results below are ready to act on."
                    : clarificationQuestion || "We still need a location or specialty signal to search safely."
                  : "Search begins once OpenRx has enough location context to avoid weak or misleading matches."}
              </p>
            </div>
          </div>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="space-y-4">
            <ClinicalField
              label="Care need or location"
              hint="Examples: “internal medicine near Hillsboro”, “97123”, or “caregiver and lab around Seattle WA 98101”."
              htmlFor="provider-search"
            >
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <ClinicalInput
                  id="provider-search"
                  data-testid="provider-search-input"
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && searchDirectory()}
                  placeholder="Find caregiver + radiology center near Seattle WA 98101"
                  className="pl-12"
                />
              </div>
            </ClinicalField>

            <div className="flex flex-wrap gap-2">
              <button
                data-testid="provider-search-button"
                onClick={() => searchDirectory()}
                disabled={isLoading}
                className="control-button-primary"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Search network
              </button>
              <button
                onClick={useProfileLocation}
                className="control-button-secondary"
              >
                <MapPin size={15} className="text-soft-blue" />
                Use profile location
              </button>
            </div>

            {autoLocationNote ? <p className="text-sm text-accent">{autoLocationNote}</p> : null}
            {handoffNotice ? <p data-testid="provider-handoff-notice" className="text-sm text-accent">{handoffNotice}</p> : null}
            {error ? <p data-testid="provider-search-error" className="text-sm text-soft-red">{error}</p> : null}
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_60%,#173B83_100%)] p-4 text-white shadow-[0_16px_34px_rgba(47,107,255,0.14)] sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Quick examples</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {EXAMPLE_SEARCHES.map((example) => (
                <button
                  key={example}
                  onClick={() => searchDirectory(example)}
                  className="text-left"
                >
                  <ChoiceChip className="!border-white/12 !bg-white/10 !text-white">{example}</ChoiceChip>
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-white/70">
              If your request is underspecified and you already have a profile location, OpenRx can complete the search using that address.
            </p>
          </div>
        </div>
      </ClinicalSection>

      {hasSearched && !isLoading && ready === false && (
        <div className="reveal surface-card border-yellow-300/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(239,246,255,0.88))] p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={14} className="text-yellow-700" />
            <p className="text-sm font-semibold text-primary">Need one more detail before search</p>
          </div>
          <p className="mt-2 text-sm leading-7 text-secondary">{clarificationQuestion}</p>
          {parsed && (
            <div className="flex flex-wrap gap-2 mt-3">
              {parsed.serviceTypes.map((serviceType) => (
                <span key={serviceType} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-teal/10 text-teal">
                  {serviceType}
                </span>
              ))}
              {parsed.city && (
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-soft-blue/10 text-soft-blue">
                  {parsed.city}
                </span>
              )}
              {parsed.state && (
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-accent/10 text-accent">
                  {parsed.state}
                </span>
              )}
              {parsed.zip && (
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-teal/10 text-teal">
                  ZIP {parsed.zip}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {hasSearched && !isLoading && ready && (
        <div className="space-y-5">
          <div className="reveal overflow-hidden rounded-[28px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_60%,#173B83_100%)] p-5 text-white shadow-[0_18px_40px_rgba(8,24,46,0.16)]">
            <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/56">Matched network</p>
                <h2 className="mt-4 font-serif text-[2.2rem] leading-[0.96] text-white">{matches.length} care option{matches.length === 1 ? "" : "s"} ready</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
                  {parsed?.serviceTypes?.length
                    ? `OpenRx resolved ${parsed.serviceTypes.join(", ")} and limited the result set to the most usable local options.`
                    : "OpenRx resolved the request and returned locally usable care options."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/12 bg-white/8 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Location read</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {parsed?.city || parsed?.zip || parsed?.state || "Broad geography"}
                  </p>
                  <p className="mt-1 text-[12px] leading-6 text-white/64">
                    {parsed?.zip || parsed?.city ? "Local matching is constrained and actionable." : "Review geography closely before calling."}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/12 bg-white/8 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Source</p>
                  <p className="mt-2 text-sm font-semibold text-white flex items-center gap-2">
                    <BadgeCheck size={12} />
                    CMS NPI-backed
                  </p>
                  <p className="mt-1 text-[12px] leading-6 text-white/64">Results include status, specialty, address, phone, and next actions.</p>
                </div>
              </div>
            </div>
          </div>

          {(parsed || topMatch) && (
            <section className="reveal reveal-delay-1 grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
              <div className="surface-card p-5">
                <p className="section-title">OpenRx interpretation</p>
                <h2 className="mt-3 text-[1.45rem] font-semibold text-primary">
                  {parsed?.serviceTypes?.length
                    ? `Searching for ${parsed.serviceTypes.join(", ")}`
                    : "Search intent recognized"}
                </h2>
                <p className="mt-3 text-sm leading-7 text-secondary">
                  {parsed?.city || parsed?.zip
                    ? `Location context is strong enough to keep the result set local and actionable.`
                    : "The request resolved, but location context is still broad enough that you should review geography closely."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {parsed?.serviceTypes?.map((serviceType) => (
                    <ChoiceChip key={serviceType}>{serviceType}</ChoiceChip>
                  ))}
                  {parsed?.city ? <ChoiceChip>{parsed.city}</ChoiceChip> : null}
                  {parsed?.state ? <ChoiceChip>{parsed.state}</ChoiceChip> : null}
                  {parsed?.zip ? <ChoiceChip>ZIP {parsed.zip}</ChoiceChip> : null}
                </div>
                {autoLocationNote ? <p className="mt-4 text-sm text-accent">{autoLocationNote}</p> : null}
              </div>

              {topMatch ? (
                <div className="overflow-hidden rounded-[26px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_60%,#173B83_100%)] p-5 text-white shadow-[0_18px_40px_rgba(8,24,46,0.16)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/56">Best first call</p>
                  <div className="mt-3 flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                      <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-[1.45rem] font-semibold text-white">{topMatch.name}</h2>
                      <p className="mt-1 text-sm font-semibold text-white/82">{topMatch.specialty || "General care"}</p>
                      <p className="mt-3 text-sm leading-7 text-white/72">
                        {buildProviderRecommendation(topMatch)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-[20px] border border-white/12 bg-white/8 p-4 text-[12px] leading-6 text-white/70">
                    {topMatch.fullAddress ? <p>{topMatch.fullAddress}</p> : null}
                    {topMatch.phone ? <p className="mt-1">{topMatch.phone}</p> : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="provider-schedule-button"
                      onClick={() => openSchedulingFromProvider(topMatch, query || `Schedule ${topMatch.specialty || topMatch.kind} with ${topMatch.name}`)}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-primary transition hover:bg-white/92"
                    >
                      <CalendarCheck size={14} />
                      Schedule
                    </button>
                    {topMatch.phone ? (
                      <a
                        href={`tel:${topMatch.phone.replace(/[^\d+]/g, "")}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/12"
                      >
                        <Phone size={14} />
                        Call first
                      </a>
                    ) : null}
                    {topMatch.fullAddress ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(topMatch.fullAddress)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/12"
                      >
                        <MapPin size={14} />
                        Open map
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          )}

          <div className="flex flex-wrap gap-2">
            {groupItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveGroup(item.id)}
                className={cn(
                  "text-[11px] font-semibold px-3 py-1.5 rounded-full border transition",
                  activeGroup === item.id
                    ? "border-teal/30 bg-teal/10 text-teal"
                    : "border-[rgba(82,108,139,0.12)] bg-white/82 text-secondary hover:border-teal/20"
                )}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>

          {matches.length === 0 && (
            <div className="surface-card p-5 text-sm text-secondary">
              No NPI matches found yet. Try one of these: <span className="font-semibold text-primary">hillsboro</span>,{" "}
              <span className="font-semibold text-primary">97123</span>, or a specialty phrase like{" "}
              <span className="font-semibold text-primary">internal medicine near hillsboro</span>.
            </div>
          )}

          {visible.providers && (
            <ResultGroup
              title="Providers"
              icon={Stethoscope}
              items={grouped.providers}
              query={query}
            />
          )}
          {visible.caregivers && (
            <ResultGroup
              title="Caregivers"
              icon={Users}
              items={grouped.caregivers}
              query={query}
            />
          )}
          {visible.labs && (
            <ResultGroup
              title="Labs"
              icon={Search}
              items={grouped.labs}
              query={query}
            />
          )}
          {visible.radiology && (
            <ResultGroup
              title="Radiology Centers"
              icon={ShieldCheck}
              items={grouped.radiology}
              query={query}
            />
          )}
        </div>
      )}

      {!hasSearched && (
        <div className="reveal surface-card py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[rgba(47,107,255,0.08)]">
            <Search size={28} className="text-teal" />
          </div>
          <h3 className="text-lg font-serif text-primary">
            Natural Language Only
          </h3>
          <p className="text-sm text-muted mt-2 max-w-xl mx-auto">
            Tell us what care you need and where. Search begins only after we have enough information.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-6 max-w-3xl mx-auto">
            {EXAMPLE_SEARCHES.map((example) => (
              <button
                key={example}
                onClick={() => searchDirectory(example)}
                className="chip transition hover:border-teal/30 hover:text-teal"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function scoreMatch(item: CareDirectoryMatch) {
  let score = 0
  if (item.confidence === "high") score += 4
  if (item.status === "A") score += 3
  if (item.kind === "provider") score += 3
  if (item.phone) score += 1
  if (item.fullAddress) score += 1
  return score
}

function buildProviderRecommendation(item: CareDirectoryMatch) {
  const specialty = item.specialty || (item.kind === "lab" ? "Lab service" : item.kind === "radiology" ? "Radiology service" : "care option")
  return `Start here because this ${specialty.toLowerCase()} entry has the cleanest combination of status, contactability, and location detail in the current result set.`
}

function openSchedulingFromProvider(item: CareDirectoryMatch, reason: string) {
  if (typeof window === "undefined") return
  const payload: SchedulingHandoffPayload = {
    source: "provider",
    providerName: item.name,
    providerKind: item.kind,
    specialty: item.specialty || undefined,
    npi: item.npi,
    phone: item.phone || undefined,
    fullAddress: item.fullAddress || undefined,
    reason,
    query: reason,
    createdAt: Date.now(),
  }
  window.location.href = schedulingHrefFromHandoff(payload)
}

function ResultGroup({
  title,
  icon: Icon,
  items,
  query,
}: {
  title: string
  icon: typeof Stethoscope
  items: CareDirectoryMatch[]
  query: string
}) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-[rgba(82,108,139,0.12)] bg-white/88 text-teal">
          <Icon size={14} className="text-teal" />
        </div>
        <h2 className="text-sm font-bold text-primary">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.kind}-${item.npi}`}
            data-testid="provider-result-card"
            className="surface-card p-5 transition hover:-translate-y-0.5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(82,108,139,0.12)] bg-[rgba(47,107,255,0.08)] text-teal">
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-primary">{item.name}</h3>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                      item.confidence === "high"
                        ? "bg-accent/10 text-accent"
                        : "bg-yellow-100 text-yellow-800"
                    )}
                  >
                    {item.confidence === "high" ? "Strong match" : "Review match"}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal/10 text-teal uppercase">
                    {item.status === "A" ? "Active" : item.status}
                  </span>
                </div>

                <p className="mt-1 text-sm font-semibold text-teal">{item.specialty || "General care"}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} />
                    {item.fullAddress}
                  </span>
                  {item.phone && (
                    <a
                      href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}
                      className="flex items-center gap-1 hover:text-teal transition"
                    >
                      <Phone size={12} />
                      {item.phone}
                    </a>
                  )}
                </div>

                <span className="mt-2 block text-[10px] font-mono text-muted">
                  NPI: {item.npi} · Taxonomy: {item.taxonomyCode || "n/a"}
                </span>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="provider-schedule-button"
                    onClick={() => openSchedulingFromProvider(item, query || `Schedule ${item.specialty || item.kind} with ${item.name}`)}
                    className="inline-flex items-center gap-1 rounded-full bg-midnight px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#12211d]"
                  >
                    <CalendarCheck size={11} />
                    Schedule
                  </button>
                  {item.phone && (
                    <a
                      href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-white/70 px-3 py-1.5 text-[10px] font-semibold text-primary transition hover:border-teal/30 hover:text-teal"
                    >
                      <Phone size={11} />
                      Call
                    </a>
                  )}
                  {item.fullAddress && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.fullAddress)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-white/70 px-3 py-1.5 text-[10px] font-semibold text-primary transition hover:border-teal/30 hover:text-teal"
                    >
                      <ArrowRight size={11} />
                      Map
                    </a>
                  )}
                </div>
              </div>

              <div className="lg:self-center">
                <AIAction
                  agentId="scheduling"
                  label="Coordinate"
                  prompt={`Coordinate care with ${item.name} (NPI ${item.npi}) and verify network and scheduling options.`}
                  context={`${item.kind} | ${item.specialty} | ${item.fullAddress} | ${item.phone}`}
                  variant="inline"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepRow({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Search
  title: string
  description: string
}) {
  return (
    <div className="rounded-[20px] border border-white/70 bg-white/76 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-teal/10 text-teal">
          <Icon size={15} />
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        </div>
      </div>
    </div>
  )
}
