import { NextRequest, NextResponse } from "next/server"
import {
  deleteNetworkApplication,
  listNetworkApplications,
  reviewNetworkApplication,
  submitNetworkApplication,
  type ApplicantRole,
  type ApplicationStatus,
} from "@/lib/provider-applications"
import { sendAdminApplicationEmail } from "@/lib/admin-email"

const ORDERING_CERTIFYING_STATUSES = new Set([
  "medicare-approved",
  "medicare-opt-out",
  "commercial-only",
  "unknown-needs-review",
])

function isAuthorizedAdminRequest(request: NextRequest): boolean {
  const required = process.env.OPENRX_ADMIN_API_KEY
  if (!required) return false
  const received = request.headers.get("x-admin-api-key") || ""
  return received === required
}

function parseStateList(value?: string | string[]): string[] {
  const raw = Array.isArray(value) ? value.join(",") : value || ""
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
    )
  )
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized admin request." }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const status = (searchParams.get("status") || undefined) as ApplicationStatus | undefined
  const role = (searchParams.get("role") || undefined) as ApplicantRole | undefined

  const applications = await listNetworkApplications({ status, role })
  return NextResponse.json({
    applications,
    total: applications.length,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      role?: ApplicantRole
      fullName?: string
      email?: string
      phone?: string
      npi?: string
      licenseNumber?: string
      licenseState?: string
      licensedStates?: string[] | string
      orderingCertifyingStatus?: string
      malpracticeCoverage?: string
      stateLicensureAttestation?: boolean
      orderingScopeAttestation?: boolean
      noAutoPrescriptionAttestation?: boolean
      malpracticeAttestation?: boolean
      specialtyOrRole?: string
      servicesSummary?: string
      city?: string
      state?: string
      zip?: string
    }

    if (
      !body.role ||
      !body.fullName ||
      !body.email ||
      !body.phone ||
      !body.specialtyOrRole ||
      !body.servicesSummary ||
      !body.city ||
      !body.state ||
      !body.zip
    ) {
      return NextResponse.json(
        {
          error:
            "role, fullName, email, phone, specialtyOrRole, servicesSummary, city, state, and zip are required.",
        },
        { status: 400 }
      )
    }

    if (body.role !== "provider" && body.role !== "caregiver") {
      return NextResponse.json(
        { error: "role must be either provider or caregiver." },
        { status: 400 }
      )
    }

    const normalizedState = body.state.trim().toUpperCase()
    const normalizedZip = body.zip.trim()
    const normalizedNpi = (body.npi || "").trim()
    const normalizedLicense = (body.licenseNumber || "").trim()
    const normalizedLicenseState = (body.licenseState || "").trim().toUpperCase()
    const licensedStates = parseStateList(body.licensedStates)
    const orderingCertifyingStatus = (body.orderingCertifyingStatus || "").trim()
    const malpracticeCoverage = (body.malpracticeCoverage || "").trim()

    if (!/^[A-Z]{2}$/.test(normalizedState)) {
      return NextResponse.json(
        { error: "state must be a 2-letter abbreviation." },
        { status: 400 }
      )
    }

    if (!/^\d{5}$/.test(normalizedZip)) {
      return NextResponse.json(
        { error: "zip must be a 5-digit ZIP code." },
        { status: 400 }
      )
    }

    if (body.role === "provider" && !normalizedNpi) {
      return NextResponse.json(
        { error: "providers must provide an individual NPI for verification." },
        { status: 400 }
      )
    }

    if (body.role === "provider" && !normalizedLicense) {
      return NextResponse.json(
        { error: "providers must provide a license number for state-board verification." },
        { status: 400 }
      )
    }

    if (body.role === "provider" && !normalizedLicenseState) {
      return NextResponse.json(
        { error: "providers must provide the primary license state." },
        { status: 400 }
      )
    }

    if (normalizedNpi && !/^\d{10}$/.test(normalizedNpi)) {
      return NextResponse.json(
        { error: "npi must be a 10-digit number." },
        { status: 400 }
      )
    }

    if (normalizedLicenseState && !/^[A-Z]{2}$/.test(normalizedLicenseState)) {
      return NextResponse.json(
        { error: "licenseState must be a 2-letter state abbreviation." },
        { status: 400 }
      )
    }

    if (licensedStates.some((item) => !/^[A-Z]{2}$/.test(item))) {
      return NextResponse.json(
        { error: "licensedStates must contain 2-letter state abbreviations." },
        { status: 400 }
      )
    }

    const resolvedLicensedStates = Array.from(
      new Set([normalizedLicenseState, ...licensedStates].filter(Boolean))
    )

    if (body.role === "provider" && !ORDERING_CERTIFYING_STATUSES.has(orderingCertifyingStatus)) {
      return NextResponse.json(
        { error: "providers must select a valid ordering/certifying status." },
        { status: 400 }
      )
    }

    if (
      body.role === "provider" &&
      (!body.stateLicensureAttestation ||
        !body.orderingScopeAttestation ||
        !body.noAutoPrescriptionAttestation ||
        !body.malpracticeAttestation)
    ) {
      return NextResponse.json(
        {
          error:
            "providers must attest to state licensure, ordering scope, human review before scripts/orders, and professional liability coverage.",
        },
        { status: 400 }
      )
    }

    const application = await submitNetworkApplication({
      role: body.role,
      fullName: body.fullName.trim(),
      email: body.email.trim(),
      phone: body.phone.trim(),
      npi: normalizedNpi || undefined,
      licenseNumber: normalizedLicense || undefined,
      licenseState: normalizedLicenseState || undefined,
      licensedStates: resolvedLicensedStates.length > 0 ? resolvedLicensedStates : undefined,
      orderingCertifyingStatus: orderingCertifyingStatus || undefined,
      malpracticeCoverage: malpracticeCoverage || undefined,
      stateLicensureAttestation: Boolean(body.stateLicensureAttestation),
      orderingScopeAttestation: Boolean(body.orderingScopeAttestation),
      noAutoPrescriptionAttestation: Boolean(body.noAutoPrescriptionAttestation),
      malpracticeAttestation: Boolean(body.malpracticeAttestation),
      specialtyOrRole: body.specialtyOrRole.trim(),
      servicesSummary: body.servicesSummary.trim(),
      city: body.city.trim(),
      state: normalizedState,
      zip: normalizedZip,
    })
    try {
      await sendAdminApplicationEmail({
        application,
        origin: new URL(request.url).origin,
      })
    } catch (issue) {
      await deleteNetworkApplication(application.id)
      throw new Error(
        issue instanceof Error
          ? `Application was not submitted because admin email delivery failed: ${issue.message}`
          : "Application was not submitted because admin email delivery failed."
      )
    }

    return NextResponse.json({ application }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit application."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized admin request." }, { status: 401 })
  }
  try {
    const body = (await request.json()) as {
      applicationId?: string
      decision?: "approved" | "rejected"
      reviewer?: string
      notes?: string
    }

    if (!body.applicationId || !body.decision || !body.reviewer) {
      return NextResponse.json(
        { error: "applicationId, decision, and reviewer are required." },
        { status: 400 }
      )
    }

    const application = await reviewNetworkApplication({
      applicationId: body.applicationId,
      decision: body.decision,
      reviewer: body.reviewer,
      notes: body.notes,
    })

    return NextResponse.json({ application })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to review application."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
