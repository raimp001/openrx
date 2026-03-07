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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#05090f]/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-soft-blue/30 bg-[#081321] shadow-2xl shadow-soft-blue/20">
        <div className="flex items-start justify-between border-b border-soft-blue/20 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-soft-blue">Human Review Required</p>
            <h3 className="mt-1 text-xl text-white">{request.agentName} needs decision support</h3>
            <p className="mt-1 text-xs text-blue-100/80">Patient Ref: {request.context.patientIdHash.slice(0, 14)}…</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-soft-blue/20 px-2 py-1 text-xs text-blue-100 hover:bg-soft-blue/10"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-soft-blue/20 bg-[#0b1a2b] p-4">
            <div className="flex items-center gap-2 text-xs text-blue-100/80">
              <AlertTriangle size={14} className="text-soft-blue" />
              Workflow: <span className="font-semibold uppercase text-white">{request.context.workflow}</span>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-blue-200/70">Reason</p>
              <p className="mt-1 text-sm text-blue-50">{request.context.reason}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-blue-200/70">Suggested Action</p>
              <p className="mt-1 text-sm text-blue-50">{request.context.suggestedAction}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-soft-blue/20 bg-[#0b1a2b] p-4">
            <label className="text-xs text-blue-100/80">
              Reviewer note
              <textarea
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add approval rationale, rejection notes, or edits..."
                className="mt-1 w-full rounded-lg border border-soft-blue/25 bg-[#07101b] px-3 py-2 text-sm text-blue-50 focus:border-soft-blue focus:outline-none"
              />
            </label>

            <label className="text-xs text-blue-100/80">
              Edit action (only used for Edit)
              <textarea
                rows={3}
                value={editedAction}
                onChange={(event) => setEditedAction(event.target.value)}
                className="mt-1 w-full rounded-lg border border-soft-blue/25 bg-[#07101b] px-3 py-2 text-sm text-blue-50 focus:border-soft-blue focus:outline-none"
              />
            </label>

            <label className="text-xs text-blue-100/80">
              Browser URL override (optional)
              <input
                value={editedBrowserUrl}
                onChange={(event) => setEditedBrowserUrl(event.target.value)}
                placeholder="https://"
                className="mt-1 w-full rounded-lg border border-soft-blue/25 bg-[#07101b] px-3 py-2 text-sm text-blue-50 focus:border-soft-blue focus:outline-none"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-soft-blue/20 px-5 py-4">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleDecision("reject")}
            className="inline-flex items-center gap-2 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
          >
            <XCircle size={13} /> Reject
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleDecision("edit")}
            className="inline-flex items-center gap-2 rounded-lg border border-yellow-400/35 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-200 hover:bg-yellow-500/20 disabled:opacity-50"
          >
            <Edit3 size={13} /> Edit
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleDecision("approve")}
            className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-accent/30 disabled:opacity-50"
          >
            <CheckCircle2 size={13} /> Approve
          </button>
        </div>
      </div>
    </div>
  )
}
