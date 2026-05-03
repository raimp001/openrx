"use client"

import { Syringe, AlertTriangle, Calendar, Shield, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsBriefCard, OpsPanel } from "@/components/ui/ops-primitives"
import { cn, formatDate } from "@/lib/utils"

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-border/40", className)} />
}

export default function VaccinationsPage() {
  const { snapshot, loading } = useLiveSnapshot()
  const vaccinations = snapshot.vaccinations

  const hasData = !!snapshot.patient
  const completed = vaccinations.filter((v) => v.status === "completed")
  const due = vaccinations.filter((v) => v.status === "due" || v.status === "overdue")
  const overdue = vaccinations.filter((v) => v.status === "overdue")
  const topDue = [...due].sort((left, right) => {
    const leftScore = left.status === "overdue" ? 0 : 1
    const rightScore = right.status === "overdue" ? 0 : 1
    return leftScore - rightScore
  })[0]

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-4">
              <Skeleton className="h-14 w-full" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-surface">
          <div className="border-b border-border p-4">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="divide-y divide-border/50">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!loading && !hasData) {
    return (
      <div className="animate-slide-up flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/8">
          <Syringe size={28} className="text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-serif text-primary">Vaccination Records</h1>
          <p className="mt-1 max-w-sm text-muted">
            Connect your health record to view your immunization history and upcoming vaccines.
          </p>
        </div>
        <Link href="/onboarding" className="rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-dark">
          Get Started
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Prevention"
        title="Vaccination Records"
        description="Keep the prevention plan readable: what is already covered, what is due next, and which vaccine should move first."
        className="surface-card p-4 sm:p-5"
        meta={
          <>
            <OpsBadge tone="accent">{completed.length} documented complete</OpsBadge>
            <OpsBadge tone="gold">{due.length} due or recommended</OpsBadge>
          </>
        }
        actions={
          <AIAction
            agentId="wellness"
            label="Vaccine Review"
            prompt={`Review my vaccination record. I have ${completed.length} completed vaccines and ${due.length} due. ${due.map((v) => v.vaccine_name).join(", ")} are recommended. Based on my age, conditions (Type 2 Diabetes, Hypertension), and insurance (Moda Medical), which vaccines should I prioritize, what are they covered at, and can you help me book them?`}
            context={`Completed: ${completed.map((v) => v.vaccine_name).join(", ")}. Due: ${due.map((v) => v.vaccine_name).join(", ")}`}
          />
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <OpsBriefCard
          label="Move this vaccine first"
          title={topDue ? topDue.vaccine_name : "No vaccine currently due"}
          detail={
            topDue
              ? `${topDue.status.toUpperCase()} · ${topDue.brand}${topDue.next_due ? ` · Next target ${formatDate(topDue.next_due)}` : ""}`
              : "Your documented record is currently up to date."
          }
          tone="gold"
        />
        <OpsBriefCard
          label="Protection posture"
          title={`${completed.length} completed, ${due.length} still open`}
          detail="The prevention plan is organized around closing overdue items first, then clearing recommended but not urgent doses."
          tone="accent"
        />
        <OpsBriefCard
          label="Immediate risk"
          title={`${overdue.length} overdue vaccine${overdue.length !== 1 ? "s" : ""}`}
          detail="Overdue items sit above the historical record so action is not buried under completed doses."
          tone="terra"
        />
      </div>

      {due.length > 0 ? (
        <OpsPanel
          eyebrow="Prevention plan"
          title="Recommended vaccinations ready to schedule"
          description="These are the next prevention moves based on your current record. Each one is presented as a discrete scheduling task rather than a passive reminder."
          className="border-yellow-200/50 bg-yellow-50"
        >
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-yellow-600" />
            <span className="text-xs font-bold text-yellow-700">Recommended Vaccinations</span>
          </div>
          <div className="space-y-2">
            {due.map((vax) => (
              <div
                key={vax.id}
                className="flex items-center justify-between rounded-xl border border-yellow-100 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <Syringe size={16} className="text-yellow-600" />
                  <div>
                    <p className="text-sm font-semibold text-primary">{vax.vaccine_name}</p>
                    <p className="text-[10px] text-muted">
                      {vax.total_doses > 1 ? `${vax.total_doses}-dose series` : "Single dose"} · {vax.brand}
                    </p>
                  </div>
                </div>
                <Link
                  href="/chat"
                  className="flex items-center gap-1 rounded-lg bg-teal/10 px-2.5 py-1 text-[10px] font-bold text-teal transition hover:bg-teal/20"
                >
                  Schedule <ArrowRight size={8} />
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-muted">
            Ask for help booking these at your preferred pharmacy or doctor&apos;s office.
          </p>
        </OpsPanel>
      ) : null}

      <div className="rounded-2xl border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-bold text-primary">Immunization History</h2>
        </div>
        <div className="divide-y divide-border/50">
          {completed.map((vax) => (
            <div key={vax.id} className="p-4 transition hover:bg-surface/30">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                    <Shield size={14} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary">{vax.vaccine_name}</h3>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {vax.brand} · Dose {vax.dose_number}/{vax.total_doses}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar size={8} />
                        {vax.administered_at ? formatDate(vax.administered_at) : "Date unavailable"}
                      </span>
                      <span>{vax.administered_by}</span>
                    </div>
                    <p className="mt-1 text-[9px] text-muted">
                      Lot: {vax.lot_number} · Site: {vax.site}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-bold text-accent">Complete</span>
                  {vax.next_due ? (
                    <p className="mt-1 text-[9px] text-muted">
                      Next: {new Date(vax.next_due).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AIAction
        agentId="wellness"
        label="Get personalized vaccine guidance"
        prompt={`Based on my age (50), conditions (Type 2 Diabetes, Hypertension), and completed vaccines (${completed.map((v) => v.vaccine_name).join(", ")}), give me a complete vaccine plan: which vaccines I still need, why they're recommended for my risk profile, which are covered by Moda Medical, and which to schedule first.`}
        context={`Due vaccines: ${due.map((v) => `${v.vaccine_name} (${v.status})`).join(", ")}`}
        variant="inline"
        className="rounded-2xl border border-teal/10 bg-teal/5 p-4"
      />
    </div>
  )
}
