/**
 * Integer-cents money utilities.
 *
 * All internal arithmetic uses integer cents to avoid IEEE 754 float
 * precision errors (e.g. 0.1 + 0.2 !== 0.3). Conversion to/from
 * decimal strings happens only at API boundaries.
 */

export function toCents(amount: string): number {
  const cleaned = amount.replace(/[^0-9.\-]/g, "")
  if (!cleaned || cleaned === "-") return 0
  const negative = cleaned.startsWith("-")
  const abs = cleaned.replace("-", "")
  const [whole = "0", frac = ""] = abs.split(".")
  const cents = parseInt(whole, 10) * 100 + parseInt((frac + "00").slice(0, 2), 10)
  return negative ? -cents : cents
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : ""
  const abs = Math.abs(Math.round(cents))
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`
}

export function safeParseAmount(raw: string | undefined | null): string {
  if (!raw) return "0.00"
  return fromCents(toCents(raw))
}

export function safeAmountNumber(raw: string | undefined | null): number {
  return toCents(raw || "0") / 100
}

export function addAmounts(a: string, b: string): string {
  return fromCents(toCents(a) + toCents(b))
}

export function subtractAmounts(a: string, b: string): string {
  return fromCents(toCents(a) - toCents(b))
}

export function amountGte(a: string, b: string): boolean {
  return toCents(a) >= toCents(b)
}

export function amountGt(a: string, b: string): boolean {
  return toCents(a) > toCents(b)
}
