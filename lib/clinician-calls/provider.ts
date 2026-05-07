import { createMockCallProvider } from "./mock-provider"
import type { CallProvider } from "./types"

let cached: CallProvider | null = null

// Resolve the active call provider. Today only the mock provider is supported.
//
// Before adding a real provider (Twilio, Bandwidth, etc.):
//   - Confirm a signed BAA is in place for the OpenRx organization.
//   - Provision masked outbound caller IDs in the provider console and verify
//     they cannot leak the clinician's personal number.
//   - Implement provider-specific API auth here using server-only env vars
//     (never NEXT_PUBLIC_*).
//   - Add CDR export to the OpenRx audit log.
//   - Add per-clinician rate limiting and abuse detection.
//   - Add explicit two-party-consent recording flow if recording is enabled.
//   - Pass a security review covering PHI handling and retention.
export function getCallProvider(): CallProvider {
  if (cached) return cached
  const key = (process.env.OPENRX_CALL_PROVIDER || "mock").toLowerCase()
  switch (key) {
    case "mock":
    default:
      cached = createMockCallProvider()
      return cached
  }
}
