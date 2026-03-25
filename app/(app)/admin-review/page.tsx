import { MailCheck, ShieldCheck } from "lucide-react"
import { AppPageHeader } from "@/components/layout/app-page"

export default function AdminReviewPage() {
  return (
    <div className="animate-slide-up max-w-3xl space-y-6">
      <AppPageHeader
        title="Admin Review"
        description="In-app admin queue is disabled. Application approvals are handled by signed email actions."
      />

      <div className="bg-surface rounded-2xl border border-border p-5">
        <div className="flex items-start gap-3">
          <MailCheck size={18} className="text-teal mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-primary">Email-first workflow is active</p>
            <p className="text-xs text-secondary mt-1 leading-relaxed">
              Each network application now sends an email to configured administrators with signed Approve/Reject links.
              This keeps review operations outside patient-facing product surfaces.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface/60 rounded-2xl border border-border p-4 text-xs text-secondary">
        <ShieldCheck size={13} className="inline mr-1 text-teal" />
        Configure <code>OPENRX_ADMIN_EMAILS</code>, <code>OPENRX_ADMIN_REVIEW_SECRET</code>, <code>RESEND_API_KEY</code>, and <code>OPENRX_EMAIL_FROM</code> for production.
      </div>
    </div>
  )
}
