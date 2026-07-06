export const SAFE_HARBOR_IDENTIFIER_CATEGORIES = [
  "names",
  "geographic_subdivisions_smaller_than_state",
  "dates_except_year",
  "telephone_numbers",
  "fax_numbers",
  "email_addresses",
  "social_security_numbers",
  "medical_record_numbers",
  "health_plan_beneficiary_numbers",
  "account_numbers",
  "certificate_or_license_numbers",
  "vehicle_identifiers",
  "device_identifiers",
  "web_urls",
  "ip_addresses",
  "biometric_identifiers",
  "full_face_photos",
  "other_unique_identifying_numbers_or_codes",
] as const

export type SafeHarborIdentifierCategory = (typeof SAFE_HARBOR_IDENTIFIER_CATEGORIES)[number]

export interface PhiFinding {
  category: SafeHarborIdentifierCategory
  label: string
  count: number
}

export interface DeIdentificationResult {
  text: string
  findings: PhiFinding[]
}

type RedactionRule = {
  category: SafeHarborIdentifierCategory
  label: string
  pattern: RegExp
  replacement: string | ((match: string, ...groups: string[]) => string)
}

const REDACTION_RULES: RedactionRule[] = [
  {
    category: "email_addresses",
    label: "Email address",
    pattern: /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[EMAIL]",
  },
  {
    category: "telephone_numbers",
    label: "Telephone number",
    pattern: /\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    replacement: "[PHONE]",
  },
  {
    category: "social_security_numbers",
    label: "Labeled Social Security number",
    pattern: /\b(?:SSN|social security(?: number)?)\s*[:#]?\s*\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/gi,
    replacement: "SSN [SSN]",
  },
  {
    category: "social_security_numbers",
    label: "Social Security number",
    pattern: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,
    replacement: "[SSN]",
  },
  {
    category: "medical_record_numbers",
    label: "Medical record number",
    pattern: /\b(?:MRN|medical record(?: number)?)\s*[:#]?\s*[A-Z0-9-]{4,}\b/gi,
    replacement: "MRN [REDACTED]",
  },
  {
    category: "health_plan_beneficiary_numbers",
    label: "Health plan beneficiary number",
    pattern: /\b(?:member|policy|subscriber|health plan)(?:\s+(?:id|number|no\.?))?\s*[:#]?\s*[A-Z0-9-]{5,}\b/gi,
    replacement: "[HEALTH_PLAN_ID]",
  },
  {
    category: "account_numbers",
    label: "Account number",
    pattern: /\b(?:account|acct)(?:\s+(?:id|number|no\.?))?\s*[:#]?\s*[A-Z0-9-]{5,}\b/gi,
    replacement: "[ACCOUNT_ID]",
  },
  {
    category: "certificate_or_license_numbers",
    label: "Certificate or license number",
    pattern: /\b(?:license|certificate|cert)(?:\s+(?:id|number|no\.?))?\s*[:#]?\s*[A-Z0-9-]{5,}\b/gi,
    replacement: "[LICENSE_ID]",
  },
  {
    category: "vehicle_identifiers",
    label: "Vehicle identifier",
    pattern: /\b(?:VIN|plate)(?:\s+(?:id|number|no\.?))?\s*[:#]?\s*[A-Z0-9-]{5,}\b/gi,
    replacement: "[VEHICLE_ID]",
  },
  {
    category: "device_identifiers",
    label: "Device identifier",
    pattern: /\b(?:device|implant|serial)(?:\s+(?:id|number|no\.?))?\s*[:#]?\s*[A-Z0-9-]{5,}\b/gi,
    replacement: "[DEVICE_ID]",
  },
  {
    category: "web_urls",
    label: "URL",
    pattern: /\bhttps?:\/\/[^\s)]+/gi,
    replacement: "[URL]",
  },
  {
    category: "ip_addresses",
    label: "IP address",
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    replacement: "[IP_ADDRESS]",
  },
  {
    category: "dates_except_year",
    label: "Date of birth",
    pattern: /\b(?:DOB|date of birth|born)\s*[:=]?\s*(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})\b/gi,
    replacement: "DOB [DATE]",
  },
  {
    category: "dates_except_year",
    label: "Calendar date",
    pattern: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
    replacement: "[DATE]",
  },
  {
    category: "dates_except_year",
    label: "Calendar date",
    pattern: /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
    replacement: "[DATE]",
  },
  {
    category: "dates_except_year",
    label: "Age 90 or older",
    pattern: /\b(?:age|aged)\s*(?:is|:)?\s*(9\d|1\d{2})\b/gi,
    replacement: "age 90+",
  },
  {
    category: "dates_except_year",
    label: "Age 90 or older",
    pattern: /\b(9\d|1\d{2})[\s-]*(?:year|yr)s?[\s-]*old\b/gi,
    replacement: "90+ years old",
  },
  {
    category: "geographic_subdivisions_smaller_than_state",
    label: "Street address",
    pattern: /\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,5}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\b\.?/gi,
    replacement: "[STREET_ADDRESS]",
  },
  {
    category: "geographic_subdivisions_smaller_than_state",
    label: "ZIP code",
    pattern: /\b\d{5}(?:-\d{4})?\b/g,
    replacement: "[ZIP]",
  },
  {
    category: "names",
    label: "Labeled name",
    pattern: /\b((?:my\s+name\s+is|name\s+is|patient(?:\s+name)?(?:\s+is|:)|member(?:\s+name)?(?:\s+is|:))\s+)[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,3}/g,
    replacement: (_match, label: string) => `${label}[NAME]`,
  },
  {
    category: "other_unique_identifying_numbers_or_codes",
    label: "Long identifier",
    pattern: /\b[A-Z]{1,6}[-_ ]?\d{6,}\b/g,
    replacement: "[IDENTIFIER]",
  },
  {
    category: "other_unique_identifying_numbers_or_codes",
    label: "Long number",
    pattern: /\b\d{9,}\b/g,
    replacement: "[IDENTIFIER]",
  },
]

const SENSITIVE_LOG_KEYS = new Set([
  "address",
  "clinicalnote",
  "content",
  "dateofbirth",
  "dob",
  "email",
  "errormessage",
  "familyhistory",
  "freetext",
  "history",
  "medications",
  "meds",
  "message",
  "messages",
  "mrn",
  "narrative",
  "note",
  "notes",
  "patientprofile",
  "patienttext",
  "phone",
  "profile",
  "prompt",
  "prompts",
  "providererror",
  "rawinput",
  "ssn",
  "symptoms",
  "transcript",
  "upstreamerror",
])

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
}

function summarizeFindings(findings: Map<SafeHarborIdentifierCategory, PhiFinding>, rule: RedactionRule, count: number) {
  const current = findings.get(rule.category)
  if (current) {
    current.count += count
    return
  }
  findings.set(rule.category, {
    category: rule.category,
    label: rule.label,
    count,
  })
}

export function deIdentifyFreeText(input: string): DeIdentificationResult {
  const findings = new Map<SafeHarborIdentifierCategory, PhiFinding>()
  let text = input

  for (const rule of REDACTION_RULES) {
    let count = 0
    text = text.replace(rule.pattern, (...args: string[]) => {
      count += 1
      if (typeof rule.replacement === "function") {
        return rule.replacement(args[0], ...args.slice(1))
      }
      return rule.replacement
    })
    if (count > 0) summarizeFindings(findings, rule, count)
  }

  return {
    text,
    findings: Array.from(findings.values()),
  }
}

export function sanitizePhiForLog(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (depth > 8) return "[REDACTED_DEPTH_LIMIT]"

  if (typeof value === "string") {
    return deIdentifyFreeText(value).text
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (value instanceof Date) {
    return "[DATE]"
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePhiForLog(entry, depth + 1))
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        if (SENSITIVE_LOG_KEYS.has(normalizeKey(key))) {
          return [key, "[REDACTED_PHI_FIELD]"]
        }
        return [key, sanitizePhiForLog(entry, depth + 1)]
      })
    )
  }

  return "[REDACTED_UNSUPPORTED]"
}

export function buildPhiSafeLogMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return sanitizePhiForLog(metadata) as Record<string, unknown>
}
