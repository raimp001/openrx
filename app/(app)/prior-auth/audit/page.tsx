"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  getAllAuditEvents,
  getAuditEvents,
  EVENT_TYPE_LABELS,
  type AuditActor,
  type AuditEvent,
  type AuditEventType,
} from "@/lib/pa-audit"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn } from "@/lib/utils"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsEmptyState, OpsMetricCard } from "@/components/ui/ops-primitives"
import {
  ArrowLeft,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Lock,
  Search,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react"

const actorIcon: Record<AuditActor, typeof User> = {
  patient: User,
  physician: User,
  payer: Building2,
  rex: Bot,
  system: ShieldCheck,
}

const actorLabels: Record<AuditActor, string> = {
  patient: "Patient",
  physician: "Physician",
  payer: "Payer",
  rex: "AI",
  system: "System",
}

const eventTypeOptions: Array<{ value: AuditEventType; label: string }> = [
  { value: "PA_SUBMITTED", label: "Submitted" },
  { value: "PA_APPROVED", label: "Approved" },
  { value: "PA_DENIED", label: "Denied" },
  { value: "APPEAL_INITIATED", label: "Appeal started" },
  { value: "APPEAL_APPROVED", label: "Appeal approved" },
  { value: "CRITERIA_CHECKED", label: "Criteria check" },
  { value: "FHIR_BUNDLE_SENT", label: "FHIR sent" },
  { value: "AI_RECOMMENDATION", label: "AI recommendation" },
  { value: "PEER_TO_PEER_COMPLETED", label: "Peer-to-peer completed" },
]

function formatTimestamp(ts: string): { date: string; time: string } {
  const d = new Date(ts)
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  }
}

function eventTone(type: AuditEventType) {
  if (type.includes("DENIED")) return "border-soft-red/16 bg-soft-red/7 text-soft-red"
  if (type.includes("APPROVED")) return "border-accent/16 bg-accent/8 text-accent"
  if (type.includes("APPEAL")) return "border-coral/16 bg-coral/8 text-coral"
  if (type.includes("AI") || type.includes("CRITERIA")) return "border-teal/16 bg-teal/8 text-teal"
  return "border-border/70 bg-white/72 text-secondary"
}

function eventOutcomeIcon(event: AuditEvent) {
  if (["PA_APPROVED", "APPEAL_APPROVED"].includes(event.type)) return CheckCircle2
  if (["PA_DENIED", "APPEAL_DENIED"].includes(event.type)) return XCircle
  if (["AI_RECOMMENDATION", "CRITERIA_CHECKED"].includes(event.type)) return Bot
  return ShieldCheck
}

export default function PAAuditPage() {
  const { snapshot } = useLiveSnapshot()
  const myPAs = snapshot.priorAuths
  const [selectedPaId, setSelectedPaId] = useState<string | "all">("all")
  const [typeFilter, setTypeFilter] = useState<AuditEventType | "all">("all")
  const [actorFilter, setActorFilter] = useState<AuditActor | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

  const rawEvents = selectedPaId === "all" ? getAllAuditEvents() : getAuditEvents(selectedPaId)
  const events = rawEvents
    .filter((event) => typeFilter === "all" || event.type === typeFilter)
    .filter((event) => actorFilter === "all" || event.actor === actorFilter)
    .filter((event) => {
      const query = searchQuery.trim().toLowerCase()
      if (!query) return true
      return (
        event.summary.toLowerCase().includes(query) ||
        event.actorName.toLowerCase().includes(query) ||
        event.id.toLowerCase().includes(query)
      )
    })

  const hipaaEvents = events.filter((event) => event.hipaaRelevant)
  const aiEvents = events.filter((event) => event.actor === "rex")
  const denialEvents = events.filter((event) => event.type === "PA_DENIED" || event.type === "APPEAL_DENIED")
  const latestEvent = useMemo(() => events[0], [events])
  const latestPaName = latestEvent ? myPAs.find((pa) => pa.id === latestEvent.paId)?.procedure_name : null

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Prior authorization audit"
        title="A clean chain of custody for every PA decision."
        description="Track who acted, what changed, and which events matter for compliance review without exposing patients to raw system logs."
        meta={
          <>
            <OpsBadge tone="accent">tamper-evident posture</OpsBadge>
            <OpsBadge tone="blue">filterable event history</OpsBadge>
            <OpsBadge tone="terra">{events.length} visible events</OpsBadge>
          </>
        }
        actions={
          <>
            <Link href="/prior-auth" className="control-button-secondary px-4 py-2.5">
              <ArrowLeft size={14} />
              Back to PA deck
            </Link>
            <button className="control-button-primary px-4 py-2.5">
              <Download size={14} />
              Export CSV
            </button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <OpsMetricCard
          label="Visible events"
          value={String(events.length)}
          detail="Filtered entries currently included in the review view."
          icon={Clock}
          tone="terra"
        />
        <OpsMetricCard
          label="Compliance relevant"
          value={String(hipaaEvents.length)}
          detail="Events flagged for audit review and chain-of-custody posture."
          icon={Lock}
          tone="accent"
        />
        <OpsMetricCard
          label="AI actions"
          value={String(aiEvents.length)}
          detail="Assistant-driven criteria checks, recommendations, and appeal support."
          icon={Bot}
          tone="blue"
        />
        <OpsMetricCard
          label="Denial events"
          value={String(denialEvents.length)}
          detail="Payer denials or appeal denials that require review."
          icon={XCircle}
          tone="red"
        />
      </div>

      <section className="overflow-hidden rounded-[30px] border border-[rgba(82,108,139,0.12)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_58%,#173B83_100%)] text-white shadow-[0_24px_70px_rgba(8,24,46,0.17)]">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="px-6 py-6 sm:px-7">
            <div className="section-title text-white/55">Audit posture</div>
            <h2 className="mt-3 text-[clamp(1.7rem,3vw,2.7rem)] font-semibold tracking-[-0.05em]">
              The audit trail should answer the hard question first: what needs review now?
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72">
              This view is designed for a payer dispute, compliance review, or internal review. It keeps sequence,
              actor, event type, and supporting details visible without making reviewers parse a raw log export.
            </p>
          </div>
          <div className="border-t border-white/10 bg-white/[0.04] px-6 py-6 lg:border-l lg:border-t-0">
            <div className="section-title text-white/55">Latest signal</div>
            {latestEvent ? (
              <div className="mt-4 rounded-[24px] border border-white/10 bg-black/12 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", eventTone(latestEvent.type))}>
                    {EVENT_TYPE_LABELS[latestEvent.type]}
                  </span>
                  <span className="font-mono text-[10px] text-white/42">{latestEvent.id}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/84">{latestEvent.summary}</p>
                <p className="mt-3 text-xs text-white/48">
                  {latestPaName ?? "Prior authorization"} · {latestEvent.actorName}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-white/68">No matching audit events are visible with the current filters.</p>
            )}
          </div>
        </div>
      </section>

      <section className="surface-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-teal" />
              <div className="section-title">Filter the evidence trail</div>
            </div>
            <p className="mt-2 text-sm leading-6 text-secondary">
              Narrow by case, actor, event type, or a specific phrase in the event summary.
            </p>
          </div>
          <div className="text-xs text-muted">Showing {events.length} of {rawEvents.length} events</div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.8fr_0.9fr]">
          <label className="control-label">
            Search events
            <span className="relative block">
              <Search size={14} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Denial, appeal, actor, event id..."
                className="control-input pl-10"
              />
            </span>
          </label>

          <label className="control-label">
            PA case
            <select
              value={selectedPaId}
              onChange={(event) => setSelectedPaId(event.target.value)}
              className="control-select"
            >
              <option value="all">All prior authorizations</option>
              {myPAs.map((pa) => (
                <option key={pa.id} value={pa.id}>{pa.procedure_name}</option>
              ))}
            </select>
          </label>

          <label className="control-label">
            Actor
            <select
              value={actorFilter}
              onChange={(event) => setActorFilter(event.target.value as AuditActor | "all")}
              className="control-select"
            >
              <option value="all">All actors</option>
              {Object.entries(actorLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="control-label">
            Event type
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as AuditEventType | "all")}
              className="control-select"
            >
              <option value="all">All event types</option>
              {eventTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(82,108,139,0.12)] px-5 py-4">
          <div>
            <div className="section-title">Event log</div>
            <h2 className="mt-1 text-xl font-semibold text-primary">Chronological evidence trail</h2>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-accent/15 bg-accent/8 px-3 py-1.5 text-[11px] font-semibold text-accent">
            <Lock size={11} />
            HIPAA audit-control posture
          </div>
        </div>

        {events.length === 0 ? (
          <OpsEmptyState
            icon={Clock}
            title="No events match these filters"
            description="Clear the search or broaden the actor/event filters to restore the audit sequence."
            className="m-5"
          />
        ) : (
          <div className="divide-y divide-[rgba(82,108,139,0.11)]">
            {events.map((event, index) => {
              const { date, time } = formatTimestamp(event.timestamp)
              const ActorIcon = actorIcon[event.actor]
              const StatusIcon = eventOutcomeIcon(event)
              const paName = myPAs.find((pa) => pa.id === event.paId)?.procedure_name

              return (
                <article
                  key={event.id}
                  className={cn(
                    "grid gap-4 px-5 py-5 transition hover:bg-[rgba(255,255,255,0.46)] md:grid-cols-[4rem_1fr_auto]",
                    event.hipaaRelevant && "bg-accent/[0.025]"
                  )}
                >
                  <div className="flex items-start gap-3 md:block">
                    <div className="font-mono text-[11px] text-muted md:text-right">
                      #{String(events.length - index).padStart(2, "0")}
                    </div>
                    <div className="mt-0 flex h-10 w-10 items-center justify-center rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-white/82 text-teal shadow-sm md:ml-auto md:mt-3">
                      <ActorIcon size={17} strokeWidth={1.6} />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", eventTone(event.type))}>
                        {EVENT_TYPE_LABELS[event.type]}
                      </span>
                      {event.hipaaRelevant ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-accent/16 bg-accent/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                          <Lock size={9} />
                          HIPAA
                        </span>
                      ) : null}
                      {paName && selectedPaId === "all" ? (
                        <span className="text-[11px] font-medium text-muted">{paName}</span>
                      ) : null}
                    </div>

                    <p className="mt-3 text-sm leading-7 text-primary">{event.summary}</p>

                    {event.details && Object.keys(event.details).length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(event.details).slice(0, 4).map(([key, value]) => (
                          <span key={key} className="rounded-full border border-[rgba(82,108,139,0.12)] bg-white/72 px-2.5 py-1 text-[11px] text-secondary">
                            <span className="font-semibold text-primary">{key}</span>: {String(value)}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <span className="font-semibold text-secondary">{event.actorName}</span>
                      <span>·</span>
                      <span>{date} at {time}</span>
                      <span>·</span>
                      <span className="font-mono">{event.id}</span>
                    </div>
                  </div>

                  <div className="hidden h-10 w-10 items-center justify-center rounded-full border border-[rgba(82,108,139,0.12)] bg-white/72 text-muted md:flex">
                    <StatusIcon size={17} strokeWidth={1.6} />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="surface-card p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <div className="section-title">Compliance note</div>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-secondary">
              OpenRx presents this as an audit-control view for review. Events marked HIPAA are treated as
              compliance-relevant, actor-attributed records. Production retention, export, and legal handling should
              still follow the organization&apos;s compliance policy and counsel-approved process.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Audit controls", "Integrity posture", "Reviewer export", "Retention policy"].map((label) => (
                <span key={label} className="chip">
                  <CheckCircle2 size={12} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
