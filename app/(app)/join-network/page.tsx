"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Loader2, ShieldCheck, UserPlus } from "lucide-react"
import { AppPageHeader } from "@/components/layout/app-page"
import { ClinicalField, ClinicalInput, ClinicalSection, ClinicalTextarea, ChoiceChip, FieldsetCard } from "@/components/ui/clinical-forms"
import { OpsBadge, OpsMetricCard } from "@/components/ui/ops-primitives"
import { cn } from "@/lib/utils"

type RoleOption = "provider" | "caregiver"

export default function JoinNetworkPage() {
  const [role, setRole] = useState<RoleOption>("provider")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [npi, setNpi] = useState("")
  const [licenseNumber, setLicenseNumber] = useState("")
  const [licenseState, setLicenseState] = useState("")
  const [licensedStates, setLicensedStates] = useState("")
  const [orderingCertifyingStatus, setOrderingCertifyingStatus] = useState("")
  const [malpracticeCoverage, setMalpracticeCoverage] = useState("")
  const [stateLicensureAttestation, setStateLicensureAttestation] = useState(false)
  const [orderingScopeAttestation, setOrderingScopeAttestation] = useState(false)
  const [noAutoPrescriptionAttestation, setNoAutoPrescriptionAttestation] = useState(false)
  const [malpracticeAttestation, setMalpracticeAttestation] = useState(false)
  const [specialtyOrRole, setSpecialtyOrRole] = useState("")
  const [servicesSummary, setServicesSummary] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zip, setZip] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState("")
  const [error, setError] = useState("")

  const requiredFieldCount = useMemo(() => {
    const base = [fullName, email, phone, specialtyOrRole, servicesSummary, city, state, zip].filter((value) => value.trim().length > 0).length
    if (role !== "provider") return base
    const providerFields = [npi, licenseNumber, licenseState, orderingCertifyingStatus].filter((value) => value.trim().length > 0).length
    const attestations = [
      stateLicensureAttestation,
      orderingScopeAttestation,
      noAutoPrescriptionAttestation,
      malpracticeAttestation,
    ].filter(Boolean).length
    return base + providerFields + attestations
  }, [
    city,
    email,
    fullName,
    licenseNumber,
    licenseState,
    npi,
    noAutoPrescriptionAttestation,
    orderingCertifyingStatus,
    orderingScopeAttestation,
    phone,
    role,
    servicesSummary,
    specialtyOrRole,
    state,
    stateLicensureAttestation,
    zip,
    malpracticeAttestation,
  ])
  const requiredFieldTotal = role === "provider" ? 16 : 8

  async function submitApplication() {
    const normalizedState = state.trim().toUpperCase()
    const normalizedZip = zip.trim()
    const normalizedNpi = npi.trim()
    const normalizedLicense = licenseNumber.trim()
    const normalizedLicenseState = licenseState.trim().toUpperCase()
    const normalizedLicensedStates = licensedStates
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)

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

    if (role === "provider" && !normalizedNpi) {
      setError("Providers need an individual NPI for admin verification.")
      return
    }

    if (role === "provider" && !normalizedLicense) {
      setError("Providers need a state license number for admin verification.")
      return
    }

    if (role === "provider" && !normalizedLicenseState) {
      setError("Providers need a primary license state.")
      return
    }

    if (role === "provider" && !orderingCertifyingStatus) {
      setError("Providers need to choose an ordering/certifying status.")
      return
    }

    if (
      role === "provider" &&
      (!stateLicensureAttestation ||
        !orderingScopeAttestation ||
        !noAutoPrescriptionAttestation ||
        !malpracticeAttestation)
    ) {
      setError("Providers must complete all regulatory attestations before submitting.")
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

    if (normalizedLicenseState && !/^[A-Z]{2}$/.test(normalizedLicenseState)) {
      setError("Primary license state must be a 2-letter abbreviation.")
      return
    }

    if (normalizedLicensedStates.some((item) => !/^[A-Z]{2}$/.test(item))) {
      setError("Licensed states must be 2-letter abbreviations separated by commas.")
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
          licenseState: normalizedLicenseState || undefined,
          licensedStates: normalizedLicensedStates,
          orderingCertifyingStatus: orderingCertifyingStatus || undefined,
          malpracticeCoverage: malpracticeCoverage.trim() || undefined,
          stateLicensureAttestation,
          orderingScopeAttestation,
          noAutoPrescriptionAttestation,
          malpracticeAttestation,
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
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Network intake"
        title="Join OpenRx network"
        description="Apply as a provider or caregiver through one structured intake. OpenRx routes the application to admin review with signed email actions instead of a spreadsheet-driven backlog."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <OpsBadge tone={role === "provider" ? "terra" : "blue"}>{role === "provider" ? "provider review" : "caregiver review"}</OpsBadge>
            <OpsBadge tone={requiredFieldCount >= requiredFieldTotal ? "accent" : "gold"}>{requiredFieldCount}/{requiredFieldTotal} required checks complete</OpsBadge>
            {submittedId ? <OpsBadge tone="accent">application submitted</OpsBadge> : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsMetricCard
          label="Role"
          value={role === "provider" ? "Provider" : "Caregiver"}
          detail="The application language and verification expectations shift with the selected role."
          icon={UserPlus}
          tone={role === "provider" ? "terra" : "blue"}
        />
        <OpsMetricCard
          label="Verification"
          value={role === "provider" ? "NPI + state license" : "Profile review"}
          detail={role === "provider" ? "Providers need an individual NPI, license number, license state, and ordering-scope attestation before review." : "Caregivers can apply without an NPI but still go through admin review."}
          icon={CheckCircle2}
          tone="gold"
        />
        <OpsMetricCard
          label="Coverage area"
          value={zip.trim() || "ZIP pending"}
          detail={city.trim() && state.trim() ? `${city.trim()}, ${state.trim().toUpperCase()}` : "Add a city, state, and ZIP so OpenRx can place the application correctly."}
          icon={UserPlus}
          tone={zip.trim() ? "accent" : "blue"}
        />
        <OpsMetricCard
          label={role === "provider" ? "Regulatory posture" : "Status"}
          value={role === "provider" ? "Human review required" : submittedId ? "Submitted" : submitting ? "Sending" : "Draft"}
          detail={role === "provider" ? "OpenRx must verify patient-state licensure and ordering authority before matching patients to a script/order workflow." : submittedId ? `Reference ID ${submittedId}` : "Nothing is sent until the required intake fields are complete."}
          icon={role === "provider" ? ShieldCheck : CheckCircle2}
          tone={submittedId ? "accent" : submitting ? "gold" : "blue"}
        />
      </div>

      <ClinicalSection
        kicker="Application"
        title="Tell OpenRx who you are, where you practice, and what care you provide."
        description="This is a credentialing-style intake, not a marketing form. The goal is enough structured detail for the admin team to verify identity, geography, and service fit in one pass."
        aside={
          <div className="space-y-3">
            <div className="eyebrow-pill">Admin review uses</div>
            <ul className="space-y-2 text-sm leading-6 text-secondary">
              <li>Identity verification through NPI or license data when applicable.</li>
              <li>Service fit review for the patient populations and care tasks you described.</li>
              <li>Geographic review so the profile lands in the right matching area.</li>
            </ul>
          </div>
        }
      >
        <div className="space-y-5">
          <FieldsetCard
            legend="Role selection"
            description="Pick the intake path that matches your work so the verification expectations stay explicit."
          >
            <div className="flex flex-wrap gap-2">
              {([
                { value: "provider", label: "Provider" },
                { value: "caregiver", label: "Caregiver" },
              ] as const).map((option) => (
                <button key={option.value} type="button" onClick={() => setRole(option.value)}>
                  <ChoiceChip active={role === option.value}>{option.label}</ChoiceChip>
                </button>
              ))}
            </div>
          </FieldsetCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <ClinicalField label="Full name" htmlFor="join-full-name">
              <ClinicalInput id="join-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </ClinicalField>
            <ClinicalField label="Email" htmlFor="join-email">
              <ClinicalInput id="join-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </ClinicalField>
            <ClinicalField label="Phone" htmlFor="join-phone">
              <ClinicalInput id="join-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </ClinicalField>
            <ClinicalField
              label={role === "provider" ? "Specialty" : "Caregiver role"}
              htmlFor="join-specialty"
              hint={role === "provider" ? "Examples: family medicine, oncology, neurology." : "Examples: home health aide, respite caregiver, care navigator."}
            >
              <ClinicalInput
                id="join-specialty"
                value={specialtyOrRole}
                onChange={(event) => setSpecialtyOrRole(event.target.value)}
                placeholder={role === "provider" ? "Family medicine" : "Home health aide"}
              />
            </ClinicalField>
            <ClinicalField
              label="NPI"
              optional={role !== "provider"}
              htmlFor="join-npi"
              hint={role === "provider" ? "Use an individual NPI for ordering/referring review. Organizational NPIs do not establish individual authority." : "Optional for caregiver applications."}
            >
              <ClinicalInput id="join-npi" value={npi} onChange={(event) => setNpi(event.target.value)} />
            </ClinicalField>
            <ClinicalField
              label="License number"
              optional={role !== "provider"}
              htmlFor="join-license"
              hint={role === "provider" ? "Required for state-board verification before any patient matching." : "Optional if you hold a license relevant to the role."}
            >
              <ClinicalInput id="join-license" value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} />
            </ClinicalField>
            {role === "provider" ? (
              <>
                <ClinicalField
                  label="Primary license state"
                  htmlFor="join-license-state"
                  hint="2-letter state where this license is active."
                >
                  <ClinicalInput id="join-license-state" value={licenseState} onChange={(event) => setLicenseState(event.target.value.toUpperCase())} maxLength={2} placeholder="OR" />
                </ClinicalField>
                <ClinicalField
                  label="Other licensed states"
                  optional
                  htmlFor="join-licensed-states"
                  hint="Comma-separated state abbreviations. Example: OR, WA, CA."
                >
                  <ClinicalInput id="join-licensed-states" value={licensedStates} onChange={(event) => setLicensedStates(event.target.value.toUpperCase())} placeholder="OR, WA" />
                </ClinicalField>
                <ClinicalField
                  label="Ordering / certifying status"
                  htmlFor="join-ordering-status"
                  hint="Needed before routing patients for labs, imaging, home health, or other ordered services."
                >
                  <select
                    id="join-ordering-status"
                    value={orderingCertifyingStatus}
                    onChange={(event) => setOrderingCertifyingStatus(event.target.value)}
                    className="w-full rounded-[18px] border border-[rgba(82,108,139,0.14)] bg-[rgba(255,255,255,0.92)] px-4 py-3.5 text-sm text-primary shadow-sm transition focus:border-teal/35 focus:outline-none focus:ring-1 focus:ring-teal/15"
                  >
                    <option value="">Select status</option>
                    <option value="medicare-approved">Medicare enrolled / approved</option>
                    <option value="medicare-opt-out">Medicare opt-out / ordering eligible</option>
                    <option value="commercial-only">Commercial plans only</option>
                    <option value="unknown-needs-review">Not sure - needs admin review</option>
                  </select>
                </ClinicalField>
                <ClinicalField
                  label="Professional liability coverage"
                  htmlFor="join-malpractice"
                  hint="Carrier or coverage note. Admin still verifies before approval."
                >
                  <ClinicalInput id="join-malpractice" value={malpracticeCoverage} onChange={(event) => setMalpracticeCoverage(event.target.value)} placeholder="Carrier / policy note" />
                </ClinicalField>
              </>
            ) : null}
          </div>

          {role === "provider" ? (
            <FieldsetCard
              legend="Provider regulatory attestations"
              description="OpenRx does not auto-approve clinicians or bypass patient-state licensure, payer, ordering, or prescription requirements. These attestations route the application to human review."
            >
              <div className="space-y-3">
                <AttestationCheckbox
                  checked={stateLicensureAttestation}
                  onChange={setStateLicensureAttestation}
                  label="I hold an active, unrestricted license in every state where I will treat or order for OpenRx patients, and I understand patient location must be verified before telehealth care."
                />
                <AttestationCheckbox
                  checked={orderingScopeAttestation}
                  onChange={setOrderingScopeAttestation}
                  label="I will only order labs, imaging, referrals, prescriptions, or certifications that are within my license, specialty, payer enrollment, and state scope."
                />
                <AttestationCheckbox
                  checked={noAutoPrescriptionAttestation}
                  onChange={setNoAutoPrescriptionAttestation}
                  label="I understand OpenRx agents may prepare work, but no prescription, diagnostic order, referral, claim, or prior authorization is submitted under my name without my explicit review and approval."
                />
                <AttestationCheckbox
                  checked={malpracticeAttestation}
                  onChange={setMalpracticeAttestation}
                  label="I maintain professional liability coverage appropriate for the services and states listed in this application."
                />
              </div>
            </FieldsetCard>
          ) : null}

          <ClinicalField
            label="Services summary"
            htmlFor="join-services"
            hint="Describe who you serve, the services you offer, and any availability details that matter for matching."
          >
            <ClinicalTextarea
              id="join-services"
              value={servicesSummary}
              onChange={(event) => setServicesSummary(event.target.value)}
              rows={5}
              placeholder="Describe patient populations, services, coverage area, and availability in plain language."
            />
          </ClinicalField>

          <div className="grid gap-5 lg:grid-cols-3">
            <ClinicalField label="City" htmlFor="join-city">
              <ClinicalInput id="join-city" value={city} onChange={(event) => setCity(event.target.value)} />
            </ClinicalField>
            <ClinicalField label="State" htmlFor="join-state" hint="Use the 2-letter abbreviation." >
              <ClinicalInput id="join-state" value={state} onChange={(event) => setState(event.target.value)} maxLength={2} />
            </ClinicalField>
            <ClinicalField label="ZIP" htmlFor="join-zip" hint="5 digits.">
              <ClinicalInput id="join-zip" value={zip} onChange={(event) => setZip(event.target.value)} maxLength={5} />
            </ClinicalField>
          </div>

          {error ? (
            <div className="rounded-[18px] border border-red-200/45 bg-[linear-gradient(180deg,rgba(255,247,246,0.96),rgba(255,239,237,0.92))] px-4 py-3 text-sm leading-6 text-secondary">
              <span className="font-semibold text-primary">Application blocked.</span> {error}
            </div>
          ) : null}

          {submittedId ? (
            <div className="rounded-[18px] border border-[rgba(47,107,255,0.14)] bg-[linear-gradient(180deg,rgba(245,249,255,0.96),rgba(238,245,255,0.92))] px-4 py-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-primary">Application submitted for email review.</p>
                  <p className="mt-1 text-xs leading-6 text-secondary">
                    Reference ID: <span className="font-mono">{submittedId}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void submitApplication()}
              disabled={submitting}
              className={cn("control-button-primary", submitting && "opacity-70")}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              Submit application
            </button>
            <p className="text-xs leading-6 text-muted">OpenRx sends the intake into signed admin review. Nothing goes live automatically.</p>
          </div>
        </div>
      </ClinicalSection>
    </div>
  )
}

function AttestationCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-start gap-3 rounded-[18px] border border-[rgba(82,108,139,0.12)] bg-white/74 p-3 text-sm leading-6 text-secondary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-border accent-teal"
      />
      <span>{label}</span>
    </label>
  )
}
