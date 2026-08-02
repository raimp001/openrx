import { NextResponse } from "next/server"
import { commitmentPilotService } from "@/lib/commitments/service"

export const dynamic = "force-dynamic"

export async function GET() {
  const config = commitmentPilotService.getConfig()
  return NextResponse.json({
    enabled: config.enabled,
    network: config.enabled ? config.network : null,
    flags: config.flags,
    terms: config.enabled
      ? {
          depositAmountMinor: config.terms.depositAmountMinor,
          cancellationFeeMinor: config.terms.cancellationFeeMinor,
          completionFeeMinor: config.terms.completionFeeMinor,
          initialWindowDays: config.terms.initialWindowDays,
          extensionDays: config.terms.extensionDays,
          maximumExtensions: config.terms.maximumExtensions,
          consentVersion: config.terms.consentVersion,
        }
      : null,
  })
}
