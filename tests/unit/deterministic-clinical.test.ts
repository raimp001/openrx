import { describe, expect, it } from "vitest"
import { deterministicClinicalResponse } from "@/lib/openclaw/deterministic-clinical"

describe("deterministic clinical screening response", () => {
  it('"age 45 male" returns a version-stamped, source-linked plan', () => {
    const response = deterministicClinicalResponse("age 45 male")
    expect(response).toBeTruthy()
    expect(response).toContain("USPSTF")
    expect(response).toContain("Grade B")
    expect(response).toContain("Rule:")
    expect(response).toContain("Colorectal cancer screening")
    expect(response).toContain("Rule: uspstf-average-risk-colorectal")
    expect(response).toContain("USPSTF: Colorectal cancer screening for average-risk adults (2021-05-18)")
    expect(response).not.toContain("Direct answer")
  })

  it("garbage input is not answered by the simple rules", () => {
    expect(deterministicClinicalResponse("asdf qwerty")).toBeNull()
  })

  it("does not intercept emergency or prior-authorization workflows", () => {
    expect(
      deterministicClinicalResponse(
        "Sudden facial droop and slurred speech, should I book prevention screening?",
        "triage"
      )
    ).toBeNull()
    expect(
      deterministicClinicalResponse(
        "Cite USPSTF semaglutide prior authorization section 4.2 for this denial.",
        "prior-auth"
      )
    ).toBeNull()
  })

  it("age-only colorectal screening prompts return an engine-backed recommendation", () => {
    const response = deterministicClinicalResponse("age 45, what screening is due?")
    expect(response).toContain("Colorectal cancer screening")
    expect(response).toContain("Rule: uspstf-average-risk-colorectal")
    expect(response).toContain("Grade B")
    expect(response).not.toContain("Direct answer")
  })

  it("routes risk modifiers through the deterministic screening engine", () => {
    const breastRisk = deterministicClinicalResponse("age 52 female, smoker, family history of breast cancer")
    expect(breastRisk).toContain("Genetic counseling and BRCA-related risk assessment")
    expect(breastRisk).toContain("Rule: brca-family-history-risk-assessment")
    expect(breastRisk).not.toContain("Direct answer")

    const hereditaryRisk = deterministicClinicalResponse("45 male, BRCA2 mutation carrier")
    expect(hereditaryRisk).toContain("Genetic counseling")
    expect(hereditaryRisk).toContain("Rule:")
    expect(hereditaryRisk).not.toContain("Direct answer")

    const lungRisk = deterministicClinicalResponse("60 male with 30 pack-years, what screening is due?")
    expect(lungRisk).toContain("Clarify lung screening eligibility")
    expect(lungRisk).toContain("USPSTF: Lung cancer screening (2021-03-09)")
    expect(lungRisk).not.toContain("Direct answer")
  })

  it("simple age/sex prevention questions are still answered by the rules", () => {
    expect(deterministicClinicalResponse("What cancer screening does a 50-year-old woman need?")).toContain("USPSTF")
  })

  it("every age/sex answer asks for the risk factors that could change the plan", () => {
    const response = deterministicClinicalResponse("age 45 male")
    expect(response).toContain("Questions that could change this plan")
    expect(response).toMatch(/close blood relative had cancer/i)
    expect(response).toMatch(/colonoscopy, FIT\/stool testing/i)
    expect(response).toMatch(/Why this matters/i)
  })

  it("guideline-backed plans end in a bookable action", () => {
    const response = deterministicClinicalResponse("age 45 male")
    expect(response).toContain("What to do now")
    expect(response).toContain("[Book the next step](/scheduling)")
    expect(response).toMatch(/ZIP code/i)
  })
})
