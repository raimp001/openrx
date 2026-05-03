import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function fahrenheitToCelsius(f: number): number {
  return Math.round(((f - 32) * 5) / 9 * 10) / 10
}

function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 10) / 10
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const walletAddress = typeof b.walletAddress === "string" ? b.walletAddress.trim().toLowerCase() : ""

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 })
  }

  const user = await prisma.user.findFirst({
    where: { walletAddress: { equals: walletAddress, mode: "insensitive" } },
    include: { patientProfile: true },
  })

  if (!user?.patientProfile) {
    return NextResponse.json({ error: "Patient profile not found" }, { status: 404 })
  }

  const patientId = user.patientProfile.id

  const systolic = typeof b.systolic === "number" ? b.systolic : null
  const diastolic = typeof b.diastolic === "number" ? b.diastolic : null
  const heartRate = typeof b.heartRate === "number" ? b.heartRate : null
  const temperatureF = typeof b.temperatureF === "number" ? b.temperatureF : null
  const weightLbs = typeof b.weightLbs === "number" ? b.weightLbs : null
  const oxygenSaturation = typeof b.oxygenSaturation === "number" ? b.oxygenSaturation : null
  const bloodGlucose = typeof b.bloodGlucose === "number" ? b.bloodGlucose : null
  const respiratoryRate = typeof b.respiratoryRate === "number" ? b.respiratoryRate : null
  const notes = typeof b.notes === "string" ? b.notes.slice(0, 500) : null

  const hasAnyVital = systolic || diastolic || heartRate || temperatureF || weightLbs || oxygenSaturation || bloodGlucose || respiratoryRate
  if (!hasAnyVital) {
    return NextResponse.json({ error: "At least one vital sign measurement is required" }, { status: 400 })
  }

  if (systolic && (systolic < 50 || systolic > 300)) {
    return NextResponse.json({ error: "Systolic blood pressure must be between 50 and 300 mmHg" }, { status: 400 })
  }
  if (diastolic && (diastolic < 20 || diastolic > 200)) {
    return NextResponse.json({ error: "Diastolic blood pressure must be between 20 and 200 mmHg" }, { status: 400 })
  }
  if (heartRate && (heartRate < 20 || heartRate > 300)) {
    return NextResponse.json({ error: "Heart rate must be between 20 and 300 bpm" }, { status: 400 })
  }
  if (temperatureF && (temperatureF < 85 || temperatureF > 115)) {
    return NextResponse.json({ error: "Temperature must be between 85 and 115 °F" }, { status: 400 })
  }
  if (weightLbs && (weightLbs < 1 || weightLbs > 1500)) {
    return NextResponse.json({ error: "Weight must be between 1 and 1500 lbs" }, { status: 400 })
  }
  if (oxygenSaturation && (oxygenSaturation < 50 || oxygenSaturation > 100)) {
    return NextResponse.json({ error: "Oxygen saturation must be between 50% and 100%" }, { status: 400 })
  }

  try {
    const bloodPressure = systolic && diastolic ? `${systolic}/${diastolic}` : null
    const temperatureC = temperatureF ? fahrenheitToCelsius(temperatureF) : null
    const weightKg = weightLbs ? lbsToKg(weightLbs) : null

    const heightCm = user.patientProfile.id
      ? (await prisma.vitalSign.findFirst({
          where: { patientId, height: { not: null } },
          orderBy: { recordedAt: "desc" },
          select: { height: true },
        }))?.height
      : null

    const bmi = weightKg && heightCm ? Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10 : null

    const vital = await prisma.vitalSign.create({
      data: {
        patientId,
        bloodPressure,
        heartRate,
        temperature: temperatureC,
        respiratoryRate,
        oxygenSaturation,
        weight: weightKg,
        bmi,
        notes,
      },
    })

    const alerts: string[] = []
    if (systolic && systolic >= 180) alerts.push("Critical: Systolic BP is dangerously high (≥180 mmHg). Seek immediate care.")
    else if (systolic && systolic >= 140) alerts.push("Your systolic blood pressure is elevated (≥140 mmHg). Discuss with your care team.")
    if (diastolic && diastolic >= 120) alerts.push("Critical: Diastolic BP is dangerously high (≥120 mmHg). Seek immediate care.")
    if (heartRate && heartRate > 120) alerts.push("Your heart rate is elevated. If you feel dizzy or short of breath, seek care.")
    if (heartRate && heartRate < 40) alerts.push("Your heart rate is unusually low. Contact your care team if you feel faint.")
    if (oxygenSaturation && oxygenSaturation < 92) alerts.push("Your oxygen level is low (<92%). Contact your care team promptly.")
    if (temperatureF && temperatureF >= 103) alerts.push("You have a high fever (≥103°F). Seek medical attention.")
    if (bloodGlucose && bloodGlucose > 300) alerts.push("Blood glucose is very high (>300 mg/dL). Contact your care team.")
    if (bloodGlucose && bloodGlucose < 54) alerts.push("Blood glucose is critically low (<54 mg/dL). Treat hypoglycemia immediately.")

    return NextResponse.json({
      vital: {
        id: vital.id,
        recordedAt: vital.recordedAt.toISOString(),
        bloodPressure: vital.bloodPressure,
        heartRate: vital.heartRate,
        temperatureF,
        weightLbs,
        oxygenSaturation: vital.oxygenSaturation,
        respiratoryRate: vital.respiratoryRate,
        bmi: vital.bmi,
      },
      alerts,
    }, { status: 201 })
  } catch (error) {
    console.error("Error recording vital signs:", error)
    return NextResponse.json({ error: "Failed to record vital signs" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ("response" in auth) return auth.response

  const { searchParams } = new URL(request.url)
  const walletAddress = (searchParams.get("walletAddress") || "").trim().toLowerCase()
  const limitRaw = parseInt(searchParams.get("limit") || "30")
  const limit = Math.min(Math.max(limitRaw || 30, 1), 100)

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress query parameter is required" }, { status: 400 })
  }

  try {
    const user = await prisma.user.findFirst({
      where: { walletAddress: { equals: walletAddress, mode: "insensitive" } },
      include: { patientProfile: true },
    })

    if (!user?.patientProfile) {
      return NextResponse.json({ error: "Patient profile not found" }, { status: 404 })
    }

    const vitals = await prisma.vitalSign.findMany({
      where: { patientId: user.patientProfile.id },
      orderBy: { recordedAt: "desc" },
      take: limit,
    })

    return NextResponse.json({
      vitals: vitals.map((v) => ({
        id: v.id,
        recordedAt: v.recordedAt.toISOString(),
        bloodPressure: v.bloodPressure,
        heartRate: v.heartRate,
        temperature: v.temperature,
        respiratoryRate: v.respiratoryRate,
        oxygenSaturation: v.oxygenSaturation,
        weight: v.weight,
        bmi: v.bmi,
        notes: v.notes,
      })),
    })
  } catch (error) {
    console.error("Error fetching vital signs:", error)
    return NextResponse.json({ error: "Failed to fetch vital signs" }, { status: 500 })
  }
}
