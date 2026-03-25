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

function isAuthorizedAdminRequest(request: NextRequest): boolean {
  const required = process.env.OPENRX_ADMIN_API_KEY
  if (!required) return false
  const received = request.headers.get("x-admin-api-key") || ""
  return received === required
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized admin request." }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const status = (searchParams.get("status") || undefined) as ApplicationStatus | undefined
  const role = (searchParams.get("role") || undefined) as ApplicantRole | undefined

  const applications = listNetworkApplications({ status, role })
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

    if (body.role === "provider" && !normalizedNpi && !normalizedLicense) {
      return NextResponse.json(
        { error: "providers must provide an NPI or license number." },
        { status: 400 }
      )
    }

    if (normalizedNpi && !/^\d{10}$/.test(normalizedNpi)) {
      return NextResponse.json(
        { error: "npi must be a 10-digit number." },
        { status: 400 }
      )
    }

    const application = submitNetworkApplication({
      role: body.role,
      fullName: body.fullName.trim(),
      email: body.email.trim(),
      phone: body.phone.trim(),
      npi: normalizedNpi || undefined,
      licenseNumber: normalizedLicense || undefined,
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
      deleteNetworkApplication(application.id)
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

    const application = reviewNetworkApplication({
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
