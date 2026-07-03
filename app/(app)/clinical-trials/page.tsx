"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, FlaskConical, Loader2, MapPin, Search, ShieldCheck, Sparkles } from "lucide-react"
import AIAction from "@/components/ai-action"
import { ChoiceChip, ClinicalField, ClinicalInput, FieldsetCard } from "@/components/ui/clinical-forms"
import type { TrialMatch } from "@/lib/basehealth"

const SEARCH_EXAMPLES = [
  { condition: "prostate cancer", location: "Seattle" },
  { condition: "breast cancer", location: "Portland" },
  { condition: "colon cancer", location: "San Francisco" },
]

export default function ClinicalTrialsPage() {
  const searchParams = useSearchParams()
  const seededHandoffRef = useRef(false)
  const [condition, setCondition] = useState("")
  const [location, setLocation] = useState("")
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<TrialMatch[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState("")
  const [handoffNotice, setHandoffNotice] = useState("")

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

  useEffect(() => {
    if (seededHandoffRef.current) return
    seededHandoffRef.current = true

    const nextCondition = (searchParams.get("condition") || searchParams.get("q") || "").trim()
    const nextLocation = (searchParams.get("location") || searchParams.get("zip") || "").trim()
    if (!nextCondition && !nextLocation) return

    setCondition(nextCondition)
    setLocation(nextLocation)
    if (searchParams.get("handoff")) {
      setHandoffNotice("Loaded your chat context and started a directional trial search here. Eligibility still belongs to the study site.")
    }
    if (searchParams.get("autorun") === "1" || searchParams.get("handoff") === "chat") {
      void searchTrials(nextCondition, nextLocation)
    }
  }, [searchParams, searchTrials])

  const searchSummary = useMemo(() => {
    if (!hasSearched) return "Search by condition, geography, or both."
    if (loading) return "Looking for trials that match the current request."
    if (!matches.length) return "No strong study matches surfaced for this request."
    return `${matches.length} study match${matches.length === 1 ? "" : "es"} surfaced for this request.`
  }, [hasSearched, loading, matches.length])

  return (
    <div className="animate-slide-up space-y-6">
      <section className="border-b border-white/10 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="shell-kicker">Clinical research</p>
            <h1 className="orx-page-title mt-3 text-[clamp(2rem,4.4vw,3.4rem)] text-primary">
              Find clinical trials.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">
              Search by condition and location. OpenRx surfaces candidates, not eligibility certainty.
            </p>
          </div>
          <AIAction
            agentId="trials"
            label="Trial strategy"
            prompt="Find clinical trial opportunities that match my conditions and explain what to ask before enrolling."
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip">ClinicalTrials.gov search</span>
          <span className="chip">Location-aware</span>
          <span className="chip">Eligibility caveats visible</span>
        </div>
      </section>

      <section className="grid gap-5 border-b border-white/10 pb-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <ClinicalField
              label="Condition"
              hint="Use the disease or tumor type."
              htmlFor="trial-condition"
            >
              <ClinicalInput
                id="trial-condition"
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
                placeholder="Prostate cancer"
              />
            </ClinicalField>

            <ClinicalField
              label="Location"
              hint="Use a city, state, or ZIP."
              htmlFor="trial-location"
            >
              <ClinicalInput
                id="trial-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Seattle, WA or 98101"
              />
            </ClinicalField>

            <button
              type="button"
              onClick={() => void searchTrials()}
              disabled={loading}
              className="control-button-primary min-h-[52px] px-5"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              Match trials
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {SEARCH_EXAMPLES.map((example) => (
              <button
                key={`${example.condition}-${example.location}`}
                type="button"
                onClick={() => {
                  setCondition(example.condition)
                  setLocation(example.location)
                  void searchTrials(example.condition, example.location)
                }}
                className="control-button-secondary px-4 py-2"
              >
                {example.condition} · {example.location}
              </button>
            ))}
          </div>

          {handoffNotice ? (
            <p data-testid="trials-handoff-notice" className="text-sm text-accent">
              {handoffNotice}
            </p>
          ) : null}
          {error ? <p className="text-sm text-soft-red">{error}</p> : null}
        </div>

        <aside className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
          <div className="section-title">Ranking</div>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Condition fit comes first, then geography. The study site decides final eligibility.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ChoiceChip>
              <ShieldCheck size={12} />
              Trust first
            </ChoiceChip>
            <ChoiceChip>
              <MapPin size={12} />
              Location-sensitive
            </ChoiceChip>
          </div>
        </aside>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="shell-kicker">Search readout</p>
            <h2 className="orx-section-heading mt-3 text-[1.5rem] text-primary sm:text-[1.75rem]">{searchSummary}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
              {hasSearched
                ? "Use the reasons below to decide whether to call the site, ask for an oncology referral, or widen the search."
                : "Search results will appear here with fit reasons and practical questions to ask before enrollment."}
            </p>
          </div>
          {(condition || location) && hasSearched ? (
            <div className="flex flex-wrap gap-2">
              {condition ? <span className="chip">{condition}</span> : null}
              {location ? <span className="chip">{location}</span> : null}
            </div>
          ) : null}
        </div>
      </section>

      {loading ? (
        <section className="surface-card flex items-center gap-3 p-6 text-sm text-secondary">
          <Loader2 size={16} className="animate-spin text-teal" />
          Matching studies and ranking nearby sites...
        </section>
      ) : null}

      {!loading && hasSearched ? (
        matches.length > 0 ? (
          <div className="space-y-4">
            {matches.map((trial) => (
              <article key={trial.id} className="surface-card p-5 sm:p-6">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.4fr]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${trial.fit === "strong" ? "bg-teal/10 text-teal" : "bg-amber-100 text-amber-700"}`}>
                        {trial.fit} fit
                      </span>
                      {trial.remoteEligible ? (
                        <span className="rounded-full bg-soft-blue/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-soft-blue">
                          Remote eligible
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-4 text-[1.45rem] font-semibold leading-tight text-primary">{trial.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-secondary">{trial.summary}</p>

                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-secondary">
                      <span className="chip">{trial.phase}</span>
                      <span className="chip">{trial.condition}</span>
                      <span className="chip">{trial.location}</span>
                      <span className="chip">{trial.sponsor}</span>
                    </div>
                  </div>

                  <div className="surface-muted flex flex-col items-center justify-center px-4 py-5 text-center">
                    <div className="section-title">Fit score</div>
                    <div className="mt-3 text-4xl font-semibold leading-none text-teal">{trial.matchScore}</div>
                    <p className="mt-2 text-xs leading-5 text-secondary">Directional score only. The study team makes the final eligibility call.</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <FieldsetCard legend="Why this looks relevant" className="h-full">
                    <div className="grid gap-2">
                      {trial.reasons.map((reason) => (
                        <div key={reason} className="rounded-[18px] border border-white/78 bg-white/74 px-4 py-3 text-sm leading-6 text-secondary shadow-sm">
                          {reason}
                        </div>
                      ))}
                    </div>
                  </FieldsetCard>

                  <FieldsetCard legend="Questions to ask before calling" className="h-full">
                    <div className="grid gap-2">
                      {buildTrialQuestions(trial).map((question) => (
                        <div key={question} className="rounded-[18px] border border-white/78 bg-white/74 px-4 py-3 text-sm leading-6 text-secondary shadow-sm">
                          {question}
                        </div>
                      ))}
                    </div>
                  </FieldsetCard>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs leading-6 text-secondary">
                    Verify travel expectations, inclusion criteria, and whether local labs or imaging can be done near the patient before enrollment.
                  </p>
                  <a
                    href={trial.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="control-button-secondary px-4 py-2"
                  >
                    View study details
                    <ExternalLink size={14} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="surface-card p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/10 text-teal">
              <FlaskConical size={22} />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-primary">No strong study matches surfaced</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-secondary">
              Try a broader disease term, a nearby metro area, or search the primary disease first and then tighten to geography.
            </p>
          </section>
        )
      ) : null}

      <section className="surface-muted p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-teal shadow-sm">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="section-title">Enrollment reminder</div>
            <p className="mt-2 text-sm leading-6 text-secondary">
              Trial matching is directional. Use it to narrow the field, then confirm eligibility, timing, and travel burden directly with the study coordinator or referring oncologist.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function buildTrialQuestions(trial: TrialMatch) {
  const questions = [
    `Does ${trial.location} reflect the actual enrollment site, or is screening done elsewhere?`,
    `Which inclusion and exclusion criteria matter most for this ${trial.phase.toLowerCase()} study?`,
  ]

  if (trial.remoteEligible) {
    questions.push("Which visits can be remote, and which still require travel to the study site?")
  } else {
    questions.push("How often would the patient need to travel to the site during screening and treatment?")
  }

  questions.push("Can labs, imaging, or follow-up visits be coordinated closer to home if the patient enrolls?")
  return questions
}
