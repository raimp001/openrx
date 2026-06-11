import { describe, expect, it } from "vitest"
import { recommendScreenings, screeningIntakeFromLegacy, type LegacyScreeningInput } from "@/lib/screening/recommend"
import { SCREENING_ENGINE_VERSION } from "@/lib/screening/version"
import type { ScreeningRecommendation } from "@/lib/screening/types"

function run(input: LegacyScreeningInput): ScreeningRecommendation[] {
  return recommendScreenings(screeningIntakeFromLegacy(input)).recommendations
}

function ids(input: LegacyScreeningInput): string[] {
  return run(input).map((rec) => rec.id)
}

function find(input: LegacyScreeningInput, id: string): ScreeningRecommendation | undefined {
  return run(input).find((rec) => rec.id === id)
}

describe("colorectal screening age boundaries (USPSTF 2021)", () => {
  const cases: Array<{ age: number; expected: string | null }> = [
    { age: 44, expected: null },
    { age: 45, expected: "uspstf-average-risk-colorectal" },
    { age: 50, expected: "uspstf-average-risk-colorectal" },
    { age: 75, expected: "uspstf-average-risk-colorectal" },
    { age: 76, expected: "uspstf-crc-selective-76-85" },
    { age: 85, expected: "uspstf-crc-selective-76-85" },
    { age: 86, expected: null },
  ]

  it.each(cases)("age $age → $expected", ({ age, expected }) => {
    const colorectal = ids({ age, gender: "male" }).filter((id) => id.includes("colorectal") || id.includes("crc"))
    if (expected === null) {
      expect(colorectal).toEqual([])
    } else {
      expect(colorectal).toEqual([expected])
    }
  })

  it("grades B at 45-49 and A at 50+", () => {
    expect(find({ age: 45, gender: "male" }, "uspstf-average-risk-colorectal")?.evidenceGrade).toBe("B")
    expect(find({ age: 50, gender: "male" }, "uspstf-average-risk-colorectal")?.evidenceGrade).toBe("A")
  })
})

describe("breast screening age boundaries (USPSTF 2024)", () => {
  const cases: Array<{ age: number; due: boolean }> = [
    { age: 39, due: false },
    { age: 40, due: true },
    { age: 74, due: true },
    { age: 75, due: false },
  ]

  it.each(cases)("female age $age → due: $due", ({ age, due }) => {
    const rec = find({ age, gender: "female" }, "uspstf-average-risk-breast")
    if (due) {
      expect(rec).toBeDefined()
      expect(rec?.status).toBe("due")
      expect(rec?.evidenceGrade).toBe("B")
      expect(rec?.sourceVersion).toBeTruthy()
    } else {
      expect(rec).toBeUndefined()
    }
  })

  it("never recommends mammography for male sex at birth", () => {
    expect(find({ age: 50, gender: "male" }, "uspstf-average-risk-breast")).toBeUndefined()
  })
})

describe("cervical screening age boundaries (USPSTF 2018)", () => {
  const cases: Array<{ age: number; due: boolean }> = [
    { age: 20, due: false },
    { age: 21, due: true },
    { age: 65, due: true },
    { age: 66, due: false },
  ]

  it.each(cases)("female age $age → due: $due", ({ age, due }) => {
    const rec = find({ age, gender: "female" }, "uspstf-average-risk-cervical")
    expect(Boolean(rec)).toBe(due)
    if (due) expect(rec?.evidenceGrade).toBe("A")
  })
})

describe("lung LDCT eligibility boundaries (USPSTF 2021)", () => {
  it("age 49 with 20 pack-years current smoking → no lung recommendation yet", () => {
    const lung = ids({ age: 49, gender: "male", smoker: true, conditions: ["20 pack-years"] }).filter((id) => id.includes("lung"))
    expect(lung).toEqual([])
  })

  it("age 50 with 20 pack-years current smoking → LDCT due", () => {
    const rec = find({ age: 50, gender: "male", smoker: true, conditions: ["20 pack-years"] }, "uspstf-lung-ldct")
    expect(rec?.status).toBe("due")
    expect(rec?.evidenceGrade).toBe("B")
  })

  it("age 80 eligible, age 81 not", () => {
    expect(find({ age: 80, gender: "male", smoker: true, conditions: ["20 pack-years"] }, "uspstf-lung-ldct")).toBeDefined()
    expect(find({ age: 81, gender: "male", smoker: true, conditions: ["20 pack-years"] }, "uspstf-lung-ldct")).toBeUndefined()
  })

  it("19 pack-years → clarification, not LDCT", () => {
    const recs = ids({ age: 60, gender: "male", smoker: true, conditions: ["19 pack-years"] })
    expect(recs).not.toContain("uspstf-lung-ldct")
    expect(recs).toContain("lung-smoking-history-clarify")
  })

  it("quit 15 years ago still eligible; quit 16 years ago is not", () => {
    expect(
      find({ age: 60, gender: "male", smoker: false, conditions: ["20 pack-years", "quit smoking 15 years ago"] }, "uspstf-lung-ldct")
    ).toBeDefined()
    const recs = ids({ age: 60, gender: "male", smoker: false, conditions: ["20 pack-years", "quit smoking 16 years ago"] })
    expect(recs).not.toContain("uspstf-lung-ldct")
  })

  it("pack-years with unknown current/quit status still surfaces lung guidance", () => {
    const recs = ids({ age: 60, gender: "male", conditions: ["30 pack-years"] })
    expect(recs).toContain("lung-smoking-history-clarify")
  })

  it("age 50-80 with unknown smoking history asks to clarify exposure", () => {
    expect(ids({ age: 55, gender: "male" })).toContain("lung-smoking-history-needed")
  })
})

describe("prostate shared decision boundaries (USPSTF 2018)", () => {
  const cases: Array<{ age: number; present: boolean }> = [
    { age: 54, present: false },
    { age: 55, present: true },
    { age: 69, present: true },
    { age: 70, present: false },
  ]

  it.each(cases)("male age $age → discuss: $present", ({ age, present }) => {
    const rec = find({ age, gender: "male" }, "uspstf-prostate-shared-decision")
    expect(Boolean(rec)).toBe(present)
    if (present) expect(rec?.status).toBe("discuss")
  })
})

describe("hereditary and family-history risk routing", () => {
  it("breast-cancer family history triggers BRCA risk assessment flag", () => {
    const rec = find(
      { age: 52, gender: "female", familyHistory: ["mother had breast cancer at age 48"] },
      "brca-family-history-risk-assessment"
    )
    expect(rec).toBeDefined()
    expect(rec?.riskCategory).toBe("hereditary_risk")
    expect(rec?.requiresClinicianReview).toBe(true)
    expect(rec?.sourceVersion).toBeTruthy()
  })

  it("known BRCA2 variant routes to genetic counseling and suppresses average-risk breast logic", () => {
    const recs = run({ age: 52, gender: "female", familyHistory: ["BRCA2 mutation carrier"], conditions: ["BRCA2"] })
    expect(recs.map((rec) => rec.id)).toContain("hereditary-cancer-genetic-counseling")
    expect(recs.map((rec) => rec.id)).not.toContain("uspstf-average-risk-breast")
  })

  it("colorectal family history forces clinician review instead of blind average-risk logic", () => {
    const recs = ids({ age: 45, gender: "male", familyHistory: ["father had colon cancer at age 48"] })
    expect(recs).toContain("crc-family-history-review")
    expect(recs).not.toContain("uspstf-average-risk-colorectal")
  })
})

describe("engine version stamping (pipeline-order guarantee)", () => {
  const profiles: LegacyScreeningInput[] = [
    { age: 45, gender: "male" },
    { age: 52, gender: "female", smoker: true, familyHistory: ["mother had breast cancer at age 48"] },
    { age: 60, gender: "male", smoker: true, conditions: ["30 pack-years"] },
    {},
    { age: 50, gender: "female", symptoms: ["rectal bleeding"] },
  ]

  it("every recommendation for every profile carries engineVersion", () => {
    for (const profile of profiles) {
      const result = recommendScreenings(screeningIntakeFromLegacy(profile))
      expect(result.engineVersion).toBe(SCREENING_ENGINE_VERSION)
      expect(result.recommendations.length).toBeGreaterThan(0)
      for (const rec of result.recommendations) {
        expect(rec.engineVersion, `recommendation ${rec.id} missing engineVersion`).toBe(SCREENING_ENGINE_VERSION)
      }
    }
  })

  it("USPSTF-sourced recommendations carry source version and evidence grade", () => {
    const recs = run({ age: 52, gender: "female" }).filter((rec) => rec.sourceId?.startsWith("uspstf-"))
    expect(recs.length).toBeGreaterThan(0)
    for (const rec of recs) {
      expect(rec.sourceVersion, `recommendation ${rec.id} missing sourceVersion`).toBeTruthy()
      expect(rec.evidenceGrade, `recommendation ${rec.id} missing evidenceGrade`).toBeTruthy()
    }
  })
})
