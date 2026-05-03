import { OPENCLAW_CONFIG, type CronJobId } from "./config"

type CronJob = (typeof OPENCLAW_CONFIG.cronJobs)[number]

type TriggeredAtInfo = {
  effectiveIso: string
  invalidInput: boolean
  requestedAt?: string
}

export type CronFailureReason =
  | "unknown_agent"
  | "missing_model_credentials"
  | "provider_auth_failed"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "empty_or_fallback_response"
  | "side_effect_failed"

type CronClassification = {
  ok: boolean
  failureReason: CronFailureReason | null
  httpStatus: number
}

const PROMPT_BUILDERS: Partial<Record<CronJobId, (job: CronJob, triggeredAtIso: string) => string>> = {
  "appointment-reminders": (job, triggeredAtIso) =>
    `Run the OpenRx scheduled job "${job.id}" at ${triggeredAtIso}. Review tomorrow's appointments, prepare reminder content, and list exactly which patients would be contacted. Do not claim any reminder was actually sent unless an external delivery system executed it.`,
  "adherence-check": (job, triggeredAtIso) =>
    `Run the OpenRx scheduled job "${job.id}" at ${triggeredAtIso}. Review active prescriptions for adherence risk, summarize patients who need follow-up, and explain the highest-priority interventions. Do not claim outreach happened unless another automation sent it.`,
  "claim-followup": (job, triggeredAtIso) =>
    `Run the OpenRx scheduled job "${job.id}" at ${triggeredAtIso}. Review pending and denied claims, identify blockers, and produce the next follow-up actions. Do not imply payer contact occurred unless an external workflow handled it.`,
  "pa-status-check": (job, triggeredAtIso) =>
    `Run the OpenRx scheduled job "${job.id}" at ${triggeredAtIso}. Review pending prior authorizations, summarize the likely status posture, and list any cases that require human review. Do not claim portal updates were fetched unless a live integration executed that step.`,
  "no-show-followup": (job, triggeredAtIso) =>
    `Run the OpenRx scheduled job "${job.id}" at ${triggeredAtIso}. Review no-show appointments and draft the recommended follow-up actions and rescheduling priorities. Do not state that messages were sent unless another delivery system handled them.`,
  "refill-reminders": (job, triggeredAtIso) =>
    `Run the OpenRx scheduled job "${job.id}" at ${triggeredAtIso}. Review medications likely to need refills within 7 days, identify who should be reminded, and summarize the refill risks. Do not claim reminders were sent unless an external system sent them.`,
  "screening-reminders": (job, triggeredAtIso) =>
    `Run the OpenRx scheduled job "${job.id}" at ${triggeredAtIso}. Review preventive screening gaps, prioritize the most important overdue screenings, and draft reminder language. Do not claim any outreach was sent unless another automation executed it.`,
  "daily-health-check": (job, triggeredAtIso) =>
    `Run the OpenRx scheduled job "${job.id}" at ${triggeredAtIso}. Review overall route and API health expectations, highlight likely risk points, and summarize what should be checked next. Do not claim live probes ran unless an external monitoring system performed them.`,
  "daily-deploy": (job, triggeredAtIso) =>
    `Run the OpenRx scheduled job "${job.id}" at ${triggeredAtIso}. Assess deployment readiness, likely blockers, and the next safe actions. Do not claim code was deployed, built, or tested unless another CI/CD system executed those side effects.`,
  "security-audit": (job, triggeredAtIso) =>
    `Run the OpenRx scheduled job "${job.id}" at ${triggeredAtIso}. Review likely dependency, configuration, and compliance risks, then summarize the highest-priority remediation items. Do not claim scanners or patching ran unless another automation executed them.`,
}

const RESPONSE_FAILURE_MARKERS: Array<{
  match: (value: string) => boolean
  failureReason: CronFailureReason
  httpStatus: number
}> = [
  {
    match: (value) => value === "Unknown agent.",
    failureReason: "unknown_agent",
    httpStatus: 500,
  },
  {
    match: (value) =>
      value === "AI service is unavailable. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
    failureReason: "missing_model_credentials",
    httpStatus: 503,
  },
  {
    match: (value) =>
      value === "AI service authentication failed. Verify the configured provider API key.",
    failureReason: "provider_auth_failed",
    httpStatus: 502,
  },
  {
    match: (value) =>
      value ===
      "AI provider quota or rate limit exceeded. Verify OPENAI_API_KEY billing, quota, and model access.",
    failureReason: "provider_rate_limited",
    httpStatus: 429,
  },
  {
    match: (value) =>
      value === "AI service is temporarily unavailable. Please retry shortly." ||
      value.startsWith("AI service "),
    failureReason: "provider_unavailable",
    httpStatus: 503,
  },
  {
    match: (value) => value === "I couldn't process that. Could you try again?",
    failureReason: "empty_or_fallback_response",
    httpStatus: 502,
  },
]

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000
const idempotencyCache = new Map<string, { expiresAt: number; payload: unknown }>()

function idempotencyCacheKey(jobId: string, key: string) {
  return `${jobId}::${key}`
}

export function listCronJobs() {
  return OPENCLAW_CONFIG.cronJobs.map((job) => ({
    ...job,
    endpoint: `/api/openclaw/cron/${job.id}`,
  }))
}

function parseCronField(
  field: string,
  value: number,
  bounds: { min: number; max: number }
): boolean {
  const normalized = field.trim()
  if (!normalized) return false

  return normalized.split(",").some((segment) => {
    const [base, stepRaw] = segment.trim().split("/")
    const step = stepRaw ? Number.parseInt(stepRaw, 10) : 1
    if (!Number.isFinite(step) || step <= 0) return false

    if (base === "*") {
      return (value - bounds.min) % step === 0
    }

    const [rangeStartRaw, rangeEndRaw] = base.includes("-")
      ? base.split("-", 2)
      : [base, base]
    const rangeStart = Number.parseInt(rangeStartRaw, 10)
    const rangeEnd = Number.parseInt(rangeEndRaw, 10)
    if (
      !Number.isFinite(rangeStart) ||
      !Number.isFinite(rangeEnd) ||
      rangeStart < bounds.min ||
      rangeEnd > bounds.max ||
      value < rangeStart ||
      value > rangeEnd
    ) {
      return false
    }

    return (value - rangeStart) % step === 0
  })
}

export function isCronDue(schedule: string, at: Date): boolean {
  const parts = schedule.trim().split(/\s+/)
  if (parts.length !== 5) return false

  const [minuteExpr, hourExpr, dayOfMonthExpr, monthExpr, dayOfWeekExpr] = parts
  const minute = at.getUTCMinutes()
  const hour = at.getUTCHours()
  const dayOfMonth = at.getUTCDate()
  const month = at.getUTCMonth() + 1
  const dayOfWeek = at.getUTCDay()

  return (
    parseCronField(minuteExpr, minute, { min: 0, max: 59 }) &&
    parseCronField(hourExpr, hour, { min: 0, max: 23 }) &&
    parseCronField(dayOfMonthExpr, dayOfMonth, { min: 1, max: 31 }) &&
    parseCronField(monthExpr, month, { min: 1, max: 12 }) &&
    parseCronField(dayOfWeekExpr, dayOfWeek, { min: 0, max: 6 })
  )
}

export function listDueCronJobs(at: Date) {
  return listCronJobs().filter((job) => isCronDue(job.schedule, at))
}

export function getCronJob(jobId: string): CronJob | undefined {
  return OPENCLAW_CONFIG.cronJobs.find((item) => item.id === jobId)
}

export function allowsCronRequestOverrides(params: {
  authSource: string
  dryRun?: boolean
}): boolean {
  if (process.env.OPENRX_ALLOW_CRON_REQUEST_OVERRIDES === "true") {
    return params.authSource === "admin_api_key"
  }

  if (process.env.NODE_ENV !== "production" && params.authSource === "default") {
    return true
  }

  // Keep preview/testing flexible without allowing a stale EC2 env file to
  // override the real prompt/wallet for every live scheduled job.
  return params.dryRun === true && params.authSource === "admin_api_key"
}

export function canRunCronSideEffectsAfterAgentFailure(
  jobId: CronJobId,
  failureReason: CronFailureReason | null
): boolean {
  if (!failureReason) return true
  if (jobId === "daily-deploy") return false

  return [
    "missing_model_credentials",
    "provider_auth_failed",
    "provider_rate_limited",
    "provider_unavailable",
    "empty_or_fallback_response",
  ].includes(failureReason)
}

export function normalizeTriggeredAt(value?: string): TriggeredAtInfo {
  if (!value) {
    return { effectiveIso: new Date().toISOString(), invalidInput: false }
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return {
      effectiveIso: new Date().toISOString(),
      invalidInput: true,
      requestedAt: value,
    }
  }

  return {
    effectiveIso: parsed.toISOString(),
    invalidInput: false,
    requestedAt: value,
  }
}

export function buildCronAgentMessage(job: CronJob, params?: { override?: string; triggeredAt?: string }) {
  const override = params?.override?.trim()
  if (override) return override

  const { effectiveIso } = normalizeTriggeredAt(params?.triggeredAt)
  const specialized = PROMPT_BUILDERS[job.id]?.(job, effectiveIso)

  return [
    specialized ||
      `Run the OpenRx scheduled job "${job.id}" at ${effectiveIso}. ${job.description}`,
    "Reply as a checklist with: 1) what you reviewed 2) what you would do next 3) blockers 4) human follow-up needed.",
    "Do not claim side effects that were not actually executed by another system.",
  ].join(" ")
}

export function classifyCronAgentResult(result: { response: string }): CronClassification {
  const response = result.response.trim()

  for (const marker of RESPONSE_FAILURE_MARKERS) {
    if (marker.match(response)) {
      return {
        ok: false,
        failureReason: marker.failureReason,
        httpStatus: marker.httpStatus,
      }
    }
  }

  return {
    ok: true,
    failureReason: null,
    httpStatus: 200,
  }
}

export function readCronIdempotency<T>(jobId: string, key?: string): T | null {
  if (!key) return null

  const now = Date.now()
  for (const [cacheKey, entry] of Array.from(idempotencyCache.entries())) {
    if (entry.expiresAt <= now) {
      idempotencyCache.delete(cacheKey)
    }
  }

  const entry = idempotencyCache.get(idempotencyCacheKey(jobId, key))
  if (!entry || entry.expiresAt <= now) return null
  return entry.payload as T
}

export function writeCronIdempotency(jobId: string, key: string | undefined, payload: unknown) {
  if (!key) return
  idempotencyCache.set(idempotencyCacheKey(jobId, key), {
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    payload,
  })
}
