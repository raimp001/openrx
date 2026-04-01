"use client"

import { useCallback, useState } from "react"
import { ExternalLink, FlaskConical, Loader2, MapPin, Search, Sparkles } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsEmptyState } from "@/components/ui/ops-primitives"
import { cn } from "@/lib/utils"
import type { TrialMatch } from "@/lib/basehealth"

const EXAMPLE_SEARCHES = [
  { condition: "Type 2 diabetes", location: "" },
  { condition: "Breast cancer", location: "New York" },
  { condition: "COPD", location: "San Francisco" },
  { condition: "Alzheimer's", location: "" },
]

export default function ClinicalTrialsPage() {
  const [condition, setCondition] = useState("")
  const [location, setLocation] = useState("")
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<TrialMatch[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState("")

  const searchTrials = useCallback(async (nextCondition = condition, nextLocation = location) => {
    if (!nextCondition.trim() && !nextLocation.trim()) {
      setError("Enter a condition, location, or both before searching.")
      setHasSearched(false)
      setMatches([])
      return
    }

    setError("")
    setLoading(true)
    setHasSearched(true)
    if (nextCondition !== condition) setCondition(nextCondition)
    if (nextLocation !== location) setLocation(nextLocation)
    try {
      const params = new URLSearchParams()
      if (nextCondition.trim()) params.set("condition", nextCondition.trim())
      if (nextLocation.trim()) params.set("location", nextLocation.trim())
      const response = await fetch(`/api/clinical-trials/match?${params}`)
      const data = (await response.json()) as { matches?: TrialMatch[]; error?: string }
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to match trials.")
      }
      setMatches(data.matches || [])
    } catch (issue) {
      setMatches([])
      setError(issue instanceof Error ? issue.message : "Failed to match trials.")
    } finally {
      setLoading(false)
    }
  }, [condition, location])

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Research"
        title="Clinical Trial Matching"
        description="Lyra searches active clinical studies and scores them against your health profile. Results are directional — final eligibility is confirmed by the study site."
        actions={
          <AIAction
            agentId="trials"
            label="Lyra: Trial Strategy"
            prompt="Find clinical trial opportunities that match my conditions and explain what to ask before enrolling."
          />
        }
      />

      <section className="surface-card p-5 sm:p-6">
        <div className="space-y-4">
          <div>
            <p className="section-title">Search criteria</p>
            <p className="mt-1 text-sm text-muted">Enter a condition, location, or both. Lyra handles the matching.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Condition</span>
              <div className="relative mt-1.5">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={condition}
                  onChange={(event) => setCondition(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && searchTrials()}
                  placeholder="e.g. Type 2 diabetes, breast cancer"
                  className="control-input mt-0 w-full pl-9"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Location</span>
              <div className="relative mt-1.5">
                <MapPin size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && searchTrials()}
                  placeholder="City, state, or leave blank"
                  className="control-input mt-0 w-full pl-9"
                />
              </div>
            </label>
            <div className="flex items-end">
              <button
                onClick={() => searchTrials()}
                disabled={loading}
                className="control-button-primary w-full md:w-auto"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Match Trials
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {EXAMPLE_SEARCHES.map((example) => (
              <button
                key={example.condition}
                onClick={() => searchTrials(example.condition, example.location)}
                className="chip transition hover:border-teal/30 hover:text-teal"
              >
                {example.condition}{example.location ? ` · ${example.location}` : ""}
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-soft-red">{error}</p>}
        </div>
      </section>

      {loading && (
        <div className="surface-card p-8 text-center text-sm text-muted">
          <Loader2 size={16} className="animate-spin inline mr-2" />
          Matching eligible clinical studies...
        </div>
      )}

      {!loading && hasSearched && (
        <>
          {matches.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-primary">{matches.length} trial{matches.length !== 1 ? "s" : ""} matched</p>
                <span className="text-[11px] text-muted">Sorted by fit score</span>
              </div>
              {matches.map((trial) => (
                <article
                  key={trial.id}
                  className="surface-card p-5 transition hover:border-teal/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-primary">{trial.title}</h2>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                            trial.fit === "strong"
                              ? "bg-accent/10 text-accent"
                              : "bg-yellow-100/20 text-yellow-500"
                          )}
                        >
                          {trial.fit} fit
                        </span>
                      </div>
                      <p className="text-sm text-secondary mt-1 leading-relaxed">{trial.summary}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="chip">{trial.phase}</span>
                        <span className="chip">{trial.condition}</span>
                        <span className="chip">{trial.location}</span>
                        <span className="chip">{trial.sponsor}</span>
                        {trial.remoteEligible && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal/10 text-teal border border-teal/20">
                            Remote eligible
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-teal">{trial.matchScore}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-muted">score</div>
                    </div>
                  </div>

                  {trial.reasons.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-2">
                      {trial.reasons.map((reason) => (
                        <div key={reason} className="surface-muted px-3 py-2.5 text-xs text-secondary leading-5">
                          {reason}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <a
                      href={trial.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="control-button-secondary text-[11px]"
                    >
                      View study details <ExternalLink size={11} />
                    </a>
                    <AIAction
                      agentId="trials"
                      label="Assess fit"
                      prompt={`Assess my eligibility for "${trial.title}" (${trial.condition}, ${trial.phase}) and list questions I should ask the study coordinator.`}
                      context={`Trial: ${trial.title}, Phase: ${trial.phase}, Condition: ${trial.condition}, Fit: ${trial.fit}, Score: ${trial.matchScore}`}
                      variant="compact"
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="surface-card py-12">
              <OpsEmptyState
                icon={FlaskConical}
                title="No strong trial matches"
                description="Try broader condition terms or a nearby metro area."
              />
            </div>
          )}
        </>
      )}

      {!hasSearched && !loading && (
        <div className="surface-card py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-teal/8">
            <FlaskConical size={28} className="text-teal" />
          </div>
          <h3 className="text-lg font-serif text-primary">Find trials that fit your profile</h3>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            Enter a condition above and Lyra will match active clinical studies scored against your health context.
          </p>
        </div>
      )}

      <div className="surface-card border-teal/20 bg-teal/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-teal" />
          <span className="text-xs font-bold text-teal">Enrollment Reminder</span>
        </div>
        <p className="text-xs text-secondary leading-5">
          Trial matching is directional. Final eligibility must be confirmed directly with the study site. OpenRx does not enroll patients — it surfaces options and questions.
        </p>
      </div>
    </div>
  )
}
