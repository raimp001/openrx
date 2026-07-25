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

  it("'tested negative for BRCA2' is not a mutation carrier", () => {
    const parsed = parseScreeningIntakeNarrative("40 female, tested negative for BRCA2")
    expect(parsed.extracted.genes).toEqual([])
    expect(parsed.extracted.conditions.join(" ")).not.toMatch(/carrier/i)
  })

  it("'no colonoscopy' is a missing exam, not a completed one", () => {
    const parsed = parseScreeningIntakeNarrative("45 male, no colonoscopy")
    expect(parsed.extracted.conditions.join(" ")).not.toMatch(/colonoscopy/i)
    expect(parsed.extracted.reportedHistory.colorectalScreening).toBe("no")
  })

  it("'no mammogram' is a missing exam, not a completed one", () => {
    const parsed = parseScreeningIntakeNarrative("52 female, no mammogram")
    expect(parsed.extracted.conditions.join(" ")).not.toMatch(/mammogram/i)
    expect(parsed.extracted.reportedHistory.breastScreening).toBe("no")
  })

  it("'no pap' is a missing exam, not a completed one", () => {
    const parsed = parseScreeningIntakeNarrative("45 female, no pap")
    expect(parsed.extracted.conditions.join(" ")).not.toMatch(/pap/i)
    expect(parsed.extracted.reportedHistory.cervicalScreening).toBe("no")
  })

  it("'no polyps on colonoscopy' is still a completed exam", () => {
    const parsed = parseScreeningIntakeNarrative("50 male, no polyps on colonoscopy 2022")
    expect(parsed.extracted.conditions.join(" ")).toMatch(/colonoscopy/i)
    expect(parsed.extracted.reportedHistory.colorectalScreening).toBe("yes")
  })

  it("'not a smoker' is not a current smoker", () => {
    const parsed = parseScreeningIntakeNarrative("45 male, not a smoker")
    expect(parsed.extracted.smoker).not.toBe(true)
    expect(parsed.extracted.conditions.join(" ")).not.toMatch(/current smoker/i)
    expect(parsed.extracted.reportedHistory.smoking).toBe("no")
  })

  it("\"doesn't smoke\" is not a current smoker", () => {
    const parsed = parseScreeningIntakeNarrative("45 male, doesn't smoke")
    expect(parsed.extracted.smoker).not.toBe(true)
    expect(parsed.extracted.reportedHistory.smoking).toBe("no")
  })

  it("'no smoking history' is not a current smoker", () => {
    const parsed = parseScreeningIntakeNarrative("50 male, no smoking history")
    expect(parsed.extracted.smoker).not.toBe(true)
    expect(parsed.extracted.conditions.join(" ")).not.toMatch(/current smoker/i)
    expect(parsed.extracted.reportedHistory.smoking).toBe("no")
  })

  it("negated age-specific family history is not a positive finding", () => {
    const parsed = parseScreeningIntakeNarrative("55 female, mother did not have breast cancer at age 50")
    expect(parsed.extracted.familyHistory).toEqual([])
    expect(parsed.extracted.reportedHistory.familyCancer).not.toBe("yes")
  })

  it("clause-internal 'no' blocks age-specific family findings", () => {
    const parsed = parseScreeningIntakeNarrative("55 female, mother, no breast cancer at age 50")
    expect(parsed.extracted.familyHistory).toEqual([])
    expect(parsed.extracted.reportedHistory.familyCancer).not.toBe("yes")
  })

  it("affirmed age-specific family history still extracts", () => {
    const parsed = parseScreeningIntakeNarrative("55 female, mother had breast cancer at age 50")
    expect(parsed.extracted.familyHistory.join(" ")).toMatch(/mother had breast cancer at age 50/i)
    expect(parsed.extracted.reportedHistory.familyCancer).toBe("yes")
  })

  it("'denies any symptoms' records a negative symptom history", () => {
    const parsed = parseScreeningIntakeNarrative("45 male, denies any symptoms")
    expect(parsed.extracted.symptoms).toEqual([])
    expect(parsed.extracted.reportedHistory.symptoms).toBe("no")
  })

  it("trailing negation of family history records a negative", () => {
    const parsed = parseScreeningIntakeNarrative("45 male, family history of cancer: no")
    expect(parsed.extracted.familyHistory).toEqual([])
    expect(parsed.extracted.reportedHistory.familyCancer).toBe("no")
  })

  it("'no hysterectomy' does not record a hysterectomy", () => {
    const parsed = parseScreeningIntakeNarrative("60 female, no hysterectomy")
    expect(parsed.extracted.conditions).not.toContain("hysterectomy")
  })

  it("affirmed hysterectomy with cervix removed still extracts", () => {
    const parsed = parseScreeningIntakeNarrative("60 female, hysterectomy with cervix removed")
    expect(parsed.extracted.conditions).toContain("hysterectomy")
    expect(parsed.extracted.reportedHistory.cervixPresent).toBe("no")
  })

  it("negated screening keeps the guideline pathway 'due', not 'up to date'", () => {
    const { engine } = recommend("45 male, no symptoms, no colonoscopy")
    const crc = engine.recommendations.find((r) => /colorectal/i.test(r.screeningName))
    expect(crc).toBeDefined()
    expect(crc!.status).toBe("due")
  })
})
