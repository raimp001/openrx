"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, UserPlus } from "lucide-react"
import { AppPageHeader } from "@/components/layout/app-page"

type RoleOption = "provider" | "caregiver"

export default function JoinNetworkPage() {
  const [role, setRole] = useState<RoleOption>("provider")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [npi, setNpi] = useState("")
  const [licenseNumber, setLicenseNumber] = useState("")
  const [specialtyOrRole, setSpecialtyOrRole] = useState("")
  const [servicesSummary, setServicesSummary] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zip, setZip] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState("")
  const [error, setError] = useState("")

  async function submitApplication() {
    const normalizedState = state.trim().toUpperCase()
    const normalizedZip = zip.trim()
    const normalizedNpi = npi.trim()
    const normalizedLicense = licenseNumber.trim()

    if (
      !fullName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !specialtyOrRole.trim() ||
      !servicesSummary.trim() ||
      !city.trim() ||
      !normalizedState ||
      !normalizedZip
    ) {
      setError("Please complete all required fields before submitting.")
      return
    }

    if (role === "provider" && !normalizedNpi && !normalizedLicense) {
      setError("Providers need an NPI or license number for admin verification.")
      return
    }

    if (normalizedZip && !/^\d{5}$/.test(normalizedZip)) {
      setError("ZIP must be 5 digits.")
      return
    }

    if (normalizedState && !/^[A-Z]{2}$/.test(normalizedState)) {
      setError("State must be a 2-letter abbreviation.")
      return
    }

    if (normalizedNpi && !/^\d{10}$/.test(normalizedNpi)) {
      setError("NPI must be 10 digits.")
      return
    }

    setSubmitting(true)
    setError("")
    setSubmittedId("")
    try {
      const response = await fetch("/api/admin/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          npi: normalizedNpi || undefined,
          licenseNumber: normalizedLicense || undefined,
          specialtyOrRole: specialtyOrRole.trim(),
          servicesSummary: servicesSummary.trim(),
          city: city.trim(),
          state: normalizedState,
          zip: normalizedZip,
        }),
      })
      const data = (await response.json()) as { error?: string; application?: { id: string } }
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to submit application.")
      }
      if (data.application?.id) {
        setSubmittedId(data.application.id)
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Failed to submit application.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-slide-up space-y-6 max-w-3xl">
      <AppPageHeader
        title="Join OpenRx Network"
        description="Providers and caregivers can apply here. Review happens through signed admin email actions."
      />

      <div className="surface-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs text-secondary">
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as RoleOption)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary focus:outline-none focus:border-teal/40"
            >
              <option value="provider">Provider</option>
              <option value="caregiver">Caregiver</option>
            </select>
          </label>
          <label className="text-xs text-secondary">
            Full name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary focus:outline-none focus:border-teal/40"
            />
          </label>
          <label className="text-xs text-secondary">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary focus:outline-none focus:border-teal/40"
            />
          </label>
          <label className="text-xs text-secondary">
            Phone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary focus:outline-none focus:border-teal/40"
            />
          </label>
          <label className="text-xs text-secondary">
            NPI (optional)
            <input
              value={npi}
              onChange={(event) => setNpi(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary focus:outline-none focus:border-teal/40"
            />
          </label>
          <label className="text-xs text-secondary">
            License number (optional)
            <input
              value={licenseNumber}
              onChange={(event) => setLicenseNumber(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary focus:outline-none focus:border-teal/40"
            />
          </label>
          <label className="text-xs text-secondary">
            Specialty / Caregiver role
            <input
              value={specialtyOrRole}
              onChange={(event) => setSpecialtyOrRole(event.target.value)}
              placeholder={role === "provider" ? "Family medicine" : "Home health aide"}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary focus:outline-none focus:border-teal/40"
            />
          </label>
          <label className="text-xs text-secondary">
            ZIP
            <input
              value={zip}
              onChange={(event) => setZip(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary focus:outline-none focus:border-teal/40"
            />
          </label>
          <label className="text-xs text-secondary">
            City
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary focus:outline-none focus:border-teal/40"
            />
          </label>
          <label className="text-xs text-secondary">
            State
            <input
              value={state}
              onChange={(event) => setState(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary focus:outline-none focus:border-teal/40"
            />
          </label>
        </div>
        <label className="text-xs text-secondary block">
          Services summary (natural language)
          <textarea
            value={servicesSummary}
            onChange={(event) => setServicesSummary(event.target.value)}
            rows={4}
            placeholder="Describe patient populations, services, and availability in plain language."
            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-surface/30 text-sm text-primary focus:outline-none focus:border-teal/40"
          />
        </label>

        {error && <p className="text-xs text-soft-red">{error}</p>}
        {submittedId && (
          <div className="rounded-xl border border-accent/20 bg-accent/10 p-3 text-xs text-accent">
            <CheckCircle2 size={12} className="inline mr-1" />
            Application submitted and delivered for email review. Reference ID: <span className="font-mono">{submittedId}</span>
          </div>
        )}

        <button
          onClick={() => void submitApplication()}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal text-white text-sm font-semibold hover:bg-teal-dark disabled:opacity-60 transition"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          Submit Application
        </button>
      </div>
    </div>
  )
}
