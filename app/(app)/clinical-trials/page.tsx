"use client"

import { useCallback, useState } from "react"
import { ExternalLink, FlaskConical, Loader2, Search, Sparkles } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import type { TrialMatch } from "@/lib/basehealth"

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
        title="Clinical Trial Matching"
        description="BaseHealth-style trial discovery connected to OpenRx patient context."
        actions={
          <AIAction
            agentId="trials"
            label="Trial Strategy"
            prompt="Find clinical trial opportunities that match my conditions and explain what to ask before enrolling."
          />
        }
      />

      <div className="bg-surface rounded-2xl border border-border p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs text-secondary">
            Condition
            <input
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-teal/40"
            />
          </label>
          <label className="text-xs text-secondary">
            Preferred location
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-teal/40"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={() => searchTrials()}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal text-white text-sm font-semibold hover:bg-teal-dark disabled:opacity-60 transition"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Match Trials
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-soft-red mt-3">{error}</p>}
      </div>

      {loading && (
        <div className="bg-surface rounded-2xl border border-border p-8 text-center text-sm text-muted">
          <Loader2 size={16} className="animate-spin inline mr-2" />
          Matching eligible clinical studies...
        </div>
      )}

      {!loading && hasSearched && (
        <>
          {matches.length > 0 ? (
            <div className="space-y-3">
              {matches.map((trial) => (
                <div
                  key={trial.id}
                  className="bg-surface rounded-2xl border border-border p-5 hover:border-teal/30 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-primary">{trial.title}</h2>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            trial.fit === "strong"
                              ? "bg-accent/10 text-accent"
                              : "bg-yellow-100/20 text-yellow-500"
                          }`}
                        >
                          {trial.fit}
                        </span>
                      </div>
                      <p className="text-sm text-secondary mt-1">{trial.summary}</p>
                      <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-muted">
                        <span className="px-2 py-0.5 rounded-full bg-surface/50 border border-border">{trial.phase}</span>
                        <span className="px-2 py-0.5 rounded-full bg-surface/50 border border-border">{trial.condition}</span>
                        <span className="px-2 py-0.5 rounded-full bg-surface/50 border border-border">{trial.location}</span>
                        <span className="px-2 py-0.5 rounded-full bg-surface/50 border border-border">{trial.sponsor}</span>
                        {trial.remoteEligible && (
                          <span className="px-2 py-0.5 rounded-full bg-teal/10 text-teal border border-teal/20">
                            Remote eligible
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-teal">{trial.matchScore}</div>
                      <div className="text-[11px] text-muted">fit score</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {trial.reasons.map((reason) => (
                      <div key={reason} className="text-xs text-secondary rounded-lg border border-border/70 bg-surface/30 p-2.5">
                        {reason}
                      </div>
                    ))}
                  </div>
                  <a
                    href={trial.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal hover:text-teal-dark transition"
                  >
                    View study details <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-border p-8 text-center">
              <FlaskConical size={24} className="text-sand mx-auto mb-2" />
              <p className="text-sm text-secondary">No strong trial matches found with this query.</p>
              <p className="text-xs text-muted mt-1">
                Try broader condition terms or a nearby metro area.
              </p>
            </div>
          )}
        </>
      )}

      <div className="bg-teal/10 rounded-2xl border border-teal/20 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-teal" />
          <span className="text-xs font-bold text-teal">Enrollment Reminder</span>
        </div>
        <p className="text-xs text-secondary">
          Trial matching is directional. Final eligibility must be confirmed directly with the study site.
        </p>
      </div>
    </div>
  )
}
