"use client"

import Image from "next/image"
import { useCallback, useMemo, useState } from "react"
import { BadgeCheck, Building2, Loader2, MapPin, Phone, Pill, Search, ShieldCheck } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
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
  const [promptImage, setPromptImage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState("")
  const [selectedPharmacy, setSelectedPharmacy] = useState<string | null>(null)

  const profileLocation = snapshot.patient?.address || ""
  const activeResults = useMemo(() => results.filter((item) => item.status === "Active"), [results])

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
          prompt?: { image?: string }
        }

        if (!response.ok || data.error) {
          throw new Error(data.error || "Search failed.")
        }

        setReady(Boolean(data.ready))
        setParsed(data.parsed || null)
        setClarificationQuestion(data.clarificationQuestion || "")
        setResults(data.pharmacies || [])
        setCount(data.count || 0)
        setPromptImage(data.prompt?.image || "")
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
        description="Natural-language pharmacy search with NPI registry gating and clarification."
        className="surface-card p-4 sm:p-5"
        actions={
          <AIAction
            agentId="rx"
            label="Compare Prices"
            prompt="Compare nearby pharmacy options for active medications and suggest the most cost-effective refill plan."
          />
        }
      />

      <div className="surface-card p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && searchPharmacies()}
              placeholder="Example: Find CVS pharmacy near Seattle WA 98101"
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border bg-surface/30 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-teal/40 focus:ring-2 focus:ring-teal/10 transition"
            />
          </div>
          <button
            onClick={() => void searchPharmacies()}
            disabled={isLoading}
            className="px-6 py-3.5 bg-teal text-white text-sm font-semibold rounded-xl hover:bg-teal-dark transition flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={useProfileLocation}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-border text-secondary hover:border-teal/30 hover:text-teal transition"
          >
            Use profile location
          </button>
          <span className="text-[10px] text-muted">{profileLocation}</span>
        </div>
        {error && <p className="text-xs text-soft-red mt-3">{error}</p>}
      </div>

      {hasSearched && !isLoading && ready === false && (
        <div className="bg-yellow-100/20 rounded-2xl border border-yellow-300/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={14} className="text-yellow-500" />
            <p className="text-sm font-semibold text-primary">Need one more detail before search</p>
          </div>
          <p className="text-sm text-secondary">{clarificationQuestion}</p>
          {parsed && (
            <div className="flex flex-wrap gap-2 mt-3">
              {parsed.name && (
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-teal/10 text-teal">
                  {parsed.name}
                </span>
              )}
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
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted">
              {count} pharmac{count !== 1 ? "ies" : "y"} found · {activeResults.length} active
            </p>
            <span className="text-[10px] text-muted flex items-center gap-1">
              <BadgeCheck size={10} /> Live CMS NPI data
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {results.map((pharmacy) => (
              <div
                key={pharmacy.npi}
                className={cn(
                  "bg-surface rounded-2xl border p-5 hover:border-teal/20 transition cursor-pointer",
                  selectedPharmacy === pharmacy.npi ? "border-teal/30 ring-1 ring-teal/10" : "border-border"
                )}
                onClick={() =>
                  setSelectedPharmacy(selectedPharmacy === pharmacy.npi ? null : pharmacy.npi)
                }
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-accent/5 flex items-center justify-center text-accent shrink-0">
                    <Pill size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-primary">{pharmacy.name || "Unknown pharmacy"}</h3>
                      <span
                        className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                          pharmacy.status === "Active"
                            ? "bg-accent/10 text-accent"
                            : "bg-yellow-100/20 text-yellow-600"
                        )}
                      >
                        {pharmacy.status}
                      </span>
                    </div>
                    <p className="text-[10px] font-semibold text-accent mt-0.5">{pharmacy.type}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {pharmacy.fullAddress}
                      </span>
                      {pharmacy.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {pharmacy.phone}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-muted mt-1 block">NPI: {pharmacy.npi}</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {pharmacy.phone && (
                        <a
                          href={`tel:${pharmacy.phone.replace(/[^\d+]/g, "")}`}
                          className="text-[10px] font-semibold px-2 py-1 rounded-md border border-border text-secondary hover:text-teal hover:border-teal/30 transition"
                        >
                          Call
                        </a>
                      )}
                      {pharmacy.fullAddress && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pharmacy.fullAddress)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-semibold px-2 py-1 rounded-md border border-border text-secondary hover:text-teal hover:border-teal/30 transition"
                        >
                          Map
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {selectedPharmacy === pharmacy.npi && (
                  <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2 animate-fade-in">
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
                )}
              </div>
            ))}
          </div>

          {results.length === 0 && (
            <div className="text-center py-12 surface-card mt-3">
              <Building2 size={30} className="text-sand mx-auto mb-2" />
              <p className="text-sm text-muted">
                No pharmacies found. Try a nearby ZIP or a different pharmacy name.
              </p>
            </div>
          )}
        </div>
      )}

      {!hasSearched && (
        <div className="text-center py-12 surface-card">
          <div className="w-16 h-16 rounded-2xl bg-accent/5 flex items-center justify-center mx-auto mb-4">
            <Pill size={28} className="text-accent" />
          </div>
          <h3 className="text-lg font-serif text-primary">Natural Language Pharmacy Search</h3>
          <p className="text-sm text-muted mt-2 max-w-xl mx-auto">
            Tell us the pharmacy and location in one sentence. Search begins only when location details are complete.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-6 max-w-3xl mx-auto">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                onClick={() => void searchPharmacies(example)}
                className="px-3 py-1.5 text-xs font-medium text-secondary bg-surface rounded-lg border border-border hover:border-teal/30 hover:text-teal transition"
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
            <ShieldCheck size={14} className="text-teal" />
            <span className="text-xs font-bold text-primary">Prompt Artifact Used</span>
          </div>
          <div className="rounded-xl overflow-hidden border border-border/70">
            <Image
              src={promptImage}
              width={1400}
              height={920}
              alt="OpenRx natural-language pharmacy search prompt"
              className="w-full h-auto"
            />
          </div>
        </div>
      )}
    </div>
  )
}
