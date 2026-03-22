"use client"

import {
  BadgeCheck,
  Image as ImageIcon,
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
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import Image from "next/image"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import type { ParsedCareQuery, CareDirectoryMatch } from "@/lib/npi-care-search"
import { cn } from "@/lib/utils"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"

const EXAMPLE_SEARCHES = [
  "hillsboro",
  "97123",
  "Find internal medicine providers near Hillsboro",
  "Need caregiver and lab around Seattle WA 98101",
  "Find a radiology center in Austin TX",
]

export default function ProvidersPage() {
  const { snapshot } = useLiveSnapshot()
  const profileLocation = snapshot.patient?.address || ""
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<CareDirectoryMatch[]>([])
  const [parsed, setParsed] = useState<ParsedCareQuery | null>(null)
  const [ready, setReady] = useState<boolean | null>(null)
  const [clarificationQuestion, setClarificationQuestion] = useState("")
  const [promptImage, setPromptImage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState("")
  const [autoLocationNote, setAutoLocationNote] = useState("")
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
            setPromptImage(retryData.prompt?.image || "")
            setAutoLocationNote(`Used your profile location (${profileLocation}) to complete this search.`)
            setActiveGroup("all")
            return
          }
        }

        setReady(Boolean(data.ready))
        setParsed(data.parsed || null)
        setClarificationQuestion(data.clarificationQuestion || "")
        setMatches(data.matches || [])
        setPromptImage(data.prompt?.image || "")
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
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Care Directory"
        title="Find Care Network"
        description="Describe the care you need in plain language. OpenRx figures out the service type, location, and NPI-backed options without making you think in directories."
        meta={
          <div className="flex flex-wrap gap-2">
            <span className="metric-chip">
              <BadgeCheck size={11} className="text-accent" />
              Live CMS NPI data
            </span>
            <span className="metric-chip">
              <Sparkles size={11} className="text-terra" />
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

      <section className="surface-card overflow-hidden">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.35fr_0.65fr] lg:p-6">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-warm-500">Search request</p>
              <h2 className="mt-2 text-2xl text-warm-800">Tell OpenRx what care you need.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-warm-500">
                City-only and ZIP-only searches should work. If you already have a profile location, we can use it automatically when the request is underspecified.
              </p>
            </div>

            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-cloudy" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && searchDirectory()}
                placeholder="Examples: hillsboro, 97123, internal medicine near Seattle, radiology around Austin TX"
                className="w-full rounded-[22px] border border-white/80 bg-white/80 py-4 pl-12 pr-4 text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/35 focus:shadow-[0_0_0_4px_rgba(224,91,67,0.08)]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => searchDirectory()}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-2xl bg-midnight px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#12211d] disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Search care network
              </button>
              <button
                onClick={useProfileLocation}
                className="inline-flex items-center gap-2 rounded-2xl border border-sand bg-white/65 px-4 py-3 text-sm font-semibold text-warm-700 transition hover:border-terra/25 hover:text-terra"
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
                  className="chip transition hover:border-terra/30 hover:text-terra"
                >
                  {example}
                </button>
              ))}
            </div>

            {autoLocationNote ? <p className="text-sm text-accent">{autoLocationNote}</p> : null}
            {error ? <p className="text-sm text-soft-red">{error}</p> : null}
          </div>

          <div className="surface-muted p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-warm-500">How matching works</p>
            <div className="mt-4 space-y-3">
              <StepRow
                icon={Search}
                title="You describe the need"
                description="Specialty, city, ZIP, or a short sentence are all valid. Natural language only."
              />
              <StepRow
                icon={BadgeCheck}
                title="We parse and verify"
                description="OpenRx resolves the service type and pulls live NPI-backed candidates from CMS data."
              />
              <StepRow
                icon={Building2}
                title="You get usable options"
                description="Each result includes specialty, status, address, phone, and quick next actions."
              />
            </div>

            <div className="mt-5 rounded-[22px] border border-white/70 bg-white/72 p-4">
              <p className="text-xs font-semibold text-warm-800">Current search readiness</p>
              <p className="mt-1 text-sm leading-6 text-warm-500">
                {hasSearched
                  ? ready
                    ? "Enough context received. Results below are ready to act on."
                    : clarificationQuestion || "We still need a location or specialty signal to search safely."
                  : "Search begins once OpenRx has enough location context to avoid weak or misleading matches."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {hasSearched && !isLoading && ready === false && (
        <div className="surface-card border-yellow-300/40 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,246,213,0.88))] p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={14} className="text-yellow-500" />
            <p className="text-sm font-semibold text-warm-800">Need one more detail before search</p>
          </div>
          <p className="mt-2 text-sm leading-7 text-warm-600">{clarificationQuestion}</p>
          {parsed && (
            <div className="flex flex-wrap gap-2 mt-3">
              {parsed.serviceTypes.map((serviceType) => (
                <span key={serviceType} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-terra/10 text-terra">
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
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-terra/10 text-terra">
                  ZIP {parsed.zip}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {hasSearched && !isLoading && ready && (
        <div className="space-y-5">
          <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-warm-500">Matched network</p>
              <p className="mt-1 text-lg font-semibold text-warm-800">{matches.length} care option{matches.length === 1 ? "" : "s"} found</p>
            </div>
            <span className="text-[11px] text-cloudy flex items-center gap-1">
              <BadgeCheck size={10} /> Live CMS NPI data
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {groupItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveGroup(item.id)}
                className={cn(
                  "text-[11px] font-semibold px-3 py-1.5 rounded-full border transition",
                  activeGroup === item.id
                    ? "border-terra/30 bg-terra/10 text-terra"
                    : "border-sand text-warm-600 hover:border-terra/20"
                )}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>

          {matches.length === 0 && (
            <div className="surface-card p-5 text-sm text-warm-600">
              No NPI matches found yet. Try one of these: <span className="font-semibold text-warm-800">hillsboro</span>,{" "}
              <span className="font-semibold text-warm-800">97123</span>, or a specialty phrase like{" "}
              <span className="font-semibold text-warm-800">internal medicine near hillsboro</span>.
            </div>
          )}

          {visible.providers && (
            <ResultGroup
              title="Providers"
              icon={Stethoscope}
              items={grouped.providers}
            />
          )}
          {visible.caregivers && (
            <ResultGroup
              title="Caregivers"
              icon={Users}
              items={grouped.caregivers}
            />
          )}
          {visible.labs && (
            <ResultGroup
              title="Labs"
              icon={Search}
              items={grouped.labs}
            />
          )}
          {visible.radiology && (
            <ResultGroup
              title="Radiology Centers"
              icon={ShieldCheck}
              items={grouped.radiology}
            />
          )}
        </div>
      )}

      {!hasSearched && (
        <div className="surface-card py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-terra/8">
            <Search size={28} className="text-terra" />
          </div>
          <h3 className="text-lg font-serif text-warm-800">
            Natural Language Only
          </h3>
          <p className="text-sm text-warm-500 mt-2 max-w-xl mx-auto">
            Tell us what care you need and where. Search begins only after we have enough information.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-6 max-w-3xl mx-auto">
            {EXAMPLE_SEARCHES.map((example) => (
              <button
                key={example}
                onClick={() => searchDirectory(example)}
                className="chip transition hover:border-terra/30 hover:text-terra"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {promptImage && (
        <div className="surface-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon size={14} className="text-terra" />
            <span className="text-xs font-bold text-warm-800">Prompt Artifact Used</span>
          </div>
          <div className="rounded-xl overflow-hidden border border-sand/70">
            <Image
              src={promptImage}
              width={1400}
              height={980}
              alt="OpenRx natural-language NPI search prompt"
              className="w-full h-auto"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ResultGroup({
  title,
  icon: Icon,
  items,
}: {
  title: string
  icon: typeof Stethoscope
  items: CareDirectoryMatch[]
}) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={14} className="text-terra" />
        <h2 className="text-sm font-bold text-warm-800">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.kind}-${item.npi}`}
            className="surface-card p-5 transition hover:-translate-y-0.5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-terra/12 to-terra/4 text-terra">
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-warm-800">{item.name}</h3>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                      item.confidence === "high"
                        ? "bg-accent/10 text-accent"
                        : "bg-yellow-100/20 text-yellow-500"
                    )}
                  >
                    {item.confidence === "high" ? "Verified" : "Unverified"}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-terra/10 text-terra uppercase">
                    {item.status === "A" ? "Active" : item.status}
                  </span>
                </div>

                <p className="mt-1 text-sm font-semibold text-terra">{item.specialty || "General care"}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-warm-500">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} />
                    {item.fullAddress}
                  </span>
                  {item.phone && (
                    <a
                      href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}
                      className="flex items-center gap-1 hover:text-terra transition"
                    >
                      <Phone size={12} />
                      {item.phone}
                    </a>
                  )}
                </div>

                <span className="mt-2 block text-[10px] font-mono text-cloudy">
                  NPI: {item.npi} · Taxonomy: {item.taxonomyCode || "n/a"}
                </span>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.phone && (
                    <a
                      href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}
                      className="inline-flex items-center gap-1 rounded-full border border-sand bg-white/70 px-3 py-1.5 text-[10px] font-semibold text-warm-700 transition hover:border-terra/30 hover:text-terra"
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
                      className="inline-flex items-center gap-1 rounded-full border border-sand bg-white/70 px-3 py-1.5 text-[10px] font-semibold text-warm-700 transition hover:border-terra/30 hover:text-terra"
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
                  label="Connect"
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
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-terra/10 text-terra">
          <Icon size={15} />
        </div>
        <div>
          <p className="text-sm font-semibold text-warm-800">{title}</p>
          <p className="mt-1 text-sm leading-6 text-warm-500">{description}</p>
        </div>
      </div>
    </div>
  )
}
