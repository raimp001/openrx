import { prisma } from "@/lib/db"
import { getDatabaseHealth } from "@/lib/database-health"
import { createEmptyLiveSnapshot, type LiveClaim, type LiveLabResult, type LiveSnapshot, type LiveVital } from "@/lib/live-data-types"

let hasWarnedMissingDatabaseUrl = false

function normalizeAddress(address?: string | null): string {
  return (address || "").trim().toLowerCase()
}

function toDateString(value: Date | null | undefined): string {
  return value ? value.toISOString() : ""
}

function parseBloodPressure(bp?: string | null): { systolic?: number; diastolic?: number } {
  if (!bp) return {}
  const [sys, dia] = bp.split("/").map((part) => Number.parseInt(part.trim(), 10))
  return {
    systolic: Number.isFinite(sys) ? sys : undefined,
    diastolic: Number.isFinite(dia) ? dia : undefined,
  }
}

function toFahrenheit(celsius?: number | null): number | undefined {
  if (typeof celsius !== "number") return undefined
  return Math.round((celsius * 9) / 5 + 32)
}

function kgToLbs(kg?: number | null): number | undefined {
  if (typeof kg !== "number") return undefined
  return Math.round(kg * 2.20462 * 10) / 10
}

function parseLabRows(raw: unknown, isAbnormal: boolean): LiveLabResult["results"] {
  if (Array.isArray(raw)) {
    const parsed: LiveLabResult["results"] = []
    for (const item of raw) {
      if (!item || typeof item !== "object") continue
      const row = item as Record<string, unknown>
      const value = row.value ?? row.result ?? row.measurement
      if (value === undefined || value === null) continue
      const flagRaw = String(row.flag || row.status || (isAbnormal ? "high" : "normal")).toLowerCase()
      const flag: LiveLabResult["results"][number]["flag"] =
        flagRaw === "critical" ? "critical" : flagRaw === "high" ? "high" : flagRaw === "low" ? "low" : "normal"
      parsed.push({
        name: String(row.name || row.test || "Result"),
        value: String(value),
        unit: row.unit ? String(row.unit) : undefined,
        reference_range: row.reference_range ? String(row.reference_range) : row.reference ? String(row.reference) : undefined,
        flag,
      })
    }
    return parsed
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([name, value]) => ({
      name,
      value: String(value ?? ""),
      flag: isAbnormal ? "high" : "normal",
    }))
  }

  return []
}

function mapPaymentClaims(params: {
  patientId: string
  payments: Array<{
    id: string
    appointmentId: string | null
    amount: number
    status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED"
    createdAt: Date
    updatedAt: Date
    metadata: unknown
  }>
}): LiveClaim[] {
  return params.payments.map((payment) => {
    const loweredStatus = payment.status.toLowerCase()
    const denied = payment.status === "FAILED"
    const paid = payment.status === "COMPLETED" || payment.status === "REFUNDED"
    const metadata = payment.metadata && typeof payment.metadata === "object" ? (payment.metadata as Record<string, unknown>) : {}

    return {
      id: payment.id,
      patient_id: params.patientId,
      appointment_id: payment.appointmentId || "",
      claim_number: `CLM-${payment.id.slice(-8).toUpperCase()}`,
      status: denied ? "denied" : paid ? "paid" : loweredStatus === "pending" ? "submitted" : loweredStatus,
      total_amount: payment.amount,
      insurance_paid: paid ? payment.amount : 0,
      patient_responsibility: 0,
      cpt_codes: Array.isArray(metadata.cpt_codes) ? metadata.cpt_codes.map((item) => String(item)) : [],
      icd_codes: Array.isArray(metadata.icd_codes) ? metadata.icd_codes.map((item) => String(item)) : [],
      date_of_service: payment.createdAt.toISOString(),
      submitted_at: payment.createdAt.toISOString(),
      resolved_at: paid || denied ? payment.updatedAt.toISOString() : null,
      denial_reason: denied ? "Payment verification failed" : null,
      errors_detected: denied
        ? [
            {
              type: "payment_failed",
              description: "Payment failed verification or settlement.",
              severity: "high",
            },
          ]
        : [],
      notes: typeof metadata.notes === "string" ? metadata.notes : "Generated from verified payment ledger.",
    }
  })
}

export async function getLiveSnapshotByWallet(walletAddress?: string | null): Promise<LiveSnapshot> {
  const normalizedWallet = normalizeAddress(walletAddress)
  if (!normalizedWallet) return createEmptyLiveSnapshot(null)

  const databaseHealth = await getDatabaseHealth()
  if (!databaseHealth.reachable) {
    if (!hasWarnedMissingDatabaseUrl) {
      hasWarnedMissingDatabaseUrl = true
      console.warn(
        `Live data unavailable. ${databaseHealth.message} Running without patient data until Postgres is reachable.`
      )
    }
    return createEmptyLiveSnapshot(normalizedWallet)
  }

  try {

    const user = await prisma.user.findFirst({
      where: { walletAddress: { equals: normalizedWallet, mode: "insensitive" } },
      include: {
        patientProfile: {
          include: {
            appointments: {
              include: {
                doctor: { include: { user: true } },
              },
              orderBy: { scheduledAt: "asc" },
            },
            prescriptions: {
              include: {
                doctor: { include: { user: true } },
                medications: true,
              },
              orderBy: { issuedAt: "desc" },
            },
            labResults: {
              orderBy: { testDate: "desc" },
            },
            vitalSigns: {
              orderBy: { recordedAt: "desc" },
            },
            medicalRecords: {
              orderBy: { recordDate: "desc" },
            },
          },
        },
        sentMessages: {
          include: {
            receiver: { include: { doctorProfile: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        receivedMessages: {
          include: {
            sender: { include: { doctorProfile: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

  const base = createEmptyLiveSnapshot(normalizedWallet)
  if (!user?.patientProfile) return base

  const patient = user.patientProfile

  const doctors = await prisma.doctorProfile.findMany({
    include: { user: true },
    orderBy: [{ isVerified: "desc" }, { updatedAt: "desc" }],
  })

  const physicians = doctors.map((doctor) => ({
    id: doctor.id,
    email: doctor.user.email,
    full_name: doctor.user.name || "Unknown clinician",
    specialty: doctor.specialty,
    credentials: doctor.licenseNumber,
    phone: doctor.user.walletAddress || "",
    available_days: [],
    available_start: "",
    available_end: "",
  }))

  const primaryPhysicianId = patient.appointments[0]?.doctorId || patient.prescriptions[0]?.doctorId || ""

  const mergedMessages = [
    ...user.sentMessages.map((message) => ({ ...message, direction: "outbound" as const })),
    ...user.receivedMessages.map((message) => ({ ...message, direction: "inbound" as const })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  const vitals: LiveVital[] = patient.vitalSigns.map((vital) => {
    const bp = parseBloodPressure(vital.bloodPressure)
    return {
      id: vital.id,
      patient_id: patient.id,
      recorded_at: vital.recordedAt.toISOString(),
      systolic: bp.systolic,
      diastolic: bp.diastolic,
      heart_rate: vital.heartRate || undefined,
      blood_glucose: undefined,
      weight_lbs: kgToLbs(vital.weight),
      oxygen_saturation: typeof vital.oxygenSaturation === "number" ? Math.round(vital.oxygenSaturation) : undefined,
      temperature_f: toFahrenheit(vital.temperature),
      source: "clinic",
    }
  })

  const labs: LiveLabResult[] = patient.labResults.map((lab) => ({
    id: lab.id,
    patient_id: patient.id,
    physician_id: primaryPhysicianId,
    test_name: lab.testName,
    category: "Laboratory",
    lab_facility: lab.orderedBy || "External Lab",
    ordered_at: lab.testDate.toISOString(),
    resulted_at: lab.testDate.toISOString(),
    status: lab.isAbnormal ? "reviewed" : "reviewed",
    results: parseLabRows(lab.results, lab.isAbnormal),
    notes: lab.notes || "",
  }))

  const vaccinations = patient.medicalRecords
    .filter((record) => record.recordType.toLowerCase().includes("vacc"))
    .map((record) => ({
      id: record.id,
      patient_id: patient.id,
      vaccine_name: record.title,
      brand: "Recorded vaccine",
      dose_number: 1,
      total_doses: 1,
      administered_at: record.recordDate.toISOString(),
      due_at: null,
      next_due: null,
      status: "completed" as const,
      facility: "Recorded",
      administered_by: "Care team",
      lot_number: "N/A",
      site: "N/A",
      notes: record.description || "",
    }))

  const referrals = patient.medicalRecords
    .filter((record) => record.recordType.toLowerCase().includes("referral"))
    .map((record) => ({
      id: record.id,
      patient_id: patient.id,
      physician_id: primaryPhysicianId,
      referring_physician_id: primaryPhysicianId,
      specialist_name: record.title,
      specialist_specialty: record.description || "Specialist",
      reason: record.description || "Referral",
      status: "pending" as const,
      insurance_authorized: false,
      referred_at: record.recordDate.toISOString(),
      created_at: record.recordDate.toISOString(),
      appointment_at: null,
      appointment_date: null,
      specialist_phone: "",
      urgency: "routine" as const,
      notes: "",
    }))

    return {
    ...base,
    patient: {
      id: patient.id,
      full_name: user.name || "",
      date_of_birth: toDateString(patient.dateOfBirth),
      gender: patient.gender || "",
      phone: patient.phone || "",
      email: user.email,
      address: patient.address || "",
      insurance_provider: patient.insuranceProvider || "",
      insurance_plan: "",
      insurance_id: patient.insuranceId || "",
      emergency_contact_name: patient.emergencyContact || "",
      emergency_contact_phone: "",
      medical_history: patient.medicalRecords
        .filter((record) => record.recordType.toLowerCase().includes("diagn") || record.recordType.toLowerCase().includes("condition"))
        .map((record) => ({
          condition: record.title,
          diagnosed: record.recordDate.toISOString().slice(0, 10),
          status: "active",
        })),
      allergies: patient.allergies,
      primary_physician_id: primaryPhysicianId,
      created_at: patient.createdAt.toISOString(),
    },
    physicians,
    appointments: patient.appointments.map((appointment) => ({
      id: appointment.id,
      patient_id: patient.id,
      physician_id: appointment.doctorId,
      scheduled_at: appointment.scheduledAt.toISOString(),
      duration_minutes: appointment.duration,
      type: appointment.type,
      status: appointment.status.toLowerCase().replaceAll("_", "-"),
      reason: appointment.reason || "",
      notes: appointment.notes || "",
      copay: appointment.paymentAmount || 0,
    })),
    claims: mapPaymentClaims({
      patientId: patient.id,
      payments: user.payments.map((payment) => ({
        id: payment.id,
        appointmentId: payment.appointmentId,
        amount: payment.amount,
        status: payment.status,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        metadata: payment.metadata,
      })),
    }),
    prescriptions: patient.prescriptions.flatMap((prescription) => {
      const status = prescription.status.toLowerCase()
      const medications = prescription.medications.length > 0
        ? prescription.medications
        : [
            {
              id: `${prescription.id}-med`,
              name: "Medication",
              dosage: "",
              frequency: "",
              instructions: "",
              refills: 0,
              createdAt: prescription.issuedAt,
            },
          ]

      return medications.map((medication) => ({
        id: `${prescription.id}-${medication.id}`,
        patient_id: patient.id,
        physician_id: prescription.doctorId,
        medication_name: medication.name,
        dosage: medication.dosage,
        frequency: medication.frequency,
        start_date: prescription.issuedAt.toISOString(),
        end_date: prescription.expiresAt ? prescription.expiresAt.toISOString() : null,
        refills_remaining: medication.refills,
        pharmacy: "",
        status,
        adherence_pct: 100,
        last_filled: medication.createdAt.toISOString(),
        notes: prescription.notes || medication.instructions || "",
      }))
    }),
    priorAuths: [],
    messages: mergedMessages.map((message) => {
      const counterpart = message.direction === "inbound" ? message.sender : message.receiver
      const physicianId = counterpart?.doctorProfile?.id || null
      const senderType = message.direction === "outbound"
        ? "patient"
        : counterpart?.doctorProfile
        ? "physician"
        : counterpart?.role === "ADMIN"
        ? "system"
        : "agent"

      return {
        id: message.id,
        patient_id: patient.id,
        physician_id: physicianId,
        sender_type: senderType,
        content: message.content,
        channel: "portal",
        read: message.direction === "outbound" ? true : message.status === "READ",
        created_at: message.createdAt.toISOString(),
      }
    }),
    labResults: labs,
    vitals,
    vaccinations,
    referrals,
    }
  } catch (error) {
    const isDemoMode = !process.env.DATABASE_URL
    console.error(
      isDemoMode
        ? "No DATABASE_URL — returning empty snapshot."
        : "Failed to load live snapshot from database.",
      isDemoMode ? "" : error
    )
    return createEmptyLiveSnapshot(normalizedWallet)
  }
}
