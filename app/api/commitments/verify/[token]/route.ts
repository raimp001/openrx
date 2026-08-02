import { NextResponse } from "next/server"
import { commitmentApiError, commitmentFeatureUnavailable } from "@/lib/commitments/api"
import { getCommitmentFeatureFlags } from "@/lib/commitments/flags"
import { commitmentPilotService } from "@/lib/commitments/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const unavailable = commitmentFeatureUnavailable()
  if (unavailable || !getCommitmentFeatureFlags().insurerVerifierDemo) {
    return unavailable ?? NextResponse.json({ error: { code: "disabled", message: "Verifier demonstration is disabled." } }, { status: 404 })
  }
  try {
    return NextResponse.json(await commitmentPilotService.verifyShare(params.token))
  } catch (error) {
    return commitmentApiError(error)
  }
}
