"use client"

import { currentUser } from "@/lib/current-user"
import { getPatientReferrals, getPhysician } from "@/lib/seed-data"
import { cn } from "@/lib/utils"
import {
  ArrowRightCircle, Clock, CheckCircle2, Calendar, Phone,
  AlertTriangle, ArrowRight, MapPin,
} from "lucide-react"
import AIAction from "@/components/ai-action"

export default function ReferralsPage() {
  const referrals = getPatientReferrals(currentUser.id)

  const pending = referrals.filter((r) => r.status === "pending")
  const scheduled = referrals.filter((r) => r.status === "scheduled")
  const completed = referrals.filter((r) => r.status === "completed")

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-2xl font-serif text-warm-800">Referrals</h1>
        <p className="text-sm text-warm-500 mt-1">
          Track your specialist referrals and appointments.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <Clock size={20} className="text-yellow-600 mb-2" />
          <div className="text-lg font-bold text-warm-800">{pending.length}</div>
          <div className="text-xs text-warm-500">Pending</div>
        </div>
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <Calendar size={20} className="text-soft-blue mb-2" />
          <div className="text-lg font-bold text-warm-800">{scheduled.length}</div>
          <div className="text-xs text-warm-500">Scheduled</div>
        </div>
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <CheckCircle2 size={20} className="text-accent mb-2" />
          <div className="text-lg font-bold text-warm-800">{completed.length}</div>
          <div className="text-xs text-warm-500">Completed</div>
        </div>
      </div>

      {/* Pending Insurance Alert */}
      {referrals.some((r) => !r.insurance_authorized && r.status !== "completed") && (
        <div className="bg-yellow-50 rounded-2xl border border-yellow-200/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-yellow-600" />
            <span className="text-xs font-bold text-yellow-700">Insurance Authorization Needed</span>
          </div>
          {referrals
            .filter((r) => !r.insurance_authorized && r.status !== "completed")
            .map((r) => (
              <p key={r.id} className="text-xs text-warm-600 mt-1">
                {r.specialist_name} ({r.specialist_specialty}) — authorization pending from {currentUser.insurance_provider}
              </p>
            ))}
          <p className="text-[10px] text-warm-500 mt-2">
            Rex (PA specialist) is working on getting these authorized.
          </p>
        </div>
      )}

      {/* Referral Cards */}
      <div className="space-y-3">
        {referrals.map((ref) => {
          const referringDoc = getPhysician(ref.referring_physician_id)

          return (
            <div
              key={ref.id}
              className="bg-pampas rounded-2xl border border-sand p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    ref.status === "completed" ? "bg-accent/10" :
                    ref.status === "scheduled" ? "bg-soft-blue/10" :
                    "bg-yellow-100"
                  )}>
                    <ArrowRightCircle size={18} className={
                      ref.status === "completed" ? "text-accent" :
                      ref.status === "scheduled" ? "text-soft-blue" :
                      "text-yellow-600"
                    } />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-warm-800">
                      {ref.specialist_name}
                    </h3>
                    <p className="text-xs text-warm-600 mt-0.5">{ref.specialist_specialty}</p>
                    <p className="text-[10px] text-cloudy mt-1">
                      Referred by {referringDoc?.full_name || "your doctor"} on{" "}
                      {new Date(ref.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                    ref.status === "completed" ? "bg-accent/10 text-accent" :
                    ref.status === "scheduled" ? "bg-soft-blue/10 text-soft-blue" :
                    "bg-yellow-100 text-yellow-700"
                  )}>
                    {ref.status}
                  </span>
                  {ref.appointment_date && ref.status !== "completed" && (
                    <p className="text-[10px] text-warm-600 mt-1 font-semibold">
                      {new Date(ref.appointment_date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div className="mt-3 ml-[52px]">
                <p className="text-xs text-warm-700">{ref.reason}</p>

                {/* Details */}
                <div className="flex items-center gap-4 mt-2 text-[10px] text-cloudy">
                  <span className="flex items-center gap-1">
                    <Phone size={8} /> {ref.specialist_phone}
                  </span>
                  <span className={cn(
                    "flex items-center gap-1 font-semibold",
                    ref.insurance_authorized ? "text-accent" : "text-yellow-600"
                  )}>
                    {ref.insurance_authorized ? (
                      <><CheckCircle2 size={8} /> Insurance authorized</>
                    ) : (
                      <><Clock size={8} /> Authorization pending</>
                    )}
                  </span>
                  <span className={cn(
                    "font-bold uppercase",
                    ref.urgency === "stat" ? "text-soft-red" :
                    ref.urgency === "urgent" ? "text-yellow-600" :
                    "text-warm-400"
                  )}>
                    {ref.urgency}
                  </span>
                </div>

                {/* Notes */}
                {ref.notes && (
                  <p className="text-[10px] text-cloudy mt-2 italic">{ref.notes}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Insight */}
      <AIAction
        agentId="coordinator"
        label="Atlas' Referral Coordination"
        prompt="Review my specialist referrals and help me understand next steps, any pending insurance authorizations needed, and how each referral relates to my overall care plan."
        context={`Referrals — pending: ${pending.length}, scheduled: ${scheduled.length}, completed: ${completed.length}. ${pending.map(r => r.specialist_specialty).join(", ")} pending auth.`}
        variant="inline"
        className="bg-terra/5 rounded-2xl border border-terra/10 p-4"
      />
    </div>
  )
}
