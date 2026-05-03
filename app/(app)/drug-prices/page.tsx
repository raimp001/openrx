"use client"

import { useCallback, useMemo, useState } from "react"
import {
  ArrowRight,
  BadgeCheck,
  DollarSign,
  ExternalLink,
  Lightbulb,
  Loader2,
  Pill,
  Search,
  TrendingDown,
} from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { ClinicalField, ClinicalInput, ClinicalSection, ChoiceChip } from "@/components/ui/clinical-forms"
import { OpsBadge, OpsMetricCard, OpsPanel } from "@/components/ui/ops-primitives"
import { cn } from "@/lib/utils"

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

  const bestOption = result?.directPricing?.options?.[0] ?? null
  const primaryDrug = result?.drugInfo?.[0] ?? null
  const liveOptionCount = result?.directPricing?.options?.length ?? 0
  const genericLabel = primaryDrug?.genericName || "No generic listed"
  const manufacturerLabel = primaryDrug?.manufacturer || "Manufacturer unavailable"
  const searchContextTone = result?.directPricing ? "accent" : result?.pricingProviderConfigured ? "gold" : "blue"

  const guideText = useMemo(() => {
    if (!hasSearched) {
      return "Start with the medication name. OpenRx will show validated drug details first and only display live pricing when a configured source returns a real quote."
    }
    if (result?.directPricing?.options?.length) {
      return "Use the first option as the cheapest visible lead, then verify fill location, savings program eligibility, and whether a generic or alternative strength would change the monthly cost."
    }
    if (result?.pricingProviderConfigured) {
      return "The price provider is live, but it did not return a current quote for this medication. Use the FDA details and cost-reduction guidance while checking alternatives."
    }
    return "No live pricing provider is configured, so this page is acting as a verified medication reference plus cost-reduction guide."
  }, [hasSearched, result])

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Medication pricing"
        title="Drug pricing desk"
        description="Find the cheapest visible path to a medication without pretending price data exists when it does not. OpenRx uses verified drug details first, then overlays live pricing only when a real provider responds."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <OpsBadge tone={result?.pricingProviderConfigured ? "accent" : "blue"}>
              {result?.pricingProviderConfigured ? "live provider connected" : "reference mode"}
            </OpsBadge>
            <OpsBadge tone={bestOption ? "accent" : searchContextTone}>
              {bestOption ? `${liveOptionCount} live option${liveOptionCount === 1 ? "" : "s"}` : "no live quote yet"}
            </OpsBadge>
            {primaryDrug ? <OpsBadge tone="terra">{genericLabel}</OpsBadge> : null}
          </div>
        }
        actions={
          <AIAction
            agentId="rx"
            label="Compare My Meds"
            prompt="Compare active medications and suggest the lowest total monthly cost based on live pricing sources, generic options, and pharmacy differences."
          />
        }
      />

      <ClinicalSection
        kicker="Search request"
        title="Tell OpenRx which medication you want to price."
        description="Use a generic or brand name. The page will return FDA-backed details first, then add live pricing only when a configured source returns a real option."
        aside={
          <div className="space-y-3">
            <div className="eyebrow-pill">Pricing posture</div>
            <p className="text-sm leading-6 text-secondary">{guideText}</p>
            <div className="grid gap-3 pt-1">
              <div className="rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-white/88 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Best visible price</p>
                <p className="mt-2 text-lg font-semibold text-primary">{bestOption?.price || "Awaiting quote"}</p>
                <p className="mt-1 text-[12px] leading-6 text-secondary">{bestOption?.source || "Search a medication to see the lead option."}</p>
              </div>
              <div className="rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-white/88 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Reference retail</p>
                <p className="mt-2 text-lg font-semibold text-primary">{result?.directPricing?.retail || "Unavailable"}</p>
                <p className="mt-1 text-[12px] leading-6 text-secondary">A comparison anchor, not a guaranteed checkout price.</p>
              </div>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <ClinicalField
            label="Medication name"
            hint="Examples: semaglutide, metformin, atorvastatin, albuterol."
            htmlFor="drug-price-query"
          >
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Pill size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <ClinicalInput
                  id="drug-price-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchDrug()}
                  placeholder="Search a medication name"
                  className="pl-11"
                />
              </div>
              <button
                onClick={() => searchDrug()}
                disabled={isLoading}
                aria-label="Find prices"
                className="control-button-primary min-w-[10rem] justify-center"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Find prices
              </button>
            </div>
          </ClinicalField>

          <div className="flex flex-wrap gap-2">
            {POPULAR_DRUGS.map((drug) => (
              <button key={drug} type="button" onClick={() => searchDrug(drug)}>
                <ChoiceChip active={query === drug}>
                  {drug}
                  <ArrowRight size={11} />
                </ChoiceChip>
              </button>
            ))}
          </div>
        </div>
      </ClinicalSection>

      {result ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OpsMetricCard
              label="Live options"
              value={`${liveOptionCount}`}
              detail={bestOption ? `${bestOption.source} is currently the lowest visible lead.` : "No live quote returned for this medication."}
              icon={DollarSign}
              tone={bestOption ? "accent" : searchContextTone}
            />
            <OpsMetricCard
              label="Best visible price"
              value={bestOption?.price || "Unavailable"}
              detail={bestOption?.savings || "Search guidance only until a live source responds."}
              icon={TrendingDown}
              tone={bestOption ? "gold" : searchContextTone}
            />
            <OpsMetricCard
              label="Generic"
              value={genericLabel}
              detail="The generic name OpenRx matched to the search request."
              icon={BadgeCheck}
              tone="blue"
            />
            <OpsMetricCard
              label="Manufacturer"
              value={manufacturerLabel}
              detail="Useful for manufacturer-assistance and supply checks."
              icon={Pill}
              tone="terra"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr_0.85fr]">
            <div className="overflow-hidden rounded-[28px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_58%,#173B83_100%)] p-5 text-white shadow-[0_18px_40px_rgba(8,24,46,0.16)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/56">Best lead to check first</p>
                  <h2 className="mt-4 max-w-xl font-serif text-[2.15rem] leading-[0.96] text-white">
                    {bestOption ? bestOption.source : result.query}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-white/72">
                    {bestOption
                      ? `${bestOption.price}${bestOption.savings ? ` · ${bestOption.savings}` : ""}`
                      : result.pricingProviderConfigured
                        ? "The live provider responded, but did not return a current quote for this medication."
                        : "No live pricing provider is configured, so this page is showing drug reference data and cost-reduction guidance only."}
                  </p>
                </div>
                <OpsBadge tone={bestOption ? "accent" : searchContextTone} className="!border-white/12 !bg-white/10 !text-white">
                  {bestOption ? "actionable" : result.pricingProviderConfigured ? "reference + retry" : "reference only"}
                </OpsBadge>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/12 bg-white/8 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Retail anchor</p>
                  <p className="mt-2 text-lg font-semibold text-white">{result.directPricing?.retail || "Unavailable"}</p>
                  <p className="mt-1 text-[12px] leading-6 text-white/64">Use this as a reference point, not a promised checkout total.</p>
                </div>
                <div className="rounded-[22px] border border-white/12 bg-white/8 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Next move</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {bestOption
                      ? "Verify fill path"
                      : result.pricingProviderConfigured
                        ? "Check alternatives"
                        : "Configure pricing feed"}
                  </p>
                  <p className="mt-1 text-[12px] leading-6 text-white/64">
                    {bestOption
                      ? "Open the source, confirm supply and quantity, then compare against generic and coupon options."
                      : result.pricingProviderConfigured
                        ? "Look at generic, dose, and manufacturer-assistance tips until the live feed returns a valid quote."
                        : "The product is intentionally refusing to fabricate prices without a live pricing source."}
                  </p>
                </div>
              </div>
            </div>
            <PriceBriefCard
              eyebrow="Reference integrity"
              title={result.pricingProviderConfigured ? "Live source connected" : "No live source configured"}
              detail={
                result.pricingProviderConfigured
                  ? "OpenRx can show real quotes when the provider returns them."
                  : "The page is intentionally limited to verified drug details and cost guidance."
              }
              tone={result.pricingProviderConfigured ? "accent" : "blue"}
            />
            <PriceBriefCard
              eyebrow="Partial matches"
              title={`${result.partialMatches.length} alternatives`}
              detail={
                result.partialMatches.length
                  ? `Closest alternatives: ${result.partialMatches.slice(0, 2).join(", ")}`
                  : "The current search matched directly without alternative suggestions."
              }
              tone={result.partialMatches.length ? "gold" : "accent"}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
            <OpsPanel
              eyebrow="Drug details"
              title="Verified medication reference"
              description="FDA-backed details are always shown first so the user can confirm they are pricing the right drug, formulation, and route."
            >
              {result.drugInfo?.length ? (
                <div className="space-y-3">
                  {result.drugInfo.slice(0, 2).map((drug, i) => (
                    <article key={`${drug.brandName}-${i}`} className="surface-muted px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-serif text-primary">{drug.brandName || result.query}</h3>
                        <OpsBadge tone="blue">{drug.genericName || "generic unavailable"}</OpsBadge>
                      </div>
                      <div className="mt-3 grid gap-2 text-[12px] leading-6 text-secondary sm:grid-cols-2">
                        <span>Form: {drug.dosageForm || "N/A"}</span>
                        <span>Route: {drug.route || "N/A"}</span>
                        <span>Manufacturer: {drug.manufacturer || "N/A"}</span>
                        <span>DEA schedule: {drug.deaSchedule || "None listed"}</span>
                        {drug.activeIngredients ? <span className="sm:col-span-2">Active ingredients: {drug.activeIngredients}</span> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="surface-muted px-5 py-8 text-sm leading-7 text-secondary">
                  No FDA detail block was returned for this search. Use the medication name carefully and verify the exact formulation before pricing.
                </div>
              )}
            </OpsPanel>

            <OpsPanel
              eyebrow="Price ladder"
              title="Visible offers"
              description="Only real responses are shown here. If the live provider returns nothing, the board stays honest and shifts to guidance."
            >
              {result.directPricing?.options?.length ? (
                <div className="space-y-3">
                  {result.directPricing.options.map((opt, i) => (
                    <article
                      key={`${opt.source}-${i}`}
                      className={cn(
                        "rounded-[22px] border px-4 py-4",
                        i === 0
                          ? "border-[rgba(47,107,255,0.20)] bg-[linear-gradient(180deg,rgba(245,249,255,0.96),rgba(238,245,255,0.92))]"
                          : "border-[rgba(82,108,139,0.12)] bg-white/90"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-primary">{opt.source}</h3>
                            {i === 0 ? <OpsBadge tone="accent">best visible</OpsBadge> : null}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-secondary">{opt.note || "Live provider response"}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-primary">{opt.price}</div>
                          {opt.savings ? <div className="text-[11px] font-medium text-accent">{opt.savings}</div> : null}
                        </div>
                      </div>
                      {opt.url ? (
                        <a
                          href={opt.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal hover:text-teal-dark"
                        >
                          Open source <ExternalLink size={11} />
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="surface-muted px-5 py-8 text-sm leading-7 text-secondary">
                  {result.pricingProviderConfigured
                    ? "The live provider did not return a current quote for this medication. Use the cost-reduction guidance while checking generic, quantity, or pharmacy changes."
                    : "No live pricing provider is configured, so the board is intentionally staying in reference-and-guidance mode."}
                </div>
              )}
            </OpsPanel>
          </div>

          <OpsPanel
            eyebrow="Cost reduction guide"
            title="What to check next"
            description="These are the actions most likely to reduce total medication cost when the initial quote is still too high."
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {result.generalTips.map((tip, i) => (
                <div key={`${tip.tip}-${i}`} className="surface-muted px-4 py-4">
                  <div className="flex items-start gap-2">
                    <Lightbulb size={15} className="mt-0.5 shrink-0 text-teal" />
                    <div>
                      <p className="text-sm font-semibold text-primary">{tip.tip}</p>
                      <p className="mt-1 text-xs leading-6 text-secondary">{tip.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </OpsPanel>
        </>
      ) : isLoading ? (
        <div className="surface-card px-6 py-12 text-center">
          <Loader2 size={24} className="mx-auto mb-3 animate-spin text-teal" />
          <p className="text-sm font-medium text-primary">Querying live medication sources...</p>
          <p className="mt-2 text-xs leading-6 text-muted">OpenRx is checking the medication reference and any configured pricing provider.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr_0.85fr]">
          <div className="overflow-hidden rounded-[28px] border border-[rgba(82,108,139,0.18)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_58%,#173B83_100%)] p-5 text-white shadow-[0_18px_40px_rgba(8,24,46,0.16)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/56">What this page does</p>
            <h2 className="mt-4 max-w-xl font-serif text-[2.15rem] leading-[0.96] text-white">Live-first pricing, honest by default.</h2>
            <p className="mt-3 text-sm leading-7 text-white/72">
              Search any medication to get verified drug details and live pricing when a configured provider responds. If it does not, the page stays useful without inventing numbers.
            </p>
          </div>
          <PriceBriefCard
            eyebrow="Fastest wins"
            title="Try generic first"
            detail="Generic name searches usually produce the cleanest pricing and coupon comparisons."
            tone="accent"
          />
          <PriceBriefCard
            eyebrow="Before you pay"
            title="Check quantity and source"
            detail="Strength, quantity, and pharmacy location can change the monthly total more than the label price suggests."
            tone="gold"
          />
        </div>
      )}
    </div>
  )
}

function PriceBriefCard({
  eyebrow,
  title,
  detail,
  tone,
}: {
  eyebrow: string
  title: string
  detail: string
  tone: "terra" | "accent" | "blue" | "gold" | "red"
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border px-5 py-5",
        tone === "red"
          ? "border-red-200/45 bg-[linear-gradient(180deg,rgba(255,247,246,0.96),rgba(255,239,237,0.92))]"
          : tone === "gold"
            ? "border-amber-300/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.90))]"
            : tone === "blue"
              ? "border-[rgba(59,130,246,0.18)] bg-[linear-gradient(180deg,rgba(245,249,255,0.96),rgba(238,245,255,0.92))]"
              : tone === "accent"
                ? "border-[rgba(47,107,255,0.14)] bg-[linear-gradient(180deg,rgba(245,249,255,0.96),rgba(238,245,255,0.92))]"
                : "border-[rgba(47,107,255,0.14)] bg-[linear-gradient(180deg,rgba(255,248,244,0.96),rgba(255,242,237,0.92))]"
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{eyebrow}</div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-serif leading-tight text-primary">{title}</div>
          <div className="mt-2 text-sm leading-6 text-secondary">{detail}</div>
        </div>
        <OpsBadge tone={tone} className="shrink-0">
          {tone === "accent" ? "ready" : tone === "blue" ? "reference" : tone === "gold" ? "review" : tone === "red" ? "urgent" : "guide"}
        </OpsBadge>
      </div>
    </div>
  )
}
