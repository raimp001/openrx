"use client"

import {
  AlertCircle, Heart, Pill, Phone, User, Shield,
  Droplets, Copy, CheckCircle2,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { AppPageHeader } from "@/components/layout/app-page"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-border/40", className)} />
}

export default function EmergencyCardPage() {
  const { snapshot, getPhysician, loading } = useLiveSnapshot()
  const currentUser = snapshot.patient || {
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
  const physician = getPhysician(currentUser.primary_physician_id)
  const meds = snapshot.prescriptions.filter((prescription) => prescription.status === "active")
  const [copied, setCopied] = useState(false)

  const emergencyText = [
    `EMERGENCY MEDICAL INFO`,
    `Name: ${currentUser.full_name}`,
    `DOB: ${new Date(currentUser.date_of_birth).toLocaleDateString()}`,
    `Blood Type: Not on file (verify at hospital)`,
    `Allergies: ${currentUser.allergies.length > 0 ? currentUser.allergies.join(", ") : "None known"}`,
    `Conditions: ${currentUser.medical_history.map((h) => h.condition).join(", ")}`,
    `Medications: ${meds.map((m) => `${m.medication_name} ${m.dosage}`).join(", ")}`,
    `PCP: ${physician?.full_name || "N/A"} ${physician?.phone || ""}`,
    `Emergency Contact: ${currentUser.emergency_contact_name} ${currentUser.emergency_contact_phone}`,
    `Insurance: ${currentUser.insurance_provider} ${currentUser.insurance_plan} (ID: ${currentUser.insurance_id})`,
  ].join("\n")

  function handleCopy() {
    navigator.clipboard.writeText(emergencyText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6 max-w-2xl mx-auto">
        <div className="flex flex-col items-center gap-3 text-center">
          <Skeleton className="w-14 h-14 rounded-2xl" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="bg-white rounded-2xl border-2 border-soft-red/30 shadow-lg overflow-hidden">
          <div className="bg-soft-red/20 px-6 py-3"><Skeleton className="h-5 w-56" /></div>
          <div className="p-6 space-y-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
            <Skeleton className="h-16 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6 max-w-2xl mx-auto">
      <AppPageHeader
        align="center"
        leading={
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-soft-red/10">
            <AlertCircle size={28} className="text-soft-red" />
          </div>
        }
        title="Emergency Card"
        description="Critical medical information for emergency responders."
      />

      {/* Emergency Card */}
      <div className="bg-white rounded-2xl border-2 border-soft-red/30 shadow-lg overflow-hidden">
        {/* Red header */}
        <div className="bg-soft-red px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-white" />
            <span className="text-sm font-bold text-white uppercase tracking-wider">
              Emergency Medical Information
            </span>
          </div>
          <span className="text-[10px] text-white/80">OpenRx Health</span>
        </div>

        <div className="p-6 space-y-5">
          {/* Patient Info */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold text-primary">{currentUser.full_name}</p>
              <p className="text-xs text-muted mt-0.5">
                DOB: {new Date(currentUser.date_of_birth).toLocaleDateString()} &middot;{" "}
                {currentUser.gender} &middot; Blood Type: Not on file
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-warm-100 flex items-center justify-center">
              <User size={24} className="text-muted" />
            </div>
          </div>

          {/* Allergies — Most Critical */}
          <div className="bg-soft-red/5 rounded-xl p-4 border border-soft-red/10">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className="text-soft-red" />
              <span className="text-xs font-bold text-soft-red uppercase tracking-wider">
                Allergies
              </span>
            </div>
            {currentUser.allergies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {currentUser.allergies.map((allergy) => (
                  <span
                    key={allergy}
                    className="text-sm font-bold text-soft-red bg-soft-red/10 px-3 py-1 rounded-lg"
                  >
                    {allergy}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-secondary">No known allergies (NKDA)</p>
            )}
          </div>

          {/* Medical Conditions */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Droplets size={14} className="text-teal" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Medical Conditions
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {currentUser.medical_history.map((condition) => (
                <div
                  key={condition.condition}
                  className="flex items-center justify-between px-3 py-2 bg-surface/50 rounded-lg"
                >
                  <span className="text-sm font-medium text-primary">{condition.condition}</span>
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded uppercase",
                    condition.status === "active" ? "bg-yellow-100 text-yellow-700" :
                    condition.status === "managed" ? "bg-accent/10 text-accent" :
                    "bg-warm-100 text-secondary"
                  )}>
                    {condition.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Current Medications */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Pill size={14} className="text-yellow-600" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Current Medications
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {meds.map((med) => (
                <div
                  key={med.id}
                  className="flex items-center justify-between px-3 py-2 bg-surface/50 rounded-lg"
                >
                  <span className="text-sm font-medium text-primary">
                    {med.medication_name} {med.dosage}
                  </span>
                  <span className="text-[10px] text-muted">{med.frequency}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Contact & PCP */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <Phone size={12} className="text-soft-red" />
                <span className="text-[10px] font-bold text-primary uppercase">Emergency Contact</span>
              </div>
              <p className="text-sm font-semibold text-primary">
                {currentUser.emergency_contact_name}
              </p>
              <a
                href={`tel:${currentUser.emergency_contact_phone}`}
                className="text-xs text-soft-blue mt-0.5 block hover:underline"
              >
                {currentUser.emergency_contact_phone}
              </a>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <Heart size={12} className="text-teal" />
                <span className="text-[10px] font-bold text-primary uppercase">Primary Doctor</span>
              </div>
              <p className="text-sm font-semibold text-primary">
                {physician?.full_name || "Not assigned"}
              </p>
              {physician?.phone && (
                <a
                  href={`tel:${physician.phone}`}
                  className="text-xs text-soft-blue mt-0.5 block hover:underline"
                >
                  {physician.phone}
                </a>
              )}
            </div>
          </div>

          {/* Insurance */}
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={12} className="text-soft-blue" />
              <span className="text-[10px] font-bold text-primary uppercase">Insurance</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">
                  {currentUser.insurance_provider}
                </p>
                <p className="text-xs text-secondary">{currentUser.insurance_plan}</p>
              </div>
              <p className="text-xs font-mono text-muted">{currentUser.insurance_id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Copy Button */}
      <div className="flex justify-center">
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition",
            copied
              ? "bg-accent text-white"
              : "bg-teal text-white hover:bg-teal-dark"
          )}
        >
          {copied ? (
            <><CheckCircle2 size={16} /> Copied!</>
          ) : (
            <><Copy size={16} /> Copy Emergency Info</>
          )}
        </button>
      </div>

      <p className="text-center text-[10px] text-muted">
        Tip: Save this to your phone&apos;s Medical ID for instant access in emergencies.
      </p>
    </div>
  )
}
