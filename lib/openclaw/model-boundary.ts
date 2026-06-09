export const CLEAN_MODEL_BUSY_MESSAGE = "We're busy right now. Please try again in a moment."

const RETRY_DELAYS_MS = [500, 1000, 2000]

export interface ModelBoundaryErrorState {
  error: string
}

export function statusFromModelError(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown }
  const status = Number(candidate.status ?? candidate.statusCode ?? candidate.code)
  return Number.isFinite(status) ? status : undefined
}

export function requestIdFromModelError(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  const candidate = error as {
    request_id?: unknown
    requestId?: unknown
    headers?: { get?: (name: string) => string | null }
  }
  const requestId = candidate.request_id ?? candidate.requestId ?? candidate.headers?.get?.("request-id")
  return typeof requestId === "string" && requestId ? requestId : undefined
}

export function modelErrorCode(error: unknown): string {
  const status = statusFromModelError(error)
  return status ? `upstream_${status}` : "upstream_model_error"
}

export function isRetryableModelError(error: unknown): boolean {
  const status = statusFromModelError(error)
  return status === 429 || status === 503
}

export function cleanModelErrorState(): ModelBoundaryErrorState {
  return { error: CLEAN_MODEL_BUSY_MESSAGE }
}

function jitteredDelay(ms: number): number {
  return ms + Math.floor(Math.random() * 250)
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withModelApiBoundary<T>(
  operation: string,
  call: () => Promise<T>,
  options: { attempts?: number } = {}
): Promise<T> {
  const attempts = options.attempts ?? 3
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await call()
    } catch (error) {
      lastError = error
      const retryable = isRetryableModelError(error)
      const exhausted = attempt >= attempts || !retryable
      console.warn("[model-api-boundary]", {
        operation,
        attempt,
        code: modelErrorCode(error),
        requestId: requestIdFromModelError(error),
        retryable,
        exhausted,
      })
      if (exhausted) break
      await sleep(jitteredDelay(RETRY_DELAYS_MS[attempt - 1] ?? 2000))
    }
  }

  throw lastError
}
