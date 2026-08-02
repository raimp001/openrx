export class CommitmentPilotError extends Error {
  constructor(
    public readonly code:
      | "disabled"
      | "invalid_input"
      | "not_found"
      | "forbidden"
      | "invalid_transition"
      | "identity_required"
      | "deadline_not_reached"
      | "replay"
      | "verification_failed"
      | "external_service_unavailable",
    message: string,
    public readonly status = 400,
  ) {
    super(message)
    this.name = "CommitmentPilotError"
  }
}
