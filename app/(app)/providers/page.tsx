"use client"

import Link from "next/link"
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
  FilePenLine,
  FolderPlus,
  UserCheck,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { TrustDrawer } from "@/components/trust-drawer"
import {
  ChoiceChip,
  ClinicalField,
  ClinicalInput,
} from "@/components/ui/clinical-forms"
import type { ParsedCareQuery, CareDirectoryMatch } from "@/lib/npi-care-search"
import { carePlanFromProviderCandidate } from "@/lib/care-plan"
import { useCarePlans } from "@/lib/hooks/use-care-plans"
import { trackWorkflowEvent } from "@/lib/product-analytics"
import { cn } from "@/lib/utils"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal"
import {
  PROVIDER_HANDOFF_STORAGE_KEY,
  isFreshCareHandoff,
  safeSessionGetItem,
  safeSessionRemoveItem,
  type ProviderHandoffPayload,
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
    const source =
      payload.source === "screening" || payload.source === "link"
        ? payload.source
        : "chat"
    return {
      source,
      query: payload.query,
      autorun: payload.autorun !== false,
      createdAt: payload.createdAt || Date.now(),
      recommendationId: payload.recommendationId,
      recommendationName: payload.recommendationName,
      sourceSystem: payload.sourceSystem,
      sourceVersion: payload.sourceVersion,
      evidenceGrade: payload.evidenceGrade,
      sourceUrl: payload.sourceUrl,
      locationHint: payload.locationHint,
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
  const searchParams = useSearchParams()
  const kindParam = searchParams.get("kind")
  const initialGroup: "all" | CareDirectoryMatch["kind"] =
    kindParam === "provider" || kindParam === "caregiver" || kindParam === "lab" || kindParam === "radiology"
      ? kindParam
      : "all"
  const [activeGroup, setActiveGroup] = useState<"all" | CareDirectoryMatch["kind"]>(initialGroup)
  const { addPlan } = useCarePlans()

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
      trackWorkflowEvent("provider_search_started", { surface: "providers" })
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
    const isScreeningHandoff =
      stored?.source === "screening" ||
      stored?.source === "link" ||
      handoffSource === "screening"
    setHandoffNotice(
      isScreeningHandoff
        ? stored?.recommendationName
          ? `Loaded the screening recommendation for ${stored.recommendationName} and started the care-network search here.`
          : "Loaded the screening recommendation and started the care-network search here."
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

  function saveCandidate(item: CareDirectoryMatch) {
    const context = parsed?.zip
      ? `Care directory search near ZIP ${parsed.zip}`
      : "Care directory search"
    addPlan(carePlanFromProviderCandidate(item, context))
    trackWorkflowEvent("provider_saved", { surface: "providers" })
  }

  return (
    <div ref={scrollRef} className="animate-slide-up space-y-6">
      <section className="border-b border-white/10 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="shell-kicker">Care directory</p>
            <h1 className="orx-page-title mt-3 text-[clamp(2rem,4.4vw,3.4rem)] text-primary">
              Find care.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">
              Search by specialty, service, ZIP, or screening need. Results are public directory candidates; call to confirm.
            </p>
          </div>
          <Link
            href="/chat?prompt=Help%20me%20find%20care.%20Ask%20for%20my%20ZIP%20code%20first%20if%20it%20is%20missing%2C%20then%20return%20public%20clinic%20phone%20numbers.&topic=scheduling"
            className="control-button-primary self-start lg:self-auto"
          >
            Ask in chat
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="metric-chip">
            <BadgeCheck size={11} className="text-accent" />
            Live CMS NPI data
          </span>
          <span className="metric-chip">
            <Sparkles size={11} className="text-teal" />
            Natural-language search
          </span>
          {profileLocation ? (
            <span className="metric-chip">
              <MapPin size={11} className="text-soft-blue" />
              {profileLocation}
            </span>
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 border-b border-white/10 pb-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <ClinicalField
            label="Care need or location"
            hint="Try a specialty, service, ZIP, city, or short sentence."
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

          <div className="flex flex-wrap gap-2">
            {EXAMPLE_SEARCHES.map((example) => (
              <button
                key={example}
                onClick={() => searchDirectory(example)}
                className="text-left"
              >
                <ChoiceChip>{example}</ChoiceChip>
              </button>
            ))}
          </div>

          {autoLocationNote ? <p className="text-sm text-accent">{autoLocationNote}</p> : null}
          {handoffNotice ? <p data-testid="provider-handoff-notice" className="text-sm text-accent">{handoffNotice}</p> : null}
          {error ? <p data-testid="provider-search-error" className="text-sm text-soft-red">{error}</p> : null}
        </div>

        <aside className="space-y-4 border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-1">
          <div>
            <p className="text-xs font-semibold text-amber-100">Verify before acting</p>
            <p className="mt-1 text-sm leading-6 text-secondary">
              NPI match is not proof of licensure, payer fit, ordering authority, or availability.
            </p>
          </div>
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs font-semibold text-primary">Readiness</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {hasSearched
                ? ready
                  ? "Enough context received. Results below are ready to act on."
                  : clarificationQuestion || "We still need a location or specialty signal to search safely."
                : "Search begins once OpenRx has enough location context to avoid weak or misleading matches."}
            </p>
          </div>
        </aside>
      </section>

      <TrustDrawer
        sources={[{ label: "CMS NPI Registry", url: "https://npiregistry.cms.hhs.gov/" }]}
        inputsUsed={[
          parsed?.specialty ? `Specialty: ${parsed.specialty}` : "Requested service type",
          parsed?.zip ? `ZIP: ${parsed.zip}` : parsed?.city ? `City: ${parsed.city}` : "Location requested in search",
        ]}
        inputsNotUsed={["Insurance coverage", "license verification", "appointment availability"]}
        phiSentToModel={false}
        routingNote="Search terms are used for the public CMS NPI directory query. OpenRx verification fields remain separate."
        safetyBoundary="Directory candidates are not approved clinicians or a guarantee of access. Verify licensure, payer fit, ordering authority, and availability."
        clinicianQuestions={["Does this clinic accept my plan and new patients?", "Can this clinic arrange the recommended screening or referral?"]}
      />

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
                <h2 className="orx-section-heading mt-4 text-[2.1rem] text-white">{matches.length} care option{matches.length === 1 ? "" : "s"} ready</h2>
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
                      onClick={() => openSchedulingFromProvider(topMatch)}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-primary transition hover:bg-white/92"
                    >
                      <CalendarCheck size={14} />
                      Call script
                    </button>
                    <button
                      type="button"
                      onClick={() => saveCandidate(topMatch)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/12"
                    >
                      <FolderPlus size={14} />
                      Save to Care Plan
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
                    : "border-white/10 bg-white/[0.055] text-secondary hover:border-teal/20"
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
              onSave={saveCandidate}
            />
          )}
          {visible.caregivers && (
            <ResultGroup
              title="Caregivers"
              icon={Users}
              items={grouped.caregivers}
              onSave={saveCandidate}
            />
          )}
          {visible.labs && (
            <ResultGroup
              title="Labs"
              icon={Search}
              items={grouped.labs}
              onSave={saveCandidate}
            />
          )}
          {visible.radiology && (
            <ResultGroup
              title="Radiology Centers"
              icon={ShieldCheck}
              items={grouped.radiology}
              onSave={saveCandidate}
            />
          )}
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

function openSchedulingFromProvider(item: CareDirectoryMatch) {
  if (typeof window === "undefined") return
  const prompt = `Help me prepare to call ${item.name} about ${item.specialty || item.kind}. Give me a short call script and what to verify before scheduling.`
  window.location.href = `/chat?topic=scheduling&autorun=1&prompt=${encodeURIComponent(prompt)}`
}

function ResultGroup({
  title,
  icon: Icon,
  items,
  onSave,
}: {
  title: string
  icon: typeof Stethoscope
  items: CareDirectoryMatch[]
  onSave: (item: CareDirectoryMatch) => void
}) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-teal">
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
                <VerificationLadder item={item} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="provider-schedule-button"
                    onClick={() => openSchedulingFromProvider(item)}
                    className="inline-flex items-center gap-1 rounded-full bg-midnight px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#12211d]"
                  >
                    <CalendarCheck size={11} />
                    Prepare call
                  </button>
                  {item.phone && (
                    <a
                      href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold text-primary transition hover:border-teal/30 hover:text-teal"
                    >
                      <Phone size={11} />
                      Call
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onSave(item)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold text-primary transition hover:border-teal/30 hover:text-teal"
                  >
                    <FolderPlus size={11} />
                    Save to Care Plan
                  </button>
                  <Link
                    href={`/chat?topic=coordinator&prompt=${encodeURIComponent(`Draft a short referral request for ${item.specialty || item.kind} care.`)}`}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold text-primary transition hover:border-teal/30 hover:text-teal"
                  >
                    <FilePenLine size={11} />
                    Draft referral request
                  </Link>
                  <Link
                    href={`/chat?topic=coordinator&prompt=${encodeURIComponent(`Request OpenRx verification for this ${item.specialty || item.kind} directory option.`)}`}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold text-primary transition hover:border-teal/30 hover:text-teal"
                  >
                    <UserCheck size={11} />
                    Request verification
                  </Link>
                  {item.fullAddress && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.fullAddress)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold text-primary transition hover:border-teal/30 hover:text-teal"
                    >
                      <ArrowRight size={11} />
                      Map
                    </a>
                  )}
                </div>
              </div>

              <Link href="/join-network" className="text-xs font-semibold text-teal hover:underline">
                Apply as provider
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VerificationLadder({ item }: { item: CareDirectoryMatch }) {
  const evidence = item.directoryEvidence
  const verification = item.openRxVerification
  const steps = [
    { label: "NPI found", value: "Found", ready: Boolean(evidence?.npiFound) },
    { label: "Specialty matched", value: evidence?.specialtyMatched ? "Matched" : "Review", ready: evidence?.specialtyMatched === true },
    { label: "Location matched", value: evidence?.locationMatched ? "Matched" : "Review", ready: evidence?.locationMatched === true },
    { label: "License verification", value: verification?.licenseVerification === "verified" ? "Verified" : "Pending", ready: verification?.licenseVerification === "verified" },
    { label: "Ordering authority", value: verification?.orderingAuthority === "verified" ? "Verified" : "Pending", ready: verification?.orderingAuthority === "verified" },
    { label: "Payer / coverage fit", value: verification?.payerCoverageFit === "verified" ? "Verified" : "Unknown", ready: verification?.payerCoverageFit === "verified" },
    { label: "Available for scheduling", value: verification?.schedulingAvailability === "available" ? "Available" : "Unknown", ready: verification?.schedulingAvailability === "available" },
  ]

  return (
    <div className="mt-4 grid gap-1.5 rounded-[16px] border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-2" data-testid="provider-verification-ladder">
      {steps.map((step) => (
        <span key={step.label} className="flex items-center justify-between gap-2 text-[11px] text-secondary">
          {step.label}
          <span className={step.ready ? "text-teal" : "text-amber-200"}>{step.value}</span>
        </span>
      ))}
    </div>
  )
}
