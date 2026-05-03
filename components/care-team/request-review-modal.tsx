"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Edit3, XCircle } from "lucide-react"
import type { CareTeamHumanInputRequest, CareTeamResolveInput } from "@/lib/care-team/types"

interface RequestReviewModalProps {
  open: boolean
  request: CareTeamHumanInputRequest | null
  submitting?: boolean
  onClose: () => void
  onSubmit: (payload: CareTeamResolveInput) => Promise<void>
}

export default function RequestReviewModal({
  open,
  request,
  submitting = false,
  onClose,
  onSubmit,
}: RequestReviewModalProps) {
  const [note, setNote] = useState("")
  const [editedAction, setEditedAction] = useState("")
  const [editedBrowserUrl, setEditedBrowserUrl] = useState("")

  useEffect(() => {
    if (!open || !request) return
    setNote("")
    setEditedAction(request.context.suggestedAction)
    setEditedBrowserUrl(request.context.browser?.url || "")
  }, [open, request])

  if (!open || !request) return null

  async function handleDecision(decision: CareTeamResolveInput["decision"]) {
    if (!request) return

    const payload: CareTeamResolveInput = {
      requestId: request.id,
      decision,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(decision === "edit" && editedAction.trim() ? { editedSuggestedAction: editedAction.trim() } : {}),
      ...(decision === "edit" && editedBrowserUrl.trim() ? { browserUrl: editedBrowserUrl.trim() } : {}),
    }
    await onSubmit(payload)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-primary/24 backdrop-blur-sm px-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-[30px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96))] shadow-[0_28px_60px_rgba(8,24,46,0.16)]">
        <div className="flex items-start justify-between border-b border-border/70 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Human Review Required</p>
            <h3 className="mt-1 text-xl text-primary">{request.agentName} needs decision support</h3>
            <p className="mt-1 text-xs text-muted">Patient Ref: {request.context.patientIdHash.slice(0, 14)}…</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/80 bg-white/70 px-3 py-1.5 text-xs font-semibold text-primary hover:border-accent/30 hover:text-primary"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-[24px] border border-border/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(239,246,255,0.9))] p-4">
            <div className="flex items-center gap-2 text-xs text-secondary">
              <AlertTriangle size={14} className="text-accent" />
              Workflow: <span className="font-semibold uppercase text-primary">{request.context.workflow}</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Reason</p>
              <p className="mt-1 text-sm text-primary">{request.context.reason}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Suggested Action</p>
              <p className="mt-1 text-sm text-primary">{request.context.suggestedAction}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-[24px] border border-border/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(239,246,255,0.9))] p-4">
            <label className="text-xs font-semibold text-secondary">
              Reviewer note
              <textarea
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add approval rationale, rejection notes, or edits..."
                className="mt-1 w-full rounded-2xl border border-border/80 bg-white/88 px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-accent/35 focus:outline-none"
              />
            </label>

            <label className="text-xs font-semibold text-secondary">
              Edit action (only used for Edit)
              <textarea
                rows={3}
                value={editedAction}
                onChange={(event) => setEditedAction(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-border/80 bg-white/88 px-3 py-2 text-sm text-primary focus:border-accent/35 focus:outline-none"
              />
            </label>

            <label className="text-xs font-semibold text-secondary">
              Browser URL override (optional)
              <input
                value={editedBrowserUrl}
                onChange={(event) => setEditedBrowserUrl(event.target.value)}
                placeholder="https://"
                className="mt-1 w-full rounded-2xl border border-border/80 bg-white/88 px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-accent/35 focus:outline-none"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-5 py-4">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleDecision("reject")}
            className="inline-flex items-center gap-2 rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <XCircle size={13} /> Reject
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleDecision("edit")}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            <Edit3 size={13} /> Edit
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleDecision("approve")}
            className="inline-flex items-center gap-2 rounded-xl border border-accent/35 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/15 disabled:opacity-50"
          >
            <CheckCircle2 size={13} /> Approve
          </button>
        </div>
      </div>
    </div>
  )
}
