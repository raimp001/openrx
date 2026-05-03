"use client"

import { useCallback, useMemo, useState } from "react"
import { ExternalLink, FlaskConical, Loader2, MapPin, Search, ShieldCheck, Sparkles } from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { ChoiceChip, ClinicalField, ClinicalInput, ClinicalSection, FieldsetCard } from "@/components/ui/clinical-forms"
import type { TrialMatch } from "@/lib/basehealth"

const SEARCH_EXAMPLES = [
  { condition: "prostate cancer", location: "Seattle" },
  { condition: "breast cancer", location: "Portland" },
  { condition: "colon cancer", location: "San Francisco" },
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

  const searchSummary = useMemo(() => {
    if (!hasSearched) return "Search by condition, geography, or both."
    if (loading) return "Looking for trials that match the current request."
    if (!matches.length) return "No strong study matches surfaced for this request."
    return `${matches.length} study match${matches.length === 1 ? "" : "es"} surfaced for this request.`
  }, [hasSearched, loading, matches.length])

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Clinical research"
        title="Clinical trial matching"
        description="Search for studies by condition and geography, then keep the eligibility caveats visible. This page is for credible triage, not marketing-style trial discovery."
        meta={
          <>
            <span className="chip">CT.gov-backed search</span>
            <span className="chip">City, state, or ZIP aware</span>
            <span className="chip">Ranked by fit and location</span>
          </>
        }
        actions={
          <AIAction
            agentId="trials"
            label="Trial strategy"
            prompt="Find clinical trial opportunities that match my conditions and explain what to ask before enrolling."
          />
        }
      />

      <ClinicalSection
        kicker="Match request"
        title="Search studies by disease and geography"
        description="Use a real condition name and a place the patient can actually travel to. The system will prefer local sites and explain why a study looks relevant."
        aside={
          <div className="space-y-4">
            <div>
              <div className="section-title">How ranking works</div>
              <p className="mt-2 text-sm leading-6 text-secondary">
                We weight condition fit first, then geography, then practical flags like remote eligibility. Final eligibility still belongs to the study site.
              </p>
            </div>
            <div className="space-y-2">
              <ChoiceChip>
                <ShieldCheck size={12} />
                Trust first
              </ChoiceChip>
              <ChoiceChip>
                <MapPin size={12} />
                Location-sensitive
              </ChoiceChip>
            </div>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <ClinicalField
            label="Condition"
            hint="Use the disease or tumor type you want to search. Examples: prostate cancer, breast cancer, colon cancer."
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
            hint="Use a city, state, or ZIP code. The matcher now prefers true local sites instead of loosely related geographies."
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

        <div className="mt-5 flex flex-wrap gap-2">
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

        {error ? <p className="mt-4 text-sm text-soft-red">{error}</p> : null}
      </ClinicalSection>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="shell-kicker">Search readout</p>
            <h2 className="mt-3 font-serif text-[1.75rem] text-primary">{searchSummary}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
              {hasSearched
                ? "Use the reasons below to decide whether the patient should call the site, ask for an oncology referral, or widen the search to a nearby metro area."
                : "Once you run a search, the study list will appear here with fit reasons and the questions worth asking before enrollment."}
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
