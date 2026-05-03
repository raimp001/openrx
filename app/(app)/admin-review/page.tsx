import { Inbox, LockKeyhole, MailCheck, ShieldCheck } from "lucide-react"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsMetricCard } from "@/components/ui/ops-primitives"

const envRequirements = [
  "OPENRX_ADMIN_EMAILS",
  "OPENRX_ADMIN_REVIEW_SECRET",
  "RESEND_API_KEY",
  "OPENRX_EMAIL_FROM",
]

const reviewFlow = [
  "A provider or caregiver submits an application from the network intake flow.",
  "OpenRx emails signed Approve and Reject links to the configured reviewers.",
  "The decision happens outside the patient shell, so there is no exposed public queue.",
  "Review confirmation is written back through the admin action routes after approval.",
]

export default function AdminReviewPage() {
  return (
    <div className="animate-slide-up max-w-5xl space-y-6">
      <AppPageHeader
        eyebrow="Admin operations"
        title="Admin review routing"
        description="Application approval stays off the patient-facing surface. OpenRx routes each network submission into signed email actions so reviewers can respond quickly without managing another in-app queue."
        meta={
          <>
            <OpsBadge tone="accent">email-first review</OpsBadge>
            <OpsBadge tone="blue">signed approval links</OpsBadge>
            <OpsBadge tone="terra">no patient-facing queue</OpsBadge>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <OpsMetricCard
          label="Primary route"
          value="Signed email review"
          detail="Reviewers receive approve/reject links with each application instead of working from an exposed dashboard queue."
          icon={MailCheck}
          tone="accent"
        />
        <OpsMetricCard
          label="Queue posture"
          value="Hidden from patients"
          detail="This admin page is only a routing explainer. It does not function as a live in-product backlog."
          icon={Inbox}
          tone="blue"
        />
        <OpsMetricCard
          label="Security posture"
          value="Secret-backed actions"
          detail="Decision links are signed and validated server-side before any approval state is applied."
          icon={LockKeyhole}
          tone="terra"
        />
      </div>

      <section className="overflow-hidden rounded-[30px] border border-[rgba(82,108,139,0.12)] bg-[linear-gradient(160deg,#07111f_0%,#10254a_58%,#173B83_100%)] text-white shadow-[0_24px_70px_rgba(8,24,46,0.18)]">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="section-title text-white/55">Operating brief</div>
          <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-semibold tracking-[-0.05em]">
            Review happens in inboxes first, not inside the care shell.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72">
            That separation is deliberate. Patients should not be able to infer queue state or reviewer activity,
            and administrators should be able to act on a request directly from a signed email without opening the
            product just to make a binary decision.
          </p>
        </div>
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="px-6 py-6">
            <div className="section-title text-white/55">Review flow</div>
            <div className="mt-4 space-y-3">
              {reviewFlow.map((step, index) => (
                <div
                  key={step}
                  className="flex items-start gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/14 bg-white/[0.06] text-xs font-semibold text-white/75">
                    0{index + 1}
                  </div>
                  <p className="text-sm leading-6 text-white/78">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-6 py-6 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-white/72" />
              <div className="section-title text-white/55">Required production settings</div>
            </div>
            <div className="mt-4 space-y-2.5">
              {envRequirements.map((item) => (
                <div
                  key={item}
                  className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-3 text-xs font-medium tracking-[0.02em] text-white/82"
                >
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-6 text-white/62">
              If any of these are missing, submission review will degrade into a dead-end state and the email-first
              workflow will not fire reliably.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
