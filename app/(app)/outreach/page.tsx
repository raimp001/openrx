"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  PhoneCall,
  PhoneOff,
  ShieldCheck,
  Sparkles,
  UserSquare2,
  ListChecks,
  Loader2,
  History,
  Voicemail,
} from "lucide-react"
import { ClinicianCommandBar } from "@/components/clinician-command-bar"
import { cn } from "@/lib/utils"
import type {
  CallNextStep,
  CallOutcome,
  CallProviderCapabilities,
  CallSession,
  MaskedCallerId,
} from "@/lib/clinician-calls/types"

interface CallsApiResponse {
  provider: string
  capabilities: CallProviderCapabilities
  recent: CallSession[]
}

interface StartResponse {
  session: CallSession
  liveCallingEnabled: boolean
  demoMode: boolean
  error?: string
}

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  reached_patient: "Reached patient",
  left_voicemail: "Left voicemail",
  no_answer: "No answer",
  wrong_number: "Wrong number",
  needs_callback: "Needs callback",
  patient_declined: "Patient declined",
  abandoned: "Abandoned",
}

const NEXT_STEP_LABEL: Record<CallNextStep, { label: string; description: string }> = {
  schedule_appointment: { label: "Schedule appointment", description: "Hand off to scheduling" },
  order_screening_study: { label: "Order screening study", description: "Send to screening workflow" },
  send_instructions: { label: "Send patient instructions", description: "Compose secure message" },
  route_to_care_team: { label: "Route to care team", description: "Open Care Team Command Center" },
  create_reminder: { label: "Create follow-up reminder", description: "Track in tasks" },
  refer_specialist: { label: "Refer to specialist", description: "Open referral builder" },
  no_action: { label: "No further action", description: "Document and close" },
}

const NEXT_STEP_HREF: Record<CallNextStep, string | null> = {
  schedule_appointment: "/scheduling?handoff=outreach",
  order_screening_study: "/screening?handoff=outreach&autorun=0",
  send_instructions: "/messages",
  route_to_care_team: "/dashboard/care-team",
  create_reminder: null,
  refer_specialist: "/referrals",
  no_action: null,
}

function statusTone(status: CallSession["status"]) {
  switch (status) {
    case "ringing":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "in_progress":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "completed":
      return "border-slate-200 bg-slate-50 text-slate-700"
    case "failed":
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700"
    default:
      return "border-slate-200 bg-slate-50 text-slate-700"
  }
}

function relativeTime(ts: number) {
  const delta = Math.max(0, Date.now() - ts)
  const min = Math.round(delta / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  return `${day}d ago`
}

export default function OutreachPage() {
  const [capabilities, setCapabilities] = useState<CallProviderCapabilities | null>(null)
  const [recent, setRecent] = useState<CallSession[]>([])
  const [loadingCaps, setLoadingCaps] = useState(true)

  // Call form state
  const [patientRef, setPatientRef] = useState("")
  const [patientDisplayName, setPatientDisplayName] = useState("")
  const [patientPhone, setPatientPhone] = useState("")
  const [callerIdLabel, setCallerIdLabel] = useState<string>("")
  const [reason, setReason] = useState("")
  const [recordCall, setRecordCall] = useState(false)
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Active call state
  const [activeSession, setActiveSession] = useState<CallSession | null>(null)
  const [demoMode, setDemoMode] = useState(false)

  // Documentation state
  const [outcome, setOutcome] = useState<CallOutcome | "">("")
  const [notes, setNotes] = useState("")
  const [nextSteps, setNextSteps] = useState<CallNextStep[]>([])
  const [docError, setDocError] = useState<string | null>(null)
  const [docSaving, setDocSaving] = useState(false)
  const [docSavedAt, setDocSavedAt] = useState<number | null>(null)

  const refreshCapabilities = useCallback(async () => {
    try {
      const res = await fetch("/api/clinician-calls", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load call provider status")
      const data = (await res.json()) as CallsApiResponse
      setCapabilities(data.capabilities)
      setRecent(data.recent)
      if (!callerIdLabel && data.capabilities.callerIds[0]) {
        setCallerIdLabel(data.capabilities.callerIds[0].label)
      }
    } catch {
      setCapabilities({
        liveCallingEnabled: false,
        setupMessage: "Telephony provider unavailable.",
        callerIds: [],
      })
    } finally {
      setLoadingCaps(false)
    }
  }, [callerIdLabel])

  useEffect(() => {
    void refreshCapabilities()
  }, [refreshCapabilities])

  const startCall = useCallback(async () => {
    setFormError(null)
    if (!consent) {
      setFormError("Confirm patient consent before placing the call.")
      return
    }
    if (!patientRef.trim()) {
      setFormError("Patient reference is required (e.g. MRN or internal ID).")
      return
    }
    if (!patientPhone.trim()) {
      setFormError("Patient phone number is required.")
      return
    }
    if (!reason.trim()) {
      setFormError("Add a brief reason for the call.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/clinician-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientRef: patientRef.trim(),
          patientDisplayName: patientDisplayName.trim() || undefined,
          patientPhone: patientPhone.trim(),
          callerIdLabel,
          reason: reason.trim(),
          consentAttested: true,
          recordCall,
        }),
      })
      const data = (await res.json()) as StartResponse
      if (!res.ok) {
        setFormError(data.error || "Failed to start call.")
        return
      }
      setActiveSession(data.session)
      setDemoMode(data.demoMode)
      setOutcome("")
      setNotes("")
      setNextSteps([])
      setDocSavedAt(null)
      void refreshCapabilities()
    } catch {
      setFormError("Network error — please try again.")
    } finally {
      setSubmitting(false)
    }
  }, [consent, patientRef, patientPhone, patientDisplayName, callerIdLabel, reason, recordCall, refreshCapabilities])

  const endCall = useCallback(async () => {
    if (!activeSession) return
    try {
      const res = await fetch(`/api/clinician-calls/${activeSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      })
      const data = await res.json()
      if (res.ok) {
        setActiveSession(data.session)
      }
    } catch {
      // Non-fatal — UI keeps the session in its current state.
    }
  }, [activeSession])

  const documentCall = useCallback(async () => {
    if (!activeSession) return
    if (!outcome) {
      setDocError("Pick a call outcome.")
      return
    }
    setDocSaving(true)
    setDocError(null)
    try {
      const res = await fetch(`/api/clinician-calls/${activeSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "document",
          outcome,
          notes: notes.trim() || undefined,
          nextSteps,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDocError(data.error || "Failed to save call documentation.")
        return
      }
      setActiveSession(data.session)
      setDocSavedAt(Date.now())
      void refreshCapabilities()
    } catch {
      setDocError("Network error — please try again.")
    } finally {
      setDocSaving(false)
    }
  }, [activeSession, outcome, notes, nextSteps, refreshCapabilities])

  const resetForNextCall = useCallback(() => {
    setActiveSession(null)
    setReason("")
    setPatientPhone("")
    setPatientRef("")
    setPatientDisplayName("")
    setConsent(false)
    setRecordCall(false)
    setOutcome("")
    setNotes("")
    setNextSteps([])
    setDocSavedAt(null)
    setFormError(null)
    setDocError(null)
  }, [])

  const callerIds = useMemo(() => capabilities?.callerIds ?? [], [capabilities])
  const liveEnabled = Boolean(capabilities?.liveCallingEnabled)
  const setupMessage = capabilities?.setupMessage ?? ""

  const selectedCaller = useMemo<MaskedCallerId | undefined>(
    () => callerIds.find((c) => c.label === callerIdLabel) || callerIds[0],
    [callerIds, callerIdLabel]
  )

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Clinician outreach</p>
          <h1 className="text-[22px] font-semibold tracking-tight text-primary">Patient calls &amp; follow-through</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-secondary">
            Place private patient calls from a masked OpenRx number, capture the outcome, and route the next step into screening, scheduling, or the care team.
          </p>
        </div>
        <span
          data-testid="outreach-live-state"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
            liveEnabled
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", liveEnabled ? "bg-emerald-500" : "bg-amber-500")} />
          {liveEnabled ? "Live calling enabled" : "Demo mode — live calls disabled"}
        </span>
      </header>

      <ClinicianCommandBar />

      {!liveEnabled && setupMessage ? (
        <div
          data-testid="outreach-setup-banner"
          className="surface-card flex items-start gap-3 border-amber-200 bg-amber-50/60 px-4 py-3 text-[13px] text-amber-900"
        >
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">Setup required for production calling</p>
            <p>{setupMessage}</p>
            <p className="text-[12px] text-amber-800">
              In demo mode you can still rehearse the workflow — sessions are mocked, no telephony number is dialed, and patient phone numbers are never stored beyond the last four digits.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="surface-card space-y-5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-primary">New patient call</h2>
            {activeSession ? (
              <button
                type="button"
                onClick={resetForNextCall}
                className="control-button-secondary px-3 py-1.5 text-xs"
                data-testid="outreach-new-call"
              >
                <Sparkles size={12} />
                New call
              </button>
            ) : null}
          </div>

          {!activeSession ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                void startCall()
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-[12px] font-medium text-secondary">
                  Patient reference (MRN / ID)
                  <input
                    data-testid="outreach-patient-ref"
                    value={patientRef}
                    onChange={(event) => setPatientRef(event.target.value)}
                    placeholder="e.g. MRN-90412"
                    className="block w-full rounded-[10px] border border-border bg-white px-3 py-2 text-[14px] text-primary outline-none transition focus:border-teal/60 focus:shadow-focus"
                  />
                </label>
                <label className="space-y-1.5 text-[12px] font-medium text-secondary">
                  Patient name (optional, for clinician display only)
                  <input
                    data-testid="outreach-patient-name"
                    value={patientDisplayName}
                    onChange={(event) => setPatientDisplayName(event.target.value)}
                    placeholder="e.g. J. Doe"
                    className="block w-full rounded-[10px] border border-border bg-white px-3 py-2 text-[14px] text-primary outline-none transition focus:border-teal/60 focus:shadow-focus"
                  />
                </label>
              </div>

              <label className="space-y-1.5 text-[12px] font-medium text-secondary">
                Patient phone (E.164, e.g. +15551234567)
                <input
                  data-testid="outreach-patient-phone"
                  value={patientPhone}
                  onChange={(event) => setPatientPhone(event.target.value)}
                  placeholder="+15551234567"
                  inputMode="tel"
                  className="block w-full rounded-[10px] border border-border bg-white px-3 py-2 font-mono text-[14px] text-primary outline-none transition focus:border-teal/60 focus:shadow-focus"
                />
                <span className="text-[11px] text-muted">
                  OpenRx stores only the last four digits after the call is placed. Your personal number is never sent to the patient.
                </span>
              </label>

              <label className="space-y-1.5 text-[12px] font-medium text-secondary">
                OpenRx caller ID (what the patient sees)
                <select
                  data-testid="outreach-caller-id"
                  value={callerIdLabel}
                  onChange={(event) => setCallerIdLabel(event.target.value)}
                  className="block w-full rounded-[10px] border border-border bg-white px-3 py-2 text-[14px] text-primary outline-none transition focus:border-teal/60 focus:shadow-focus"
                >
                  {callerIds.length === 0 ? <option value="">No caller IDs configured</option> : null}
                  {callerIds.map((c) => (
                    <option key={c.label} value={c.label}>
                      {c.label} — {c.maskedNumber}
                    </option>
                  ))}
                </select>
                {selectedCaller ? (
                  <span data-testid="outreach-caller-id-preview" className="text-[11px] text-muted">
                    Patient will see: <span className="font-mono">{selectedCaller.maskedNumber}</span>
                  </span>
                ) : null}
              </label>

              <label className="space-y-1.5 text-[12px] font-medium text-secondary">
                Reason for call
                <textarea
                  data-testid="outreach-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. Follow up on screening colonoscopy referral"
                  rows={2}
                  maxLength={240}
                  className="block w-full resize-none rounded-[10px] border border-border bg-white px-3 py-2 text-[14px] text-primary outline-none transition focus:border-teal/60 focus:shadow-focus"
                />
              </label>

              <div className="space-y-2 rounded-[10px] border border-border bg-surface-2 px-3 py-3 text-[12px] text-secondary">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    data-testid="outreach-consent"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I have verified that the patient has given consent to be contacted at this number for clinical purposes. If they describe an emergency or red-flag symptoms, I will direct them to call 911 or go to the nearest emergency department.
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    data-testid="outreach-record"
                    checked={recordCall}
                    onChange={(event) => setRecordCall(event.target.checked)}
                    className="mt-0.5"
                    disabled={!liveEnabled}
                  />
                  <span>
                    Record this call (requires two-party consent in some states; only available when live calling is configured).
                  </span>
                </label>
              </div>

              {formError ? (
                <p data-testid="outreach-form-error" role="alert" className="flex items-center gap-2 text-[12px] text-danger">
                  <AlertTriangle size={12} />
                  {formError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="submit"
                  data-testid="outreach-start-call"
                  disabled={submitting || loadingCaps}
                  className="control-button-accent px-4 py-2 text-sm"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} />}
                  {liveEnabled ? "Place call" : "Place call (demo)"}
                </button>
              </div>
            </form>
          ) : (
            <ActiveCallPanel
              session={activeSession}
              demoMode={demoMode}
              onEnd={endCall}
              outcome={outcome}
              setOutcome={setOutcome}
              notes={notes}
              setNotes={setNotes}
              nextSteps={nextSteps}
              setNextSteps={setNextSteps}
              docError={docError}
              docSaving={docSaving}
              docSavedAt={docSavedAt}
              onDocument={documentCall}
            />
          )}
        </section>

        <aside className="space-y-4">
          <section className="surface-card p-5" data-testid="outreach-safety">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
              <ShieldCheck size={12} />
              Safety &amp; privacy
            </div>
            <ul className="mt-3 space-y-2 text-[12px] text-secondary">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-600" />
                Your personal number is never sent to the patient — calls go through an OpenRx-controlled masked number.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-600" />
                Only the last four digits of the patient phone are persisted to the call session.
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-600" />
                Urgent symptoms (chest pain, stroke signs, severe bleeding, suicidal ideation) require emergency care — direct the patient to 911.
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-600" />
                Documented calls may be part of the clinical record per your organization&apos;s policy.
              </li>
            </ul>
          </section>

          <section className="surface-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
                <History size={12} />
                Recent calls
              </div>
              <span className="text-[11px] text-muted">last 20</span>
            </div>
            {recent.length === 0 ? (
              <p className="mt-3 text-[12px] text-muted">No calls yet — start one on the left to see it here.</p>
            ) : (
              <ul className="mt-3 space-y-2" data-testid="outreach-recent-calls">
                {recent.map((call) => (
                  <li
                    key={call.id}
                    className="rounded-[10px] border border-border bg-white px-3 py-2 text-[12px]"
                    data-testid="outreach-recent-call"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-primary">
                        {call.patientDisplayName || call.patientRef}
                      </span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", statusTone(call.status))}>
                        {call.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-muted">
                      <span className="font-mono">{call.patientPhoneMasked}</span>
                      <span>{relativeTime(call.createdAt)}</span>
                    </div>
                    {call.outcome ? (
                      <div className="mt-1 flex items-center gap-1.5 text-secondary">
                        <Voicemail size={11} />
                        {OUTCOME_LABEL[call.outcome]}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

interface ActiveCallPanelProps {
  session: CallSession
  demoMode: boolean
  onEnd: () => void
  outcome: CallOutcome | ""
  setOutcome: (value: CallOutcome | "") => void
  notes: string
  setNotes: (value: string) => void
  nextSteps: CallNextStep[]
  setNextSteps: (value: CallNextStep[]) => void
  docError: string | null
  docSaving: boolean
  docSavedAt: number | null
  onDocument: () => void
}

function ActiveCallPanel({
  session,
  demoMode,
  onEnd,
  outcome,
  setOutcome,
  notes,
  setNotes,
  nextSteps,
  setNextSteps,
  docError,
  docSaving,
  docSavedAt,
  onDocument,
}: ActiveCallPanelProps) {
  const toggleStep = (step: CallNextStep) => {
    setNextSteps(
      nextSteps.includes(step) ? nextSteps.filter((s) => s !== step) : [...nextSteps, step]
    )
  }

  const inProgress = session.status === "ringing" || session.status === "in_progress"

  return (
    <div className="space-y-4" data-testid="outreach-active-session">
      <div className={cn("rounded-[12px] border px-4 py-3", statusTone(session.status))}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <PhoneCall size={14} />
            {session.status === "ringing" && "Ringing patient"}
            {session.status === "in_progress" && "Call in progress"}
            {session.status === "completed" && "Call ended"}
            {session.status === "failed" && "Call failed"}
            {session.status === "cancelled" && "Call cancelled"}
            {demoMode ? <span className="ml-2 rounded-full border border-current px-2 py-0.5 text-[10px] uppercase">demo</span> : null}
          </div>
          {inProgress ? (
            <button
              type="button"
              onClick={onEnd}
              data-testid="outreach-end-call"
              className="inline-flex items-center gap-1.5 rounded-full border border-current bg-white/60 px-2.5 py-1 text-[11px] font-medium hover:bg-white"
            >
              <PhoneOff size={12} />
              End call
            </button>
          ) : null}
        </div>
        <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
          <div>
            <dt className="text-muted">Patient</dt>
            <dd className="font-medium text-primary">{session.patientDisplayName || session.patientRef}</dd>
          </div>
          <div>
            <dt className="text-muted">Phone (masked)</dt>
            <dd className="font-mono text-primary">{session.patientPhoneMasked}</dd>
          </div>
          <div>
            <dt className="text-muted">OpenRx caller ID</dt>
            <dd className="font-mono text-primary">{session.callerId.maskedNumber}</dd>
          </div>
          <div>
            <dt className="text-muted">Started</dt>
            <dd className="text-primary">
              {session.startedAt ? <Clock3 size={11} className="mr-1 inline align-text-top" /> : null}
              {session.startedAt ? relativeTime(session.startedAt) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3 rounded-[12px] border border-border bg-white px-4 py-3">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-primary">
          <UserSquare2 size={14} />
          Document this call
        </h3>

        <div className="grid gap-3">
          <label className="space-y-1.5 text-[12px] font-medium text-secondary">
            Outcome
            <select
              data-testid="outreach-outcome"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as CallOutcome | "")}
              className="block w-full rounded-[10px] border border-border bg-white px-3 py-2 text-[14px] text-primary outline-none focus:border-teal/60 focus:shadow-focus"
            >
              <option value="">Select an outcome…</option>
              {(Object.keys(OUTCOME_LABEL) as CallOutcome[]).map((key) => (
                <option key={key} value={key}>
                  {OUTCOME_LABEL[key]}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-[12px] font-medium text-secondary">
            Notes (no PHI beyond what is clinically necessary)
            <textarea
              data-testid="outreach-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Brief note on what was discussed and any follow-up agreed."
              className="block w-full resize-none rounded-[10px] border border-border bg-white px-3 py-2 text-[14px] text-primary outline-none focus:border-teal/60 focus:shadow-focus"
            />
          </label>
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
            <ListChecks size={12} />
            Next steps
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(NEXT_STEP_LABEL) as CallNextStep[]).map((step) => {
              const meta = NEXT_STEP_LABEL[step]
              const active = nextSteps.includes(step)
              return (
                <label
                  key={step}
                  data-testid={`outreach-next-step-${step}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-[10px] border px-3 py-2 text-[12px] transition",
                    active
                      ? "border-teal-dark/60 bg-teal/5 text-primary"
                      : "border-border bg-white text-secondary hover:border-border-strong"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleStep(step)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium text-primary">{meta.label}</span>
                    <span className="block text-muted">{meta.description}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {docError ? (
          <p role="alert" data-testid="outreach-doc-error" className="flex items-center gap-2 text-[12px] text-danger">
            <AlertTriangle size={12} />
            {docError}
          </p>
        ) : null}

        {docSavedAt ? (
          <p data-testid="outreach-doc-saved" className="flex items-center gap-2 text-[12px] text-success">
            <CheckCircle2 size={12} />
            Saved {relativeTime(docSavedAt)}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-muted">
            Documentation is stored against the call session, not the patient&apos;s phone number.
          </p>
          <button
            type="button"
            data-testid="outreach-save-doc"
            onClick={onDocument}
            disabled={docSaving}
            className="control-button-accent px-3.5 py-2 text-xs"
          >
            {docSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Save documentation
          </button>
        </div>

        {nextSteps.length > 0 && session.outcome ? (
          <div className="rounded-[10px] border border-border bg-surface-2 px-3 py-3" data-testid="outreach-followthrough">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Follow through</p>
            <ul className="mt-2 space-y-1.5 text-[12px]">
              {nextSteps.map((step) => {
                const href = NEXT_STEP_HREF[step]
                const meta = NEXT_STEP_LABEL[step]
                return (
                  <li key={step} className="flex items-center justify-between gap-2">
                    <span className="text-primary">{meta.label}</span>
                    {href ? (
                      <a
                        href={href}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-secondary hover:border-border-strong hover:text-primary"
                        data-testid={`outreach-followthrough-link-${step}`}
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted">tracked locally</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
