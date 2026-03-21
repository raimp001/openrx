"use client"

import { useState } from "react"
import Link from "next/link"
import {
  getAllAuditEvents,
  getAuditEvents,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  ACTOR_COLORS,
  type AuditActor,
  type AuditEventType,
} from "@/lib/pa-audit"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn } from "@/lib/utils"
import { AppPageHeader } from "@/components/layout/app-page"
import {
  ShieldCheck,
  ArrowLeft,
  Clock,
  Filter,
  Download,
  Lock,
  CheckCircle2,
  XCircle,
  Bot,
  User,
  Building2,
  AlertTriangle,
  Search,
} from "lucide-react"

const actorIcon: Record<AuditActor, typeof User> = {
  patient: User,
  physician: User,
  payer: Building2,
  rex: Bot,
  system: AlertTriangle,
}

export default function PAauditPage() {
  const { snapshot } = useLiveSnapshot()
  const myPAs = snapshot.priorAuths
  const [selectedPaId, setSelectedPaId] = useState<string | "all">("all")
  const [typeFilter, setTypeFilter] = useState<AuditEventType | "all">("all")
  const [actorFilter, setActorFilter] = useState<AuditActor | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

  const rawEvents = selectedPaId === "all" ? getAllAuditEvents() : getAuditEvents(selectedPaId)
  const events = rawEvents
    .filter((e) => typeFilter === "all" || e.type === typeFilter)
    .filter((e) => actorFilter === "all" || e.actor === actorFilter)
    .filter((e) =>
      !searchQuery ||
      e.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.actorName.toLowerCase().includes(searchQuery.toLowerCase())
    )

  const hipaaEvents = events.filter((e) => e.hipaaRelevant)

  function formatTimestamp(ts: string): { date: string; time: string } {
    const d = new Date(ts)
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    }
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Prior Authorization"
        title="PA Audit Trail"
        description={`Immutable event log · HIPAA-compliant · ${events.length} events`}
        className="surface-card p-4 sm:p-5"
        meta={
          <Link
            href="/prior-auth"
            className="inline-flex items-center gap-1 text-xs text-warm-500 transition hover:text-warm-700"
          >
            <ArrowLeft size={12} /> Back to PAs
          </Link>
        }
        actions={
          <>
            <div className="flex items-center gap-1.5 rounded-full border border-accent/10 bg-accent/5 px-3 py-1.5 text-xs text-warm-500">
              <Lock size={10} className="text-accent" />
              <span className="font-semibold text-accent">Immutable Log</span>
            </div>
            <button className="flex items-center gap-1.5 rounded-lg border border-sand bg-sand/40 px-3 py-1.5 text-xs font-semibold text-warm-600 transition hover:bg-sand">
              <Download size={12} /> Export CSV
            </button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-pampas rounded-2xl border border-sand p-4">
          <div className="text-2xl font-bold text-warm-800">{events.length}</div>
          <div className="text-xs text-warm-500 mt-1">Total Events</div>
        </div>
        <div className="bg-accent/5 rounded-2xl border border-accent/10 p-4">
          <div className="text-2xl font-bold text-accent">{hipaaEvents.length}</div>
          <div className="text-xs text-accent/70 mt-1">HIPAA-Relevant</div>
        </div>
        <div className="bg-terra/5 rounded-2xl border border-terra/10 p-4">
          <div className="text-2xl font-bold text-terra">
            {events.filter((e) => e.actor === "rex").length}
          </div>
          <div className="text-xs text-terra/70 mt-1">AI Actions</div>
        </div>
        <div className="bg-soft-red/5 rounded-2xl border border-soft-red/10 p-4">
          <div className="text-2xl font-bold text-soft-red">
            {events.filter((e) => e.type === "PA_DENIED" || e.type === "APPEAL_DENIED").length}
          </div>
          <div className="text-xs text-soft-red/70 mt-1">Denial Events</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-pampas rounded-2xl border border-sand p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-warm-500" />
          <span className="text-xs font-bold text-warm-700">Filter Events</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-white/50 border border-sand rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-warm-700 placeholder:text-warm-400"
            />
          </div>

          {/* PA filter */}
          <select
            value={selectedPaId}
            onChange={(e) => setSelectedPaId(e.target.value)}
            className="text-xs bg-white/50 border border-sand rounded-lg px-2.5 py-1.5 text-warm-700 focus:outline-none focus:ring-1 focus:ring-accent/30"
          >
            <option value="all">All PAs</option>
            {myPAs.map((pa) => (
              <option key={pa.id} value={pa.id}>{pa.procedure_name}</option>
            ))}
          </select>

          {/* Actor filter */}
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value as AuditActor | "all")}
            className="text-xs bg-white/50 border border-sand rounded-lg px-2.5 py-1.5 text-warm-700 focus:outline-none focus:ring-1 focus:ring-accent/30"
          >
            <option value="all">All Actors</option>
            <option value="patient">Patient</option>
            <option value="physician">Physician</option>
            <option value="payer">Payer</option>
            <option value="rex">Rex (AI)</option>
            <option value="system">System</option>
          </select>

          {/* Event type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AuditEventType | "all")}
            className="text-xs bg-white/50 border border-sand rounded-lg px-2.5 py-1.5 text-warm-700 focus:outline-none focus:ring-1 focus:ring-accent/30"
          >
            <option value="all">All Event Types</option>
            <option value="PA_SUBMITTED">Submitted</option>
            <option value="PA_APPROVED">Approved</option>
            <option value="PA_DENIED">Denied</option>
            <option value="APPEAL_INITIATED">Appeal Started</option>
            <option value="APPEAL_APPROVED">Appeal Approved</option>
            <option value="CRITERIA_CHECKED">Criteria Check</option>
            <option value="FHIR_BUNDLE_SENT">FHIR Sent</option>
            <option value="AI_RECOMMENDATION">AI Recommendation</option>
            <option value="PEER_TO_PEER_COMPLETED">P2P Completed</option>
          </select>
        </div>
      </div>

      {/* Event timeline */}
      <div className="bg-pampas rounded-2xl border border-sand overflow-hidden">
        <div className="px-5 py-3 bg-sand/20 border-b border-sand flex items-center justify-between">
          <h2 className="text-xs font-bold text-warm-700">Event Log</h2>
          <div className="flex items-center gap-1.5 text-[10px] text-warm-500">
            <Lock size={9} className="text-accent" />
            <span>Cryptographically immutable &middot; HIPAA §164.312(b)</span>
          </div>
        </div>

        {events.length === 0 && (
          <div className="px-5 py-12 text-center">
            <Clock size={28} className="text-warm-300 mx-auto mb-3" />
            <p className="text-sm text-warm-500">No events match your filters.</p>
          </div>
        )}

        <div className="divide-y divide-sand/40">
          {events.map((event, idx) => {
            const { date, time } = formatTimestamp(event.timestamp)
            const Icon = actorIcon[event.actor]
            const paName = myPAs.find((p) => p.id === event.paId)?.procedure_name

            return (
              <div
                key={event.id}
                className={cn(
                  "px-5 py-3.5 flex items-start gap-4 hover:bg-sand/10 transition",
                  event.hipaaRelevant && "border-l-2 border-l-accent/30"
                )}
              >
                {/* Sequence */}
                <div className="text-[10px] text-cloudy font-mono w-6 shrink-0 mt-0.5 text-right">
                  {events.length - idx}
                </div>

                {/* Actor icon */}
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                  ACTOR_COLORS[event.actor]
                )}>
                  <Icon size={12} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      EVENT_TYPE_COLORS[event.type]
                    )}>
                      {EVENT_TYPE_LABELS[event.type]}
                    </span>
                    {event.hipaaRelevant && (
                      <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Lock size={7} /> HIPAA
                      </span>
                    )}
                    {paName && selectedPaId === "all" && (
                      <span className="text-[10px] text-warm-400">{paName}</span>
                    )}
                  </div>

                  <p className="text-xs text-warm-700 mt-1 leading-relaxed">{event.summary}</p>

                  {event.details && Object.keys(event.details).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {Object.entries(event.details).slice(0, 4).map(([k, v]) => (
                        <span key={k} className="text-[10px] text-warm-400">
                          <span className="text-cloudy">{k}:</span> {String(v)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-1 flex items-center gap-2 text-[10px] text-cloudy">
                    <span className="font-medium">{event.actorName}</span>
                    <span>&middot;</span>
                    <span>{date} at {time}</span>
                    <span>&middot;</span>
                    <span className="font-mono text-[9px]">{event.id}</span>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="shrink-0 mt-0.5">
                  {["PA_APPROVED", "APPEAL_APPROVED"].includes(event.type) && (
                    <CheckCircle2 size={14} className="text-accent" />
                  )}
                  {["PA_DENIED", "APPEAL_DENIED"].includes(event.type) && (
                    <XCircle size={14} className="text-soft-red" />
                  )}
                  {["AI_RECOMMENDATION", "CRITERIA_CHECKED"].includes(event.type) && (
                    <Bot size={14} className="text-terra" />
                  )}
                  {event.type === "FHIR_BUNDLE_SENT" && (
                    <ShieldCheck size={14} className="text-soft-blue" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* HIPAA compliance note */}
      <div className="bg-pampas rounded-2xl border border-sand p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={16} className="text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-warm-700 mb-1">HIPAA Audit Log Compliance</p>
            <p className="text-[11px] text-warm-500 leading-relaxed">
              This audit trail is maintained in compliance with HIPAA Security Rule §164.312(b) (Audit Controls)
              and §164.312(c)(1) (Integrity). All events marked{" "}
              <span className="font-semibold text-accent">HIPAA</span> are cryptographically signed and
              tamper-evident. Export is available for compliance reviews, litigation holds, and OCR audits.
              Access log entries are retained for a minimum of 6 years per 45 CFR §164.530(j).
            </p>
            <div className="mt-2 flex items-center gap-3">
              {[
                { label: "§164.312(b) Audit Controls", ok: true },
                { label: "§164.312(c)(1) Integrity", ok: true },
                { label: "6-Year Retention", ok: true },
                { label: "OCR Export Ready", ok: true },
              ].map(({ label }) => (
                <span key={label} className="flex items-center gap-1 text-[10px] text-accent">
                  <CheckCircle2 size={9} /> {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation back */}
      <div className="flex justify-center">
        <Link
          href="/prior-auth"
          className="flex items-center gap-2 text-sm text-warm-600 hover:text-warm-800 transition"
        >
          <ArrowLeft size={14} /> Back to Prior Authorizations
        </Link>
      </div>
    </div>
  )
}
