import { describe, expect, it } from "vitest"
import { buildCareSearchQuery, type ConversationMessage } from "@/lib/ai-engine"

function history(...contents: string[]): ConversationMessage[] {
  return contents.map((content) => ({ role: "user" as const, content }))
}

describe("ZIP follow-up routes to primary care in the same conversation", () => {
  it("a bare ZIP after a screening question becomes a primary-care search", () => {
    expect(buildCareSearchQuery("97123", history("What cancer screening does a 50-year-old woman need?")))
      .toBe("Find primary care near 97123")
  })

  it("a bare ZIP with no prior context still defaults to primary care", () => {
    expect(buildCareSearchQuery("97123", [])).toBe("Find primary care near 97123")
  })

  it("a bare ZIP after an explicit service request keeps that service", () => {
    expect(buildCareSearchQuery("97204", history("Find a radiology center for a mammogram")))
      .toBe("Find a radiology center for a mammogram near 97204")
  })

  it("the recommendation handoff phrasing maps to primary care", () => {
    expect(buildCareSearchQuery("97123", history("Find a clinic or screening site for these recommendations.")))
      .toBe("Find primary care near 97123")
  })

  it("non-ZIP messages pass through unchanged", () => {
    expect(buildCareSearchQuery("Find primary care near me.", [])).toBe("Find primary care near me.")
  })
})
