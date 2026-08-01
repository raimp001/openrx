/**
 * Feature flag helpers for the Screening Commitment Pilot.
 * All flags default to false (disabled) unless explicitly set to "true".
 * Never read NEXT_PUBLIC_ flags server-side for security decisions.
 */

export type PilotFlag =
  | 'SCREENING_COMMITMENT_PILOT'
  | 'COINBASE_ONRAMP_PILOT'
  | 'PRIVATE_COMPLETION_CREDENTIALS'
  | 'INSURER_VERIFIER_DEMO'

export function isFeatureEnabled(flag: PilotFlag): boolean {
  return process.env[flag] === 'true'
}

/** Throws 404-compatible error if flag is disabled. Use at the top of API routes. */
export function requireFeatureFlag(flag: PilotFlag): void {
  if (!isFeatureEnabled(flag)) {
    throw new FeatureFlagDisabledError(flag)
  }
}

export class FeatureFlagDisabledError extends Error {
  readonly flag: string
  constructor(flag: string) {
    super(`Feature '${flag}' is not enabled`)
    this.name = 'FeatureFlagDisabledError'
    this.flag = flag
  }
}

/** All pilot flags and their current state (safe to log, no secrets). */
export function getPilotFlagSummary(): Record<PilotFlag, boolean> {
  return {
    SCREENING_COMMITMENT_PILOT: isFeatureEnabled('SCREENING_COMMITMENT_PILOT'),
    COINBASE_ONRAMP_PILOT: isFeatureEnabled('COINBASE_ONRAMP_PILOT'),
    PRIVATE_COMPLETION_CREDENTIALS: isFeatureEnabled('PRIVATE_COMPLETION_CREDENTIALS'),
    INSURER_VERIFIER_DEMO: isFeatureEnabled('INSURER_VERIFIER_DEMO'),
  }
}
