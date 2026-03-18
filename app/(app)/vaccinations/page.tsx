"use client"

import {
  Syringe, CheckCircle2, AlertTriangle, Calendar,
  Shield, ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import AIAction from "@/components/ai-action"
import { cn } from "@/lib/utils"

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-sand/40", className)} />
}

export default function VaccinationsPage() {
  const { snapshot, loading } = useLiveSnapshot()
  const vaccinations = snapshot.vaccinations

  const hasData = !!snapshot.patient
  const completed = vaccinations.filter((v) => v.status === "completed")
  const due = vaccinations.filter((v) => v.status === "due" || v.status === "overdue")

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-pampas rounded-2xl border border-sand p-4"><Skeleton className="h-14 w-full" /></div>)}
        </div>
        <div className="bg-pampas rounded-2xl border border-sand">
          <div className="p-4 border-b border-sand"><Skeleton className="h-4 w-40" /></div>
          <div className="divide-y divide-sand/50">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-56" /></div>
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
      <div className="animate-slide-up flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/8 flex items-center justify-center">
          <Syringe size={28} className="text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-serif text-warm-800">Vaccination Records</h1>
          <p className="text-warm-500 mt-1 max-w-sm">Connect your health record to view your immunization history and upcoming vaccines.</p>
        </div>
        <Link href="/onboarding" className="px-5 py-2.5 bg-terra text-white text-sm font-semibold rounded-xl hover:bg-terra-dark transition">
          Get Started
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif text-warm-800">Vaccination Records</h1>
          <p className="text-sm text-warm-500 mt-1">
            Your immunization history and upcoming vaccinations.
          </p>
        </div>
        <AIAction
          agentId="wellness"
          label="Vaccine Review"
          prompt={`Review my vaccination record. I have ${completed.length} completed vaccines and ${due.length} due. ${due.map(v => v.vaccine_name).join(", ")} are recommended. Based on my age, conditions (Type 2 Diabetes, Hypertension), and insurance (Moda Medical), which vaccines should I prioritize, what are they covered at, and can you help me book them?`}
          context={`Completed: ${completed.map(v => v.vaccine_name).join(", ")}. Due: ${due.map(v => v.vaccine_name).join(", ")}`}
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <CheckCircle2 size={20} className="text-accent mb-2" />
          <div className="text-lg font-bold text-warm-800">{completed.length}</div>
          <div className="text-xs text-warm-500">Up to Date</div>
        </div>
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <AlertTriangle size={20} className="text-yellow-600 mb-2" />
          <div className="text-lg font-bold text-warm-800">{due.length}</div>
          <div className="text-xs text-warm-500">Due / Recommended</div>
        </div>
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <Syringe size={20} className="text-terra mb-2" />
          <div className="text-lg font-bold text-warm-800">{vaccinations.length}</div>
          <div className="text-xs text-warm-500">Total Records</div>
        </div>
      </div>

      {/* Due Vaccinations Alert */}
      {due.length > 0 && (
        <div className="bg-yellow-50 rounded-2xl border border-yellow-200/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-yellow-600" />
            <span className="text-xs font-bold text-yellow-700">
              Recommended Vaccinations
            </span>
          </div>
          <div className="space-y-2">
            {due.map((vax) => (
              <div
                key={vax.id}
                className="flex items-center justify-between p-3 bg-white rounded-xl border border-yellow-100"
              >
                <div className="flex items-center gap-3">
                  <Syringe size={16} className="text-yellow-600" />
                  <div>
                    <p className="text-sm font-semibold text-warm-800">{vax.vaccine_name}</p>
                    <p className="text-[10px] text-warm-500">
                      {vax.total_doses > 1
                        ? `${vax.total_doses}-dose series`
                        : "Single dose"}{" "}
                      &middot; {vax.brand}
                    </p>
                  </div>
                </div>
                <Link
                  href="/chat"
                  className="text-[10px] font-bold text-terra bg-terra/10 px-2.5 py-1 rounded-lg hover:bg-terra/20 transition flex items-center gap-1"
                >
                  Schedule <ArrowRight size={8} />
                </Link>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-warm-500 mt-3">
            Ask Cal (scheduler) to book these at your preferred pharmacy or doctor&apos;s office.
          </p>
        </div>
      )}

      {/* Completed Vaccinations */}
      <div className="bg-pampas rounded-2xl border border-sand">
        <div className="p-4 border-b border-sand">
          <h2 className="text-sm font-bold text-warm-800">Immunization History</h2>
        </div>
        <div className="divide-y divide-sand/50">
          {completed.map((vax) => (
            <div key={vax.id} className="p-4 hover:bg-cream/30 transition">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center mt-0.5">
                    <Shield size={14} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-warm-800">{vax.vaccine_name}</h3>
                    <p className="text-[10px] text-cloudy mt-0.5">
                      {vax.brand} &middot; Dose {vax.dose_number}/{vax.total_doses}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-warm-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={8} />
                        {vax.administered_at ? new Date(vax.administered_at).toLocaleDateString() : "Date unavailable"}
                      </span>
                      <span>{vax.administered_by}</span>
                    </div>
                    <p className="text-[9px] text-cloudy mt-1">
                      Lot: {vax.lot_number} &middot; Site: {vax.site}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                    Complete
                  </span>
                  {vax.next_due && (
                    <p className="text-[9px] text-cloudy mt-1">
                      Next: {new Date(vax.next_due).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Vaccination Guidance */}
      <AIAction
        agentId="wellness"
        label="Get Ivy's Personalized Vaccine Guidance"
        prompt={`Based on my age (50), conditions (Type 2 Diabetes, Hypertension), and completed vaccines (${completed.map(v => v.vaccine_name).join(", ")}), give me a complete vaccine plan: which vaccines I still need, why they're recommended for my risk profile, which are covered by Moda Medical, and which to schedule first.`}
        context={`Due vaccines: ${due.map(v => `${v.vaccine_name} (${v.status})`).join(", ")}`}
        variant="inline"
        className="bg-terra/5 rounded-2xl border border-terra/10 p-4"
      />
    </div>
  )
}
