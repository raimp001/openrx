export const COMMITMENT_FEATURE_FLAGS = [
  "SCREENING_COMMITMENT_PILOT",
  "COINBASE_ONRAMP_PILOT",
  "PRIVATE_COMPLETION_CREDENTIALS",
  "INSURER_VERIFIER_DEMO",
] as const

export type CommitmentFeatureFlag = (typeof COMMITMENT_FEATURE_FLAGS)[number]

function enabled(value?: string): boolean {
  return (value || "").trim().toLowerCase() === "true"
}

export function isCommitmentFeatureEnabled(flag: CommitmentFeatureFlag): boolean {
  if (!enabled(process.env[flag])) return false

  // A feature flag must never make this pilot live on the production domain.
  // Vercel preview deployments may opt in with the explicit sandbox marker.
  if (process.env.NODE_ENV === "production") {
    return process.env.VERCEL_ENV !== "production" && enabled(process.env.OPENRX_COMMITMENT_SANDBOX)
  }

  return true
}

export function getCommitmentFeatureFlags() {
  return {
    screeningCommitmentPilot: isCommitmentFeatureEnabled("SCREENING_COMMITMENT_PILOT"),
    coinbaseOnrampPilot: isCommitmentFeatureEnabled("COINBASE_ONRAMP_PILOT"),
    privateCompletionCredentials: isCommitmentFeatureEnabled("PRIVATE_COMPLETION_CREDENTIALS"),
    insurerVerifierDemo: isCommitmentFeatureEnabled("INSURER_VERIFIER_DEMO"),
  }
}

export function assertCommitmentPilotEnabled(): void {
  if (!isCommitmentFeatureEnabled("SCREENING_COMMITMENT_PILOT")) {
    throw new Error("Screening commitment pilot is disabled.")
  }
  assertCommitmentSandbox()
}

export type CommitmentPilotNetwork = "local-mock" | "base-sepolia"

export function getCommitmentPilotNetwork(): CommitmentPilotNetwork {
  const configured = (process.env.OPENRX_COMMITMENT_NETWORK || "local-mock").trim().toLowerCase()
  if (configured === "base-sepolia") return "base-sepolia"
  if (configured === "local-mock") return "local-mock"
  throw new Error("Commitment pilot network must be local-mock or base-sepolia.")
}

export function assertCommitmentSandbox(): CommitmentPilotNetwork {
  const network = getCommitmentPilotNetwork()
  if (network !== "local-mock" && network !== "base-sepolia") {
    throw new Error("Commitment pilot cannot use a mainnet network.")
  }
  return network
}
