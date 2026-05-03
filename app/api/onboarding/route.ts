import { NextRequest, NextResponse } from "next/server"
import { fetchWithTimeout, isAbortError } from "@/lib/fetch-with-timeout"

interface NpiTaxonomy {
  primary?: boolean
  desc?: string
}

interface NpiVerifyResult {
  number?: string
  basic?: {
    first_name?: string
    last_name?: string
    organization_name?: string
  }
  taxonomies?: NpiTaxonomy[]
}

interface NpiVerifyResponse {
  results?: NpiVerifyResult[]
}

// USPSTF Screening Recommendations
function getScreenings(age: number, gender: string, riskFactors: string[]) {
  const screenings: { name: string; frequency: string; due: boolean; reason: string }[] = []

  // Blood Pressure — all adults
  screenings.push({ name: "Blood Pressure Check", frequency: "Annually", due: true, reason: "Recommended for all adults" })

  // Depression — all adults
  screenings.push({ name: "Depression Screening (PHQ-9)", frequency: "Annually", due: true, reason: "Recommended for all adults" })

  // Hepatitis C — 18-79 (one-time)
  if (age >= 18 && age <= 79) {
    screenings.push({ name: "Hepatitis C Screening", frequency: "One-time", due: true, reason: "Recommended once for adults 18-79" })
  }

  // HIV — 15-65
  if (age >= 15 && age <= 65) {
    screenings.push({ name: "HIV Screening", frequency: "One-time or as needed", due: true, reason: "Recommended for adults 15-65" })
  }

  // Diabetes — 35-70 if overweight
  if (age >= 35 && age <= 70) {
    screenings.push({ name: "Diabetes Screening (A1C/Fasting Glucose)", frequency: "Every 3 years", due: true, reason: "Adults 35-70, especially if overweight" })
  }

  // Cholesterol — men 35+, women 45+
  if ((gender === "male" && age >= 35) || (gender === "female" && age >= 45)) {
    screenings.push({ name: "Lipid Panel (Cholesterol)", frequency: "Every 5 years", due: true, reason: `Recommended for ${gender === "male" ? "men 35+" : "women 45+"}` })
  }

  // Colorectal — 45-75 routine, 76-85 individualized
  if (age >= 45 && age <= 75) {
    screenings.push({ name: "Colorectal Cancer Screening", frequency: "Every 10 years (colonoscopy) or alternatives", due: true, reason: "Recommended for adults 45-75" })
  } else if (age >= 76 && age <= 85) {
    screenings.push({ name: "Colorectal Cancer Screening Review", frequency: "Shared decision", due: true, reason: "Individualize based on prior screening and health status" })
  }

  // Mammogram — women 40+
  if (gender === "female" && age >= 40) {
    screenings.push({ name: "Mammogram", frequency: "Every 2 years", due: true, reason: "Recommended for women 40+" })
  }

  // Cervical — women 21-65
  if (gender === "female" && age >= 21 && age <= 65) {
    screenings.push({ name: "Cervical Cancer Screening (Pap/HPV)", frequency: "Every 3-5 years", due: true, reason: "Recommended for women 21-65" })
  }

  // Lung cancer — 50-80 with qualifying smoking history
  if (age >= 50 && age <= 80 && riskFactors.includes("smoking")) {
    screenings.push({ name: "Low-Dose CT Lung Cancer Screening", frequency: "Annually if pack-year criteria are met", due: true, reason: "Recommended for adults 50-80 with heavy smoking history who currently smoke or quit within 15 years" })
  }

  // Osteoporosis — women 65+
  if (gender === "female" && age >= 65) {
    screenings.push({ name: "Bone Density (DEXA) Scan", frequency: "Every 2 years", due: true, reason: "Recommended for women 65+" })
  }

  // AAA — men 65-75 who smoked
  if (gender === "male" && age >= 65 && age <= 75 && riskFactors.includes("smoking")) {
    screenings.push({ name: "Abdominal Aortic Aneurysm Ultrasound", frequency: "One-time", due: true, reason: "Recommended for men 65-75 with smoking history" })
  }

  return screenings
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { step, data } = body as {
      step: string
      data: Record<string, unknown>
    }

    switch (step) {
      case "screenings": {
        const age = Number(data.age) || 30
        const gender = String(data.gender || "").toLowerCase()
        const riskFactors = (data.riskFactors as string[]) || []
        const screenings = getScreenings(age, gender, riskFactors)
        return NextResponse.json({ screenings })
      }

      case "verify-provider": {
        const npi = String(data.npi || "")
        if (!npi) return NextResponse.json({ error: "NPI required" }, { status: 400 })
        if (!/^\d{10}$/.test(npi)) {
          return NextResponse.json({ error: "NPI must be a 10-digit number." }, { status: 400 })
        }
        const res = await fetchWithTimeout(
          `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${npi}`,
          {},
          9000
        )
        const result = (await res.json()) as NpiVerifyResponse
        const provider = result.results?.[0]
        if (!provider) return NextResponse.json({ found: false })
        const basic = provider.basic || {}
        const taxonomy = provider.taxonomies?.find((t) => t.primary) || provider.taxonomies?.[0] || {}
        return NextResponse.json({
          found: true,
          name: `${basic.first_name || ""} ${basic.last_name || ""}`.trim() || basic.organization_name || "",
          specialty: taxonomy.desc || "",
          npi: provider.number,
        })
      }

      default:
        return NextResponse.json({ error: "Unknown step" }, { status: 400 })
    }
  } catch (error) {
    if (isAbortError(error)) {
      return NextResponse.json({ error: "Provider verification timed out. Please try again." }, { status: 504 })
    }
    console.error("Onboarding API error:", error)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}
