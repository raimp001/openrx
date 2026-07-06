import { describe, expect, it } from "vitest"
import {
  SAFE_HARBOR_IDENTIFIER_CATEGORIES,
  buildPhiSafeLogMetadata,
  deIdentifyFreeText,
} from "@/lib/phi-deidentification"

describe("PHI de-identification helpers", () => {
  it("documents the 18 HIPAA Safe Harbor identifier categories", () => {
    expect(SAFE_HARBOR_IDENTIFIER_CATEGORIES).toHaveLength(18)
    expect(SAFE_HARBOR_IDENTIFIER_CATEGORIES).toContain("names")
    expect(SAFE_HARBOR_IDENTIFIER_CATEGORIES).toContain("email_addresses")
    expect(SAFE_HARBOR_IDENTIFIER_CATEGORIES).toContain("other_unique_identifying_numbers_or_codes")
  })

  it("redacts direct identifiers from free text before logs or prompts reuse it", () => {
    const raw = [
      "Patient name is Jane Doe.",
      "DOB 01/02/1970, age 93.",
      "Call (415) 555-1234 or jane.doe@example.com.",
      "SSN 123-45-6789, MRN AB123456, account 999991111.",
      "Address 123 Main Street, ZIP 94105, IP 192.168.1.1.",
      "See https://example.test/patient/JaneDoe.",
    ].join(" ")

    const result = deIdentifyFreeText(raw)

    expect(result.text).toContain("Patient name is [NAME]")
    expect(result.text).toContain("DOB [DATE]")
    expect(result.text).toContain("age 90+")
    expect(result.text).toContain("[PHONE]")
    expect(result.text).toContain("[EMAIL]")
    expect(result.text).toContain("[SSN]")
    expect(result.text).toContain("MRN [REDACTED]")
    expect(result.text).toContain("[ACCOUNT_ID]")
    expect(result.text).toContain("[STREET_ADDRESS]")
    expect(result.text).toContain("[ZIP]")
    expect(result.text).toContain("[IP_ADDRESS]")
    expect(result.text).toContain("[URL]")
    expect(result.text).not.toContain("Jane Doe")
    expect(result.text).not.toContain("jane.doe@example.com")
    expect(result.text).not.toContain("123-45-6789")
    expect(result.findings.map((finding) => finding.category)).toContain("names")
  })

  it("drops high-risk raw fields and preserves safe operational metadata", () => {
    const metadata = buildPhiSafeLogMetadata({
      requestId: "req_123",
      code: "MODEL_429",
      rawInput: "My name is Jane Doe and my phone is 415-555-1234",
      prompt: "DOB 01/02/1970",
      nested: {
        upstreamError: "provider echoed jane.doe@example.com",
        retryCount: 3,
        noteHash: "sha256:abc123",
      },
      safeText: "request from jane.doe@example.com failed",
    })

    expect(metadata.requestId).toBe("req_123")
    expect(metadata.code).toBe("MODEL_429")
    expect(metadata.rawInput).toBe("[REDACTED_PHI_FIELD]")
    expect(metadata.prompt).toBe("[REDACTED_PHI_FIELD]")
    expect((metadata.nested as Record<string, unknown>).upstreamError).toBe("[REDACTED_PHI_FIELD]")
    expect((metadata.nested as Record<string, unknown>).retryCount).toBe(3)
    expect(metadata.safeText).toBe("request from [EMAIL] failed")
    expect(JSON.stringify(metadata)).not.toContain("Jane Doe")
    expect(JSON.stringify(metadata)).not.toContain("415-555-1234")
    expect(JSON.stringify(metadata)).not.toContain("jane.doe@example.com")
  })
})
