import { MailCheck, ShieldCheck } from "lucide-react"
import { AppPageHeader } from "@/components/layout/app-page"

export default function AdminReviewPage() {
  return (
    <div className="animate-slide-up max-w-3xl space-y-6">
      <AppPageHeader
        title="Admin Review"
        description="In-app admin queue is disabled. Application approvals are handled by signed email actions."
      />

      <div className="bg-pampas rounded-2xl border border-sand p-5">
        <div className="flex items-start gap-3">
          <MailCheck size={18} className="text-terra mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-warm-800">Email-first workflow is active</p>
            <p className="text-xs text-warm-600 mt-1 leading-relaxed">
              Each network application now sends an email to configured administrators with signed Approve/Reject links.
              This keeps review operations outside patient-facing product surfaces.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-cream/60 rounded-2xl border border-sand p-4 text-xs text-warm-600">
        <ShieldCheck size={13} className="inline mr-1 text-terra" />
        Configure <code>OPENRX_ADMIN_EMAILS</code>, <code>OPENRX_ADMIN_REVIEW_SECRET</code>, <code>RESEND_API_KEY</code>, and <code>OPENRX_EMAIL_FROM</code> for production.
      </div>
    </div>
  )
}
