"use client"

import { cn } from "@/lib/utils"
import {
  Search,
  DollarSign,
  ExternalLink,
  Loader2,
  BadgeCheck,
  TrendingDown,
  Pill,
  Lightbulb,
  ArrowRight,
} from "lucide-react"
import { useState, useCallback } from "react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"

interface DirectPrice {
  source: string
  price: string
  savings: string
  url: string
  note: string
}

interface DrugResult {
  query: string
  drugInfo: {
    brandName: string
    genericName: string
    dosageForm: string
    route: string
    manufacturer: string
    activeIngredients: string
    deaSchedule: string
  }[] | null
  directPricing: {
    retail: string
    options: DirectPrice[]
  } | null
  partialMatches: string[]
  generalTips: { tip: string; detail: string }[]
  pricingProviderConfigured?: boolean
  livePricingAvailable?: boolean
}

const POPULAR_DRUGS = [
  "Semaglutide",
  "Metformin",
  "Atorvastatin",
  "Lisinopril",
  "Amlodipine",
  "Insulin",
  "Sertraline",
  "Levothyroxine",
  "Albuterol",
  "Omeprazole",
]

export default function DrugPricesPage() {
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<DrugResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const searchDrug = useCallback(
    async (searchQuery?: string) => {
      const q = (searchQuery || query).trim()
      if (!q) return

      setIsLoading(true)
      setHasSearched(true)
      if (searchQuery) setQuery(searchQuery)

      try {
        const res = await fetch(`/api/drug-prices?q=${encodeURIComponent(q)}`)
        const data = (await res.json()) as DrugResult
        setResult(data)
      } catch {
        setResult(null)
      } finally {
        setIsLoading(false)
      }
    },
    [query]
  )

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        title="Drug Price Finder"
        description="Live medication lookup with optional real-time pricing integrations."
        actions={
          <AIAction
            agentId="rx"
            label="Compare My Meds"
            prompt="Compare active medications and suggest the lowest total monthly cost based on live pricing sources and pharmacy options."
          />
        }
      />

      <div className="bg-terra/10 rounded-2xl border border-terra/20 p-5">
        <div className="flex items-start gap-3">
          <DollarSign size={20} className="text-terra shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-warm-800">Pricing policy</h3>
            <p className="text-xs text-warm-600 mt-1 leading-relaxed">
              OpenRx only displays medication pricing from configured live providers. If no pricing integration is configured, the app shows
              FDA drug details and cost-reduction guidance without fabricated prices.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-pampas rounded-2xl border border-sand p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Pill
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-cloudy"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchDrug()}
              placeholder="Search a medication name"
              aria-label="Search drug prices"
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-sand bg-sand/20 text-sm text-warm-800 placeholder:text-cloudy focus:outline-none focus:border-terra/40 focus:ring-2 focus:ring-terra/10 transition"
            />
          </div>
          <button
            onClick={() => searchDrug()}
            disabled={isLoading}
            aria-label="Search prices"
            className="px-6 py-3.5 bg-terra text-white text-sm font-semibold rounded-xl hover:bg-terra-dark transition flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            Find Prices
          </button>
        </div>
      </div>

      {hasSearched && result && !isLoading && (
        <div className="space-y-6">
          {result.drugInfo && result.drugInfo.length > 0 && (
            <div className="bg-pampas rounded-2xl border border-sand p-5">
              <div className="flex items-center gap-2 mb-3">
                <BadgeCheck size={14} className="text-accent" />
                <span className="text-xs font-bold text-warm-700">FDA Drug Information</span>
              </div>
              {result.drugInfo.slice(0, 2).map((drug, i) => (
                <div key={i} className={cn("pb-3", i > 0 && "pt-3 border-t border-sand")}>
                  <h3 className="text-base font-bold text-warm-800">{drug.brandName || result.query}</h3>
                  <p className="text-xs text-warm-600 mt-0.5">Generic: {drug.genericName || "Unavailable"}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-warm-500">
                    <span>Form: {drug.dosageForm || "N/A"}</span>
                    <span>Route: {drug.route || "N/A"}</span>
                    <span>Manufacturer: {drug.manufacturer || "N/A"}</span>
                    {drug.activeIngredients && <span>Active: {drug.activeIngredients}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.directPricing ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingDown size={16} className="text-accent" />
                  <h2 className="text-base font-serif text-warm-800">Live Pricing Results</h2>
                </div>
                <span className="text-xs text-warm-500">
                  {result.directPricing.retail ? `Reference: ${result.directPricing.retail}` : "Reference price unavailable"}
                </span>
              </div>

              <div className="space-y-3">
                {result.directPricing.options.map((opt, i) => (
                  <div
                    key={i}
                    className={cn(
                      "bg-pampas rounded-2xl border p-5 transition",
                      i === 0 ? "border-accent/30 ring-1 ring-accent/10" : "border-sand"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-warm-800">{opt.source}</h3>
                          {i === 0 && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent uppercase">
                              Best Available
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-warm-500 mt-1">{opt.note || "Live source result"}</p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="text-xl font-bold text-terra">{opt.price}</div>
                        {opt.savings && <div className="text-xs font-bold text-accent">{opt.savings}</div>}
                      </div>
                    </div>
                    {opt.url && (
                      <a
                        href={opt.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-terra hover:text-terra-dark transition"
                      >
                        View source <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-pampas rounded-2xl border border-sand p-6 text-center">
              <DollarSign size={28} className="text-cloudy mx-auto mb-2" />
              <p className="text-sm text-warm-700 font-semibold">No live price feed available for &ldquo;{result.query}&rdquo;</p>
              <p className="text-xs text-warm-500 mt-1">
                {result.pricingProviderConfigured
                  ? "Your pricing provider did not return current price options for this medication."
                  : "Configure OPENRX_DRUG_PRICE_PROVIDER_URL to enable live medication price aggregation."}
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-terra" />
              <h2 className="text-base font-serif text-warm-800">Cost Optimization Tips</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {result.generalTips.map((tip, i) => (
                <div key={i} className="bg-pampas rounded-xl border border-sand p-4">
                  <p className="text-xs font-bold text-warm-800">{tip.tip}</p>
                  <p className="text-[11px] text-warm-500 mt-1 leading-relaxed">{tip.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12">
          <Loader2 size={24} className="text-terra mx-auto animate-spin mb-3" />
          <p className="text-sm text-warm-500">Querying live medication sources...</p>
        </div>
      )}

      {!hasSearched && (
        <div>
          <div className="text-center py-8 bg-pampas rounded-2xl border border-sand mb-6">
            <div className="w-16 h-16 rounded-2xl bg-terra/10 flex items-center justify-center mx-auto mb-4">
              <DollarSign size={28} className="text-terra" />
            </div>
            <h3 className="text-lg font-serif text-warm-800">Live-first pricing</h3>
            <p className="text-sm text-warm-500 mt-2 max-w-md mx-auto">
              Search any medication to see validated drug details and real pricing when integrations are configured.
            </p>
          </div>

          <h3 className="text-xs font-bold text-warm-500 uppercase tracking-wider mb-3">Popular Searches</h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            {POPULAR_DRUGS.map((drug) => (
              <button
                key={drug}
                onClick={() => searchDrug(drug)}
                className="bg-pampas rounded-xl border border-sand p-3 text-left hover:border-terra/30 hover:bg-terra/5 transition group"
              >
                <span className="text-xs font-semibold text-warm-800 group-hover:text-terra transition">{drug}</span>
                <ArrowRight size={10} className="text-cloudy group-hover:text-terra transition inline ml-1" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
