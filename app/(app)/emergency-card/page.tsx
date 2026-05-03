"use client"

import { useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Heart,
  Phone,
  Pill,
  Shield,
  User,
} from "lucide-react"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsMetricCard, OpsPanel } from "@/components/ui/ops-primitives"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn } from "@/lib/utils"

function safeDate(value?: string) {
  if (!value) return "Not on file"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "Not on file" : parsed.toLocaleDateString()
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-border/40", className)} />
}

const EMPTY_PATIENT = {
  id: "",
  full_name: "Patient",
  date_of_birth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  insurance_provider: "",
  insurance_plan: "",
  insurance_id: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  medical_history: [] as { condition: string; diagnosed: string; status: string }[],
  allergies: [] as string[],
  primary_physician_id: "",
  created_at: "",
}

export default function EmergencyCardPage() {
  const { snapshot, getPhysician, loading } = useLiveSnapshot()
  const currentUser = useMemo(() => snapshot.patient || EMPTY_PATIENT, [snapshot.patient])
  const physician = getPhysician(currentUser.primary_physician_id)
  const meds = snapshot.prescriptions.filter((prescription) => prescription.status === "active")
  const [copied, setCopied] = useState(false)

  const emergencyText = useMemo(
    () =>
      [
        "EMERGENCY MEDICAL INFO",
        `Name: ${currentUser.full_name}`,
        `DOB: ${safeDate(currentUser.date_of_birth)}`,
        "Blood Type: Not on file (verify at hospital)",
        `Allergies: ${currentUser.allergies.length > 0 ? currentUser.allergies.join(", ") : "None known"}`,
        `Conditions: ${currentUser.medical_history.length ? currentUser.medical_history.map((h) => h.condition).join(", ") : "None on file"}`,
        `Medications: ${meds.length ? meds.map((m) => `${m.medication_name} ${m.dosage}`).join(", ") : "None on file"}`,
        `PCP: ${physician?.full_name || "N/A"} ${physician?.phone || ""}`.trim(),
        `Emergency Contact: ${currentUser.emergency_contact_name || "Not on file"} ${currentUser.emergency_contact_phone || ""}`.trim(),
        `Insurance: ${currentUser.insurance_provider || "Not on file"} ${currentUser.insurance_plan || ""} ${currentUser.insurance_id ? `(ID: ${currentUser.insurance_id})` : ""}`.trim(),
      ].join("\n"),
    [currentUser, meds, physician]
  )

  function handleCopy() {
    navigator.clipboard.writeText(emergencyText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="surface-card p-5">
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
        <div className="surface-card p-6">
          <Skeleton className="h-[34rem] w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Emergency handoff"
        title="Emergency card"
        description="One printable, copyable handoff card for emergency responders: allergies, active conditions, current medications, emergency contact, primary clinician, and insurance context."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <OpsBadge tone={currentUser.allergies.length ? "red" : "accent"}>
              {currentUser.allergies.length ? `${currentUser.allergies.length} allergies` : "no allergies listed"}
            </OpsBadge>
            <OpsBadge tone={meds.length ? "gold" : "blue"}>
              {meds.length} active medication{meds.length === 1 ? "" : "s"}
            </OpsBadge>
            <OpsBadge tone={currentUser.emergency_contact_phone ? "accent" : "red"}>
              {currentUser.emergency_contact_phone ? "contact on file" : "missing contact"}
            </OpsBadge>
          </div>
        }
        actions={
          <button
            onClick={handleCopy}
            className={cn(
              copied ? "control-button-secondary border-accent text-accent" : "control-button-primary"
            )}
          >
            {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy emergency info"}
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsMetricCard
          label="Allergies"
          value={currentUser.allergies.length ? `${currentUser.allergies.length}` : "0"}
          detail={currentUser.allergies.length ? currentUser.allergies.slice(0, 2).join(", ") : "No allergies are listed on the card."}
          icon={AlertCircle}
          tone={currentUser.allergies.length ? "red" : "accent"}
        />
        <OpsMetricCard
          label="Active meds"
          value={`${meds.length}`}
          detail={meds.length ? "Current treatment list included in the emergency handoff." : "No active medications are on file."}
          icon={Pill}
          tone={meds.length ? "gold" : "blue"}
        />
        <OpsMetricCard
          label="Emergency contact"
          value={currentUser.emergency_contact_name || "Missing"}
          detail={currentUser.emergency_contact_phone || "Add a reachable emergency contact number."}
          icon={Phone}
          tone={currentUser.emergency_contact_phone ? "accent" : "red"}
        />
        <OpsMetricCard
          label="Primary clinician"
          value={physician?.full_name || "Not assigned"}
          detail={physician?.phone || "No clinician phone is attached yet."}
          icon={Heart}
          tone={physician ? "terra" : "blue"}
        />
      </div>

      <div className="overflow-hidden rounded-[28px] border border-[rgba(193,47,47,0.16)] bg-[linear-gradient(160deg,#842029_0%,#6e1821_58%,#54151e_100%)] p-5 text-white shadow-[0_18px_40px_rgba(132,32,41,0.16)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/56">Carry this first</p>
            <h2 className="mt-4 max-w-xl font-serif text-[2.15rem] leading-[0.96] text-white">
              Critical medical context, condensed for a responder handoff.
            </h2>
            <p className="mt-3 text-sm leading-7 text-white/72">
              This card is not a complete chart. It is the fastest useful summary when someone needs to know allergies, medications, conditions, PCP, contact, and insurance without opening multiple screens.
            </p>
          </div>
          <OpsBadge tone="red" className="!border-white/12 !bg-white/10 !text-white">
            emergency use
          </OpsBadge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/12 bg-white/8 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Immediate risk check</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {currentUser.allergies.length ? "Read allergies first" : "Check conditions and meds first"}
            </p>
            <p className="mt-1 text-[12px] leading-6 text-white/64">
              {currentUser.allergies.length
                ? "Allergy data is present and should be the first thing a responder or triage nurse sees."
                : "No allergies are listed, so medication and condition context becomes the next key handoff."}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/12 bg-white/8 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/56">Missing data to fix later</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {!currentUser.emergency_contact_phone || !physician?.phone ? "Some contact fields missing" : "Core contacts present"}
            </p>
            <p className="mt-1 text-[12px] leading-6 text-white/64">
              {!currentUser.emergency_contact_phone || !physician?.phone
                ? "This card is still usable, but adding missing phone fields will make it more reliable in a real emergency."
                : "Emergency contact and clinician phone data are both available on the card."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="surface-card overflow-hidden p-0">
          <div className="border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.94))] px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-soft-red" />
                <span className="text-sm font-semibold text-primary">Responder handoff card</span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">OpenRx Health</span>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-serif text-primary">{currentUser.full_name}</p>
                <p className="mt-1 text-xs leading-6 text-secondary">
                  DOB: {safeDate(currentUser.date_of_birth)} · {currentUser.gender || "Gender not on file"} · Blood Type: Not on file
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/8">
                <User size={22} className="text-muted" />
              </div>
            </div>

            <section className="rounded-[22px] border border-red-200/45 bg-[linear-gradient(180deg,rgba(255,247,246,0.96),rgba(255,239,237,0.92))] px-4 py-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-soft-red" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-soft-red">Allergies</span>
              </div>
              {currentUser.allergies.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {currentUser.allergies.map((allergy) => (
                    <span key={allergy} className="rounded-full bg-soft-red/10 px-3 py-1 text-sm font-semibold text-soft-red">
                      {allergy}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-secondary">No known allergies are listed on file.</p>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Heart size={14} className="text-teal" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Medical conditions</span>
              </div>
              <div className="grid gap-2">
                {currentUser.medical_history.length ? (
                  currentUser.medical_history.map((condition) => (
                    <div key={condition.condition} className="surface-muted flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-sm font-medium text-primary">{condition.condition}</span>
                      <OpsBadge tone={condition.status === "active" ? "gold" : condition.status === "managed" ? "accent" : "blue"}>
                        {condition.status}
                      </OpsBadge>
                    </div>
                  ))
                ) : (
                  <div className="surface-muted px-4 py-4 text-sm leading-6 text-secondary">No medical conditions are listed on the card yet.</div>
                )}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Pill size={14} className="text-yellow-700" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Current medications</span>
              </div>
              <div className="grid gap-2">
                {meds.length ? (
                  meds.map((med) => (
                    <div key={med.id} className="surface-muted flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-sm font-medium text-primary">{med.medication_name} {med.dosage}</span>
                      <span className="text-[11px] text-secondary">{med.frequency}</span>
                    </div>
                  ))
                ) : (
                  <div className="surface-muted px-4 py-4 text-sm leading-6 text-secondary">No active medications are listed on the card yet.</div>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="space-y-4">
          <OpsPanel
            eyebrow="Contacts"
            title="Who to call"
            description="This is the part that becomes most frustrating in an urgent setting when the phone numbers are missing or unclear."
          >
            <div className="space-y-3">
              <div className="surface-muted px-4 py-4">
                <div className="text-sm font-semibold text-primary">Emergency contact</div>
                <div className="mt-1 text-sm text-secondary">{currentUser.emergency_contact_name || "Not on file"}</div>
                <div className="mt-1 text-xs text-muted">{currentUser.emergency_contact_phone || "No phone on file"}</div>
              </div>
              <div className="surface-muted px-4 py-4">
                <div className="text-sm font-semibold text-primary">Primary clinician</div>
                <div className="mt-1 text-sm text-secondary">{physician?.full_name || "Not assigned"}</div>
                <div className="mt-1 text-xs text-muted">{physician?.phone || "No phone on file"}</div>
              </div>
            </div>
          </OpsPanel>

          <OpsPanel
            eyebrow="Coverage"
            title="Insurance snapshot"
            description="Useful for registration and routing when the patient cannot speak for themselves."
          >
            <div className="surface-muted px-4 py-4">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-soft-blue" />
                <span className="text-sm font-semibold text-primary">{currentUser.insurance_provider || "Not on file"}</span>
              </div>
              <p className="mt-2 text-sm text-secondary">{currentUser.insurance_plan || "Plan not on file"}</p>
              <p className="mt-1 text-xs text-muted">{currentUser.insurance_id || "Insurance ID not on file"}</p>
            </div>
          </OpsPanel>

          <OpsPanel
            eyebrow="Practical note"
            title="What to do with this"
            description="This page is meant to be copied, saved, or printed before it is ever needed."
          >
            <p className="text-sm leading-7 text-secondary">
              Save this information into your phone’s medical ID or another offline location. In a real emergency, speed matters more than perfect formatting.
            </p>
          </OpsPanel>
        </div>
      </div>
    </div>
  )
}
