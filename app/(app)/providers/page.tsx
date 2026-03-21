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
        description="Natural-language search for providers, caregivers, labs, and radiology centers using NPI data."
        className="surface-card p-4 sm:p-5"
        actions={
          <AIAction
            agentId="scheduling"
            label="AI Match"
            prompt="Based on patient history and location, recommend a coordinated care network including provider, caregiver, lab, and radiology options."
          />
        }
      />

      <div className="bg-pampas rounded-2xl border border-sand p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-cloudy"
            />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && searchDirectory()}
              placeholder="Example: find caregiver + radiology center near Seattle WA 98101"
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-sand bg-cream/30 text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40 focus:ring-2 focus:ring-terra/10 transition"
            />
          </div>
          <button
            onClick={() => searchDirectory()}
            disabled={isLoading}
            className="px-6 py-3.5 bg-terra text-white text-sm font-semibold rounded-xl hover:bg-terra-dark transition flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            Search
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={useProfileLocation}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-sand text-warm-600 hover:border-terra/30 hover:text-terra transition"
          >
            Use profile location
          </button>
          <span className="text-[10px] text-cloudy">{profileLocation}</span>
        </div>
        {autoLocationNote && (
          <p className="text-[11px] text-accent mt-2">{autoLocationNote}</p>
        )}
        {error && <p className="text-xs text-soft-red mt-3">{error}</p>}
      </div>

      {hasSearched && !isLoading && ready === false && (
        <div className="bg-yellow-100/20 rounded-2xl border border-yellow-300/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={14} className="text-yellow-500" />
            <p className="text-sm font-semibold text-warm-800">Need one more detail before search</p>
          </div>
          <p className="text-sm text-warm-600">{clarificationQuestion}</p>
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-warm-500">{matches.length} care options found</p>
            <span className="text-[10px] text-cloudy flex items-center gap-1">
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
            <div className="rounded-xl border border-sand bg-cream/30 p-4 text-sm text-warm-600">
              No NPI matches found yet. Try one of these: `hillsboro`, `97123`, or add a specialty like
              `internal medicine near hillsboro`.
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
        <div className="text-center py-12 bg-pampas rounded-2xl border border-sand">
          <div className="w-16 h-16 rounded-2xl bg-terra/5 flex items-center justify-center mx-auto mb-4">
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
                className="px-3 py-1.5 text-xs font-medium text-warm-600 bg-cream rounded-lg border border-sand hover:border-terra/30 hover:text-terra transition"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {promptImage && (
        <div className="bg-pampas rounded-2xl border border-sand p-4">
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
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-terra" />
        <h2 className="text-sm font-bold text-warm-800">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.kind}-${item.npi}`}
            className="bg-pampas rounded-2xl border border-sand p-5 hover:border-terra/20 hover:shadow-sm transition"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-terra/10 to-terra/5 flex items-center justify-center text-terra shrink-0">
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-warm-800">{item.name}</h3>
                  <span
                    className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
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

                <p className="text-xs text-terra font-semibold mt-1">{item.specialty || "General"}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-warm-500">
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

                <span className="text-[10px] font-mono text-cloudy mt-1.5 block">
                  NPI: {item.npi} · Taxonomy: {item.taxonomyCode || "n/a"}
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.phone && (
                    <a
                      href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}
                      className="text-[10px] font-semibold px-2 py-1 rounded-md border border-sand text-warm-600 hover:text-terra hover:border-terra/30 transition"
                    >
                      Call
                    </a>
                  )}
                  {item.fullAddress && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.fullAddress)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-semibold px-2 py-1 rounded-md border border-sand text-warm-600 hover:text-terra hover:border-terra/30 transition"
                    >
                      Map
                    </a>
                  )}
                </div>
              </div>

              <AIAction
                agentId="scheduling"
                label="Connect"
                prompt={`Coordinate care with ${item.name} (NPI ${item.npi}) and verify network and scheduling options.`}
                context={`${item.kind} | ${item.specialty} | ${item.fullAddress} | ${item.phone}`}
                variant="inline"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
