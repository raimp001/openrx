// Phone-number helpers used by the call backend. Keep client-safe — no env access.

const E164_RE = /^\+[1-9]\d{6,14}$/

export interface NormalizedPhone {
  e164: string
  masked: string // e.g. "+1 (•••) •••-1234"
  last4: string
}

export function normalizePhone(input: string): NormalizedPhone | null {
  if (!input) return null
  const trimmed = input.trim()
  // Strip everything that isn't a digit or leading +.
  let digits = trimmed.replace(/[^\d+]/g, "")
  if (!digits.startsWith("+")) {
    // Default to North American Numbering Plan if a 10-digit number is provided.
    if (/^\d{10}$/.test(digits)) {
      digits = `+1${digits}`
    } else if (/^1\d{10}$/.test(digits)) {
      digits = `+${digits}`
    } else {
      return null
    }
  }
  if (!E164_RE.test(digits)) return null
  const last4 = digits.slice(-4)
  const country = digits.slice(0, digits.length - 10) || "+1"
  const masked = `${country} (•••) •••-${last4}`
  return { e164: digits, masked, last4 }
}

export function maskFull(e164: string): string {
  if (!e164) return ""
  const last4 = e164.slice(-4)
  const country = e164.slice(0, e164.length - 10) || "+1"
  return `${country} (•••) •••-${last4}`
}

export function shortId(prefix = "call"): string {
  const rand = Math.random().toString(36).slice(2, 9)
  const ts = Date.now().toString(36)
  return `${prefix}_${ts}${rand}`
}
