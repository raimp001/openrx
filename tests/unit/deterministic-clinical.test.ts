import { describe, expect, it } from "vitest"
import { deterministicClinicalResponse } from "@/lib/openclaw/deterministic-clinical"

describe("deterministic clinical hotfix rules", () => {
  it('"age 45 male" returns a version-stamped, source-linked plan', () => {
    const response = deterministicClinicalResponse("age 45 male")
    expect(response).toBeTruthy()
    expect(response).toContain("USPSTF")
    expect(response).toContain("Grade B")
    expect(response).toContain("Rule:")
    expect(response).toMatch(/uspstf-colorectal-45-49/)
    expect(response).toMatch(/openrx-hotfix-prevention-rules/)
  })

  it("garbage input is not answered by the simple rules", () => {
    expect(deterministicClinicalResponse("asdf qwerty")).toBeNull()
  })

  it("missing sex asks one clear question instead of answering", () => {
    const response = deterministicClinicalResponse("age 45, what screening is due?")
    expect(response).toMatch(/sex at birth/i)
    expect(response).not.toContain("Rule:")
  })

  it("defers to the full screening engine when risk modifiers are present", () => {
    expect(deterministicClinicalResponse("age 52 female, smoker, family history of breast cancer")).toBeNull()
    expect(deterministicClinicalResponse("45 male, BRCA2 mutation carrier")).toBeNull()
    expect(deterministicClinicalResponse("60 male with 30 pack-years, what screening is due?")).toBeNull()
  })

  it("simple age/sex prevention questions are still answered by the rules", () => {
    expect(deterministicClinicalResponse("What cancer screening does a 50-year-old woman need?")).toContain("USPSTF")
  })

  it("every age/sex answer asks for the risk factors that could change the plan", () => {
    const response = deterministicClinicalResponse("age 45 male")
    expect(response).toContain("Question to refine this")
    expect(response).toMatch(/family history of cancer/i)
    expect(response).toMatch(/smoking history/i)
    expect(response).toMatch(/screening tests and dates|genetic results/i)
  })
})
