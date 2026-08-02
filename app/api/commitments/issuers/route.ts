import { NextResponse } from "next/server"
import { commitmentFeatureUnavailable } from "@/lib/commitments/api"
import { getCommitmentFeatureFlags } from "@/lib/commitments/flags"
import { getSandboxTrustedIssuerRegistry } from "@/lib/commitments/mock-adapters"

export async function GET() {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable || !getCommitmentFeatureFlags().privateCompletionCredentials) {
    return unavailable ?? NextResponse.json({ issuers: [] }, { status: 404 })
  }
  return NextResponse.json({
    issuers: getSandboxTrustedIssuerRegistry(),
    productionTrustClaim: false,
  })
}
