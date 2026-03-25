import { requireAuth } from "@/lib/api-auth"
/**
 * PA Criteria Evaluation API
 * POST /api/pa/evaluate   — evaluate approval likelihood for a drug/procedure
 * GET  /api/pa/evaluate   — list supported drug classes
 */

import { NextRequest, NextResponse } from "next/server"
import { evaluatePACriteria, getPayerOverride, DRUG_RULES } from "@/lib/payer-rules/engine"

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request); if ("response" in auth) return auth.response;
  try {
    const body = await request.json() as {
      drugName?: string
      hcpcsCode?: string
      icd10Codes?: string[]
      priorTherapies?: string[]
      clinicalNotes?: string
      ecogScore?: number
      payer?: string
    }

    const evaluation = evaluatePACriteria({
      drugName: body.drugName,
      hcpcsCode: body.hcpcsCode,
      icd10Codes: body.icd10Codes ?? [],
      priorTherapies: body.priorTherapies ?? [],
      clinicalNotes: body.clinicalNotes ?? "",
      ecogScore: body.ecogScore,
      payer: body.payer ?? "",
    })

    // Enrich with payer-specific override if payer provided
    if (body.payer && evaluation.found && evaluation.drugClass) {
      const override = getPayerOverride(body.payer, evaluation.drugClass)
      if (override) evaluation.payerOverride = override
    }

    return NextResponse.json(evaluation)
  } catch (error) {
    return NextResponse.json({ error: "Evaluation failed", details: String(error) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    supportedDrugs: DRUG_RULES.map((r) => ({
      drugClass: r.drugClass,
      brandNames: r.brandNames,
      genericNames: r.genericNames,
      hcpcsCodes: r.hcpcsCodes,
      nccnCategory: r.nccnCategory,
      indicationCount: r.indicationsDx.length,
      criteriaCount: r.criteria.length,
    })),
    version: "2024.Q4",
    sources: ["LCD/NCD", "NCCN Guidelines", "FDA-approved labeling", "ACR/AAD/ADA guidelines"],
  })
}
