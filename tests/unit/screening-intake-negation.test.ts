import { describe, expect, it } from "vitest"
import { parseScreeningIntakeNarrative } from "@/lib/screening-intake"
import { recommendScreenings, screeningIntakeFromLegacy } from "@/lib/screening/recommend"

function recommend(narrative: string) {
  const parsed = parseScreeningIntakeNarrative(narrative)
  return {
    parsed,
    engine: recommendScreenings(screeningIntakeFromLegacy({
      age: parsed.extracted.age,
      gender: parsed.extracted.gender,
      smoker: parsed.extracted.smoker,
      familyHistory: parsed.extracted.familyHistory,
      symptoms: parsed.extracted.symptoms,
      conditions: parsed.extracted.conditions,
      reportedHistory: parsed.extracted.reportedHistory,
    })),
  }
}

describe("negation handling", () => {
  it("does not invert 'no family history of colorectal cancer'", () => {
    const { parsed, engine } = recommend("45 male, no symptoms, no family history of colorectal cancer, never screened")
    expect(parsed.extracted.familyHistory).toEqual([])
    expect(parsed.extracted.reportedHistory.familyCancer).toBe("no")
    const crc = engine.recommendations.find((r) => /colorectal/i.test(r.screeningName))
    expect(crc).toBeDefined()
    expect(crc!.status).toBe("due")
    expect(engine.recommendations.some((r) => /hereditary/i.test(r.screeningName))).toBe(false)
  })

  it("'denies family history of breast cancer' stays negative", () => {
    const parsed = parseScreeningIntakeNarrative("52 female, denies family history of breast cancer")
    expect(parsed.extracted.familyHistory).toEqual([])
    expect(parsed.extracted.reportedHistory.familyCancer).toBe("no")
  })

  it("'without family history of cancer' stays negative", () => {
    const parsed = parseScreeningIntakeNarrative("48 male without family history of cancer")
    expect(parsed.extracted.familyHistory).toEqual([])
    expect(parsed.extracted.reportedHistory.familyCancer).toBe("no")
  })

  it("'no family history' alone records a negative, not an unknown", () => {
    const parsed = parseScreeningIntakeNarrative("45 male, no family history")
    expect(parsed.extracted.familyHistory).toEqual([])
    expect(parsed.extracted.reportedHistory.familyCancer).toBe("no")
  })

  it("affirmed family history still extracts", () => {
    const parsed = parseScreeningIntakeNarrative("52 female with family history of breast cancer, mother at age 48")
    expect(parsed.extracted.familyHistory.join(" ")).toMatch(/breast/i)
    expect(parsed.extracted.reportedHistory.familyCancer).toBe("yes")
  })

  it("negated symptom is not extracted as a symptom or red flag", () => {
    const parsed = parseScreeningIntakeNarrative("60 male, no chest pain, no rectal bleeding")
    expect(parsed.extracted.symptoms).toEqual([])
    expect(parsed.extracted.redFlags).toEqual([])
  })

  it("'never smoker' is not a current smoker", () => {
    const parsed = parseScreeningIntakeNarrative("50 male, never smoker")
    expect(parsed.extracted.smoker).not.toBe(true)
    expect(parsed.extracted.reportedHistory.smoking).toBe("no")
  })

  it("'BRCA2 negative' is not a mutation carrier", () => {
    const parsed = parseScreeningIntakeNarrative("40 female, BRCA2 negative")
    expect(parsed.extracted.genes).toEqual([])
    expect(parsed.extracted.conditions.join(" ")).not.toMatch(/carrier/i)
  })
})
