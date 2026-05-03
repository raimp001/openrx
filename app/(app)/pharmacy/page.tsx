"use client"

import { useCallback, useMemo, useState } from "react"
import { BadgeCheck, Building2, Loader2, MapPin, Phone, Pill, Search, ShieldCheck } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsBriefCard, OpsEmptyState, OpsPanel } from "@/components/ui/ops-primitives"
import { cn } from "@/lib/utils"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"

interface Pharmacy {
  npi: string
  name: string
  type: string
  phone: string
  fax: string
  address: {
    line1: string
    line2: string
    city: string
    state: string
    zip: string
  }
  fullAddress: string
  status: string
  lastUpdated: string
}

interface ParsedPharmacyQuery {
  query: string
  normalizedQuery: string
  name?: string
  city?: string
  state?: string
  zip?: string
  ready: boolean
  clarificationQuestion?: string
}

const EXAMPLE_QUERIES = [
  "Find CVS pharmacy near Seattle WA 98101",
  "Need a 24 hour pharmacy around Denver CO 80202",
  "Find Walgreens in Austin TX",
  "Search pharmacy near Miami FL 33101",
]

export default function PharmacyPage() {
  const { snapshot } = useLiveSnapshot()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Pharmacy[]>([])
  const [count, setCount] = useState(0)
  const [ready, setReady] = useState<boolean | null>(null)
  const [parsed, setParsed] = useState<ParsedPharmacyQuery | null>(null)
  const [clarificationQuestion, setClarificationQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState("")
  const [selectedPharmacy, setSelectedPharmacy] = useState<string | null>(null)

  const profileLocation = snapshot.patient?.address || ""
  const activeResults = useMemo(() => results.filter((item) => item.status === "Active"), [results])
  const topMatch = activeResults[0] || results[0] || null
  const interpretedRequest = useMemo(() => {
    if (!parsed) return "No request interpreted yet."

    const parts = [parsed.name, parsed.city, parsed.state, parsed.zip ? `ZIP ${parsed.zip}` : undefined].filter(Boolean)
    return parts.length ? parts.join(" · ") : "Natural-language request interpreted."
  }, [parsed])

  const searchPharmacies = useCallback(
    async (searchQuery?: string) => {
      const q = (searchQuery || query).trim()
      if (!q) {
        setError("Type what you need in natural language.")
        return
      }

      setIsLoading(true)
      setError("")
      setHasSearched(true)
      if (searchQuery) setQuery(searchQuery)

      try {
        const response = await fetch(`/api/pharmacy/search?q=${encodeURIComponent(q)}&limit=20`)
        const data = (await response.json()) as {
          error?: string
          ready?: boolean
          parsed?: ParsedPharmacyQuery
          clarificationQuestion?: string
          count?: number
          pharmacies?: Pharmacy[]
        }

        if (!response.ok || data.error) {
          throw new Error(data.error || "Search failed.")
        }

        setReady(Boolean(data.ready))
        setParsed(data.parsed || null)
        setClarificationQuestion(data.clarificationQuestion || "")
        setResults(data.pharmacies || [])
        setCount(data.count || 0)
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : "Failed to search.")
        setResults([])
        setCount(0)
      } finally {
        setIsLoading(false)
      }
    },
    [query]
  )

  function useProfileLocation() {
    if (!query.trim()) {
      setQuery(`Find pharmacy near ${profileLocation}`)
      return
    }
    if (!query.toLowerCase().includes("near ")) {
      setQuery(`${query.trim()} near ${profileLocation}`)
    }
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Medication Access"
        title="Pharmacy Finder"
        description="Describe the pharmacy you need, then get nearby options with phone numbers, addresses, and a clear first call."
        className="surface-card p-4 sm:p-5"
        meta={
          <>
            <OpsBadge tone="blue">{profileLocation ? "Profile location on file" : "Add location for faster matching"}</OpsBadge>
            {hasSearched && ready ? <OpsBadge tone="accent">{count} pharmacy matches reviewed</OpsBadge> : null}
          </>
        }
        actions={
          <AIAction
            agentId="rx"
            label="Compare Prices"
            prompt="Compare nearby pharmacy options for active medications and suggest the most cost-effective refill plan."
          />
        }
      />

      <OpsPanel
        eyebrow="Request intake"
        title="Describe the pharmacy you want in one sentence"
        description="Include the chain or type, plus a city or ZIP. OpenRx will only return results when the geographic signal is specific enough to be useful."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void searchPharmacies()}
              placeholder="Find CVS pharmacy near Seattle WA 98101"
              className="w-full rounded-xl border border-border bg-surface/30 py-3.5 pl-12 pr-4 text-sm text-primary placeholder:text-muted transition focus:border-teal/40 focus:outline-none focus:ring-2 focus:ring-teal/10"
            />
          </div>
          <button
            onClick={() => void searchPharmacies()}
            disabled={isLoading}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-teal-dark disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={useProfileLocation}
            className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-secondary transition hover:border-teal/30 hover:text-teal"
          >
            Use profile location
          </button>
          <span className="text-[10px] text-muted">{profileLocation || "No profile address saved yet"}</span>
        </div>
        {error ? <p className="mt-3 text-xs text-soft-red">{error}</p> : null}
      </OpsPanel>

      {hasSearched && !isLoading && ready === false ? (
        <div className="rounded-2xl border border-yellow-300/30 bg-yellow-100/20 p-4">
          <div className="mb-1 flex items-center gap-2">
            <ShieldCheck size={14} className="text-yellow-700" />
            <p className="text-sm font-semibold text-primary">Need one more detail before search</p>
          </div>
          <p className="text-sm text-secondary">{clarificationQuestion}</p>
          {parsed ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {parsed.name ? <span className="rounded-full bg-teal/10 px-2 py-1 text-[10px] font-semibold text-teal">{parsed.name}</span> : null}
              {parsed.city ? <span className="rounded-full bg-soft-blue/10 px-2 py-1 text-[10px] font-semibold text-soft-blue">{parsed.city}</span> : null}
              {parsed.state ? <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent">{parsed.state}</span> : null}
              {parsed.zip ? <span className="rounded-full bg-teal/10 px-2 py-1 text-[10px] font-semibold text-teal">ZIP {parsed.zip}</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {hasSearched && !isLoading && ready ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <OpsBriefCard
              label="Best first call"
              title={topMatch?.name || "No active pharmacy surfaced first"}
              detail={
                topMatch
                  ? `${topMatch.phone || "Phone not listed"} · ${topMatch.fullAddress}`
                  : "Tighten the request with a ZIP or chain name."
              }
              tone="accent"
            />
            <OpsBriefCard
              label="Search interpretation"
              title={interpretedRequest}
              detail="The query parser is using these location and name signals to keep the result set grounded."
              tone="blue"
            />
            <OpsBriefCard
              label="Ready to contact"
              title={`${activeResults.length} active option${activeResults.length !== 1 ? "s" : ""} ready to contact`}
              detail="Start with the first match for the quickest refill transfer, then compare alternatives only if availability or formulary issues appear."
              tone="terra"
            />
          </div>

          <OpsPanel
            eyebrow="Dispensing options"
            title="Pharmacies matched to this request"
            description="Results are constrained by the interpreted geography and shown with direct actions so the next step is obvious."
            actions={<span className="flex items-center gap-1 text-[10px] text-muted"><BadgeCheck size={10} /> Live CMS NPI data</span>}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted">
                {count} pharmac{count !== 1 ? "ies" : "y"} found · {activeResults.length} active
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {results.map((pharmacy) => (
                <div
                  key={pharmacy.npi}
                  className={cn(
                    "cursor-pointer rounded-2xl border p-5 transition hover:border-teal/20",
                    selectedPharmacy === pharmacy.npi ? "border-teal/30 ring-1 ring-teal/10" : "border-border bg-surface"
                  )}
                  onClick={() => setSelectedPharmacy(selectedPharmacy === pharmacy.npi ? null : pharmacy.npi)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/5 text-accent">
                      <Pill size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-primary">{pharmacy.name || "Unknown pharmacy"}</h3>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                            pharmacy.status === "Active" ? "bg-accent/10 text-accent" : "bg-yellow-100/20 text-yellow-600"
                          )}
                        >
                          {pharmacy.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] font-semibold text-accent">{pharmacy.type}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {pharmacy.fullAddress}
                        </span>
                        {pharmacy.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone size={12} />
                            {pharmacy.phone}
                          </span>
                        ) : null}
                      </div>
                      <span className="mt-1 block text-[10px] font-mono text-muted">NPI: {pharmacy.npi}</span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {pharmacy.phone ? (
                          <a
                            href={`tel:${pharmacy.phone.replace(/[^\d+]/g, "")}`}
                            className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-secondary transition hover:border-teal/30 hover:text-teal"
                          >
                            Call
                          </a>
                        ) : null}
                        {pharmacy.fullAddress ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pharmacy.fullAddress)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-secondary transition hover:border-teal/30 hover:text-teal"
                          >
                            Map
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {selectedPharmacy === pharmacy.npi ? (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4 animate-fade-in">
                      <AIAction
                        agentId="rx"
                        label="Transfer Rx"
                        prompt={`Initiate prescription transfer to ${pharmacy.name} (NPI: ${pharmacy.npi}) at ${pharmacy.fullAddress}.`}
                        context={`Pharmacy: ${pharmacy.name}, NPI: ${pharmacy.npi}, Phone: ${pharmacy.phone}, Address: ${pharmacy.fullAddress}`}
                        variant="inline"
                      />
                      <AIAction
                        agentId="rx"
                        label="Send Refill"
                        prompt={`Send pending refill requests to ${pharmacy.name} (NPI: ${pharmacy.npi}).`}
                        context={`Pharmacy: ${pharmacy.name}, NPI: ${pharmacy.npi}, Phone: ${pharmacy.phone}`}
                        variant="inline"
                      />
                      <AIAction
                        agentId="rx"
                        label="Check Formulary"
                        prompt={`Check if ${pharmacy.name} carries all current patient medications and verify formulary compatibility.`}
                        variant="inline"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {results.length === 0 ? (
              <OpsEmptyState
                icon={Building2}
                title="No pharmacies matched this request"
                description="Try a nearby ZIP, a different city signal, or include the chain name directly."
                className="mt-3"
              />
            ) : null}
          </OpsPanel>
        </>
      ) : null}

      {!hasSearched ? (
        <OpsPanel
          eyebrow="Examples"
          title="Natural-language pharmacy matching"
          description="The strongest requests include what kind of pharmacy you need plus where it should be. Start with a chain, city, or ZIP and refine only if the app asks for clarification."
        >
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                onClick={() => void searchPharmacies(example)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-teal/30 hover:text-teal"
              >
                {example}
              </button>
            ))}
          </div>
        </OpsPanel>
      ) : null}
    </div>
  )
}
