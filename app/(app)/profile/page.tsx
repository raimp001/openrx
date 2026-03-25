"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  User, Phone, Mail, MapPin, ShieldCheck, Stethoscope, Pill,
  AlertCircle, Heart, Calendar, Activity, FlaskConical, Syringe,
  ChevronRight, CheckCircle2, Clock, Edit3, ArrowRightCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { useWalletIdentity } from "@/lib/wallet-context"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"

function age(dob: string): string {
  if (!dob) return "—"
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return "—"
  const years = Math.floor((Date.now() - d.getTime()) / 31557600000)
  return years > 0 ? `${years} yrs` : "—"
}

function formatDob(dob: string): string {
  if (!dob) return "—"
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return dob
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function InitialAvatar({ name, size = "lg" }: { name: string; size?: "sm" | "lg" }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("")
  return (
    <div className={cn(
      "rounded-2xl bg-gradient-to-br from-teal to-accent flex items-center justify-center font-bold text-white",
      size === "lg" ? "h-16 w-16 text-2xl" : "h-8 w-8 text-sm"
    )}>
      {initials || <User size={size === "lg" ? 28 : 14} />}
    </div>
  )
}

export default function ProfilePage() {
  const { snapshot, getPhysician } = useLiveSnapshot()
  const { isConnected } = useWalletIdentity()
  const patient = snapshot.patient
  const physician = getPhysician(patient?.primary_physician_id)

  const activeMeds = snapshot.prescriptions.filter((rx) => rx.status === "active")
  const avgAdherence = activeMeds.length
    ? Math.round(activeMeds.reduce((s, rx) => s + rx.adherence_pct, 0) / activeMeds.length)
    : null
  const upcomingApts = snapshot.appointments.filter(
    (a) => new Date(a.scheduled_at) >= new Date() && a.status !== "completed" && a.status !== "no-show"
  )
  const abnormalLabs = snapshot.labResults.reduce(
    (count, lab) => count + lab.results.filter((r) => r.flag !== "normal").length, 0
  )
  const dueVaccines = snapshot.vaccinations.filter((v) => v.status === "due" || v.status === "overdue")
  const latestVital = [...snapshot.vitals].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  )[0]

  const infoRows: { label: string; value: string; icon: React.ElementType }[] = useMemo(() => {
    if (!patient) return []
    return [
      { label: "Date of Birth", value: formatDob(patient.date_of_birth), icon: Calendar },
      { label: "Age", value: age(patient.date_of_birth), icon: User },
      { label: "Gender", value: patient.gender || "—", icon: User },
      { label: "Phone", value: patient.phone || "—", icon: Phone },
      { label: "Email", value: patient.email || "—", icon: Mail },
      { label: "Address", value: patient.address || "—", icon: MapPin },
    ]
  }, [patient])

  if (!patient) {
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-teal/10 flex items-center justify-center mx-auto mb-4">
          <User size={28} className="text-teal" />
        </div>
        <h2 className="text-xl font-serif text-primary">No profile found</h2>
        <p className="text-sm text-muted mt-2 max-w-sm">
          Complete onboarding to set up your health profile, or connect your wallet to load saved data.
        </p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-dark"
        >
          Set Up Profile <ChevronRight size={14} />
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-5">
      <AppPageHeader
        title="My Health Profile"
        description="Your complete health record and account details."
        className="surface-card p-4 sm:p-5"
        actions={
          <AIAction
            agentId="coordinator"
            label="Summarize My Health"
            prompt="Give me a comprehensive health summary: active conditions, medications, upcoming appointments, and any items needing immediate attention."
          />
        }
      />

      {/* Profile card */}
      <div className="surface-card overflow-hidden">
        <div className="bg-gradient-to-r from-teal/8 via-transparent to-accent/5 px-6 py-6 border-b border-border/60">
          <div className="flex items-center gap-4">
            <InitialAvatar name={patient.full_name} />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-serif text-primary">{patient.full_name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {patient.insurance_provider && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-soft-blue/20 bg-soft-blue/8 px-2.5 py-1 text-[10px] font-bold text-soft-blue">
                    <ShieldCheck size={9} /> {patient.insurance_provider}
                  </span>
                )}
                {patient.gender && (
                  <span className="text-[11px] text-muted">{patient.gender}</span>
                )}
                {patient.date_of_birth && (
                  <span className="text-[11px] text-muted">{age(patient.date_of_birth)} old</span>
                )}
                {isConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/8 px-2 py-0.5 text-[9px] font-bold text-accent">
                    <CheckCircle2 size={8} /> Wallet Linked
                  </span>
                )}
              </div>
            </div>
            <Link
              href="/onboarding"
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface/40 px-3 py-2 text-[11px] font-semibold text-secondary transition hover:border-teal/30 hover:text-teal"
            >
              <Edit3 size={11} /> Update
            </Link>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border/60">
          {[
            { label: "Active Meds", value: activeMeds.length, icon: Pill, color: "text-accent", href: "/prescriptions" },
            { label: "Upcoming Visits", value: upcomingApts.length, icon: Calendar, color: "text-teal", href: "/scheduling" },
            { label: "Abnormal Labs", value: abnormalLabs, icon: FlaskConical, color: abnormalLabs > 0 ? "text-soft-red" : "text-accent", href: "/lab-results" },
            { label: "Vaccines Due", value: dueVaccines.length, icon: Syringe, color: dueVaccines.length > 0 ? "text-yellow-600" : "text-accent", href: "/vaccinations" },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href} className="flex flex-col items-center py-4 px-3 hover:bg-surface/40 transition text-center">
              <stat.icon size={16} className={cn("mb-1.5", stat.color)} />
              <span className={cn("text-lg font-bold", stat.color)}>{stat.value}</span>
              <span className="text-[10px] text-muted mt-0.5">{stat.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Personal Information */}
        <div className="surface-card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <User size={14} className="text-teal" />
              <h3 className="text-sm font-bold text-primary">Personal Information</h3>
            </div>
          </div>
          <div className="divide-y divide-border/50">
            {infoRows.map((row) => (
              <div key={row.label} className="flex items-center gap-3 px-4 py-2.5">
                <row.icon size={12} className="text-muted shrink-0" />
                <span className="text-[11px] text-muted w-28 shrink-0">{row.label}</span>
                <span className="text-xs font-medium text-primary flex-1 min-w-0 truncate">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Insurance & Coverage */}
        <div className="surface-card">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <ShieldCheck size={14} className="text-soft-blue" />
            <h3 className="text-sm font-bold text-primary">Insurance & Coverage</h3>
          </div>
          <div className="p-4 space-y-3">
            {patient.insurance_provider || patient.insurance_plan || patient.insurance_id ? (
              <>
                <div className="rounded-xl border border-soft-blue/15 bg-soft-blue/5 p-3 space-y-2">
                  {patient.insurance_provider && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">Provider</span>
                      <span className="text-xs font-semibold text-primary">{patient.insurance_provider}</span>
                    </div>
                  )}
                  {patient.insurance_plan && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">Plan</span>
                      <span className="text-xs font-medium text-primary">{patient.insurance_plan}</span>
                    </div>
                  )}
                  {patient.insurance_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">Member ID</span>
                      <span className="font-mono text-[11px] text-primary bg-border/30 px-2 py-0.5 rounded">{patient.insurance_id}</span>
                    </div>
                  )}
                </div>
                <Link href="/billing" className="flex items-center gap-1.5 text-xs font-semibold text-teal hover:gap-2 transition-all">
                  View Claims & Billing <ChevronRight size={11} />
                </Link>
              </>
            ) : (
              <p className="text-xs text-muted py-2">Insurance details not on file. Complete onboarding to add.</p>
            )}
          </div>
        </div>

        {/* Medical History */}
        <div className="surface-card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Heart size={14} className="text-soft-red" />
              <h3 className="text-sm font-bold text-primary">Medical History</h3>
            </div>
            <span className="text-[10px] text-muted">{patient.medical_history.length} condition{patient.medical_history.length !== 1 ? "s" : ""}</span>
          </div>
          {patient.medical_history.length > 0 ? (
            <div className="divide-y divide-border/50">
              {patient.medical_history.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    entry.status === "active" ? "bg-soft-red" : entry.status === "resolved" ? "bg-accent" : "bg-yellow-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-primary">{entry.condition}</p>
                    {entry.diagnosed && (
                      <p className="text-[10px] text-muted mt-0.5">
                        Diagnosed {new Date(entry.diagnosed).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <span className={cn(
                    "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                    entry.status === "active" ? "bg-soft-red/10 text-soft-red" :
                    entry.status === "resolved" ? "bg-accent/10 text-accent" : "bg-yellow-50 text-yellow-700"
                  )}>
                    {entry.status || "active"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-muted">No medical history on file.</div>
          )}
          {patient.allergies.length > 0 && (
            <div className="border-t border-border/60 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={12} className="text-soft-red" />
                <span className="text-[10px] font-bold text-soft-red uppercase tracking-wide">Allergies</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {patient.allergies.map((allergy) => (
                  <span key={allergy} className="rounded-full border border-soft-red/20 bg-soft-red/8 px-2.5 py-1 text-[11px] font-semibold text-soft-red">
                    {allergy}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Emergency & Care Team */}
        <div className="space-y-4">
          {/* Emergency Contact */}
          <div className="surface-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={14} className="text-soft-red" />
              <h3 className="text-sm font-bold text-primary">Emergency Contact</h3>
            </div>
            {patient.emergency_contact_name || patient.emergency_contact_phone ? (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-soft-red/10 flex items-center justify-center shrink-0">
                  <User size={15} className="text-soft-red" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">{patient.emergency_contact_name || "—"}</p>
                  {patient.emergency_contact_phone && (
                    <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                      <Phone size={10} /> {patient.emergency_contact_phone}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted">No emergency contact on file.</p>
            )}
            <Link href="/emergency-card" className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-teal hover:gap-2 transition-all">
              View Emergency Card <ChevronRight size={11} />
            </Link>
          </div>

          {/* Primary Physician */}
          {physician && (
            <div className="surface-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Stethoscope size={14} className="text-teal" />
                <h3 className="text-sm font-bold text-primary">Primary Care Physician</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-teal">{physician.full_name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary">{physician.full_name}</p>
                  <p className="text-[11px] text-muted">{physician.specialty} · {physician.credentials}</p>
                  {physician.phone && (
                    <p className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                      <Phone size={9} /> {physician.phone}
                    </p>
                  )}
                </div>
              </div>
              <Link href="/scheduling" className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-teal hover:gap-2 transition-all">
                Book Appointment <ChevronRight size={11} />
              </Link>
            </div>
          )}

          {/* Latest Vitals Summary */}
          {latestVital && (
            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-accent" />
                  <h3 className="text-sm font-bold text-primary">Latest Vitals</h3>
                </div>
                <span className="text-[9px] text-muted">
                  {new Date(latestVital.recorded_at).toLocaleDateString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {latestVital.systolic && (
                  <div className="rounded-lg bg-border/20 px-2.5 py-2">
                    <p className="text-sm font-bold text-primary">{latestVital.systolic}/{latestVital.diastolic}</p>
                    <p className="text-[10px] text-muted">Blood Pressure</p>
                  </div>
                )}
                {latestVital.heart_rate && (
                  <div className="rounded-lg bg-border/20 px-2.5 py-2">
                    <p className="text-sm font-bold text-primary">{latestVital.heart_rate} bpm</p>
                    <p className="text-[10px] text-muted">Heart Rate</p>
                  </div>
                )}
                {latestVital.blood_glucose && (
                  <div className="rounded-lg bg-border/20 px-2.5 py-2">
                    <p className="text-sm font-bold text-primary">{latestVital.blood_glucose} mg/dL</p>
                    <p className="text-[10px] text-muted">Blood Glucose</p>
                  </div>
                )}
                {latestVital.weight_lbs && (
                  <div className="rounded-lg bg-border/20 px-2.5 py-2">
                    <p className="text-sm font-bold text-primary">{latestVital.weight_lbs} lbs</p>
                    <p className="text-[10px] text-muted">Weight</p>
                  </div>
                )}
              </div>
              <Link href="/vitals" className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-teal hover:gap-2 transition-all">
                View Vital History <ChevronRight size={11} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Active Medications */}
      {activeMeds.length > 0 && (
        <div className="surface-card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Pill size={14} className="text-accent" />
              <h3 className="text-sm font-bold text-primary">Active Medications</h3>
              <span className="text-[10px] text-muted">({activeMeds.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {avgAdherence !== null && (
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded",
                  avgAdherence >= 90 ? "bg-accent/10 text-accent" : avgAdherence >= 80 ? "bg-yellow-50 text-yellow-700" : "bg-soft-red/10 text-soft-red"
                )}>
                  {avgAdherence}% avg adherence
                </span>
              )}
              <Link href="/prescriptions" className="text-[10px] font-semibold text-teal flex items-center gap-0.5 hover:gap-1 transition-all">
                View all <ChevronRight size={9} />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
            {activeMeds.slice(0, 6).map((rx) => (
              <div key={rx.id} className="px-4 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <Pill size={13} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary truncate">{rx.medication_name} {rx.dosage}</p>
                  <p className="text-[10px] text-muted truncate">{rx.frequency}</p>
                </div>
                <span className={cn(
                  "text-[10px] font-bold shrink-0",
                  rx.adherence_pct >= 90 ? "text-accent" : rx.adherence_pct >= 80 ? "text-yellow-600" : "text-soft-red"
                )}>
                  {rx.adherence_pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/timeline", icon: Clock, label: "Health Timeline", desc: "Full event history" },
          { href: "/screening", icon: Heart, label: "Risk Screening", desc: "Personalized prevention" },
          { href: "/second-opinion", icon: ShieldCheck, label: "Second Opinion", desc: "AI plan review" },
          { href: "/referrals", icon: ArrowRightCircle, label: "Referrals", desc: `${snapshot.referrals.length} total` },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="surface-card p-4 hover:border-teal/25 hover:-translate-y-0.5 transition-all"
          >
            <link.icon size={16} className="text-teal mb-2" />
            <p className="text-xs font-bold text-primary">{link.label}</p>
            <p className="text-[10px] text-muted mt-0.5">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
