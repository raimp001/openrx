import { describe, expect, it } from "vitest"
import { careSearchQueryForRecommendation } from "@/lib/screening/care-search"
import type { ScreeningNextStep } from "@/lib/screening/types"

function query(partial: {
  screeningName: string
  cancerType: string
  recommendedNextStep: string
  nextSteps: ScreeningNextStep[]
}) {
  return careSearchQueryForRecommendation(partial)
}

describe("care search query for a screening recommendation", () => {
  it("sends average-risk colorectal screening to gastroenterology, not a generic lab", () => {
    expect(query({
      screeningName: "Colorectal cancer screening",
      cancerType: "colorectal cancer",
      recommendedNextStep: "Request care navigation for FIT, stool DNA, colonoscopy, or another appropriate screening option.",
      nextSteps: ["request_colonoscopy", "request_care_navigation", "download_clinician_summary"],
    })).toBe("gastroenterology providers for colonoscopy")
  })

  it("sends mammography to imaging centers", () => {
    expect(query({
      screeningName: "Breast cancer screening mammogram",
      cancerType: "breast cancer",
      recommendedNextStep: "Request mammogram navigation or discuss with your clinician.",
      nextSteps: ["request_mammogram", "request_imaging"],
    })).toBe("mammogram imaging centers")
  })

  it("sends lung screening to low-dose CT radiology", () => {
    expect(query({
      screeningName: "Low-dose CT lung cancer screening",
      cancerType: "lung cancer",
      recommendedNextStep: "Request LDCT navigation.",
      nextSteps: ["request_ldct", "request_imaging"],
    })).toBe("radiology centers for low-dose CT screening")
  })

  it("keeps cervical, prostate, and genetics searches distinct", () => {
    expect(query({
      screeningName: "Cervical cancer screening",
      cancerType: "cervical cancer",
      recommendedNextStep: "Request cervical screening.",
      nextSteps: ["request_cervical_screening"],
    })).toMatch(/gynecology/)
    expect(query({
      screeningName: "PSA screening discussion",
      cancerType: "prostate cancer",
      recommendedNextStep: "Discuss PSA screening.",
      nextSteps: ["request_psa_discussion"],
    })).toMatch(/urology/)
    expect(query({
      screeningName: "Hereditary cancer risk review",
      cancerType: "hereditary cancer risk",
      recommendedNextStep: "Request genetic counseling.",
      nextSteps: ["request_genetic_counseling"],
    })).toBe("genetic counseling providers")
  })
})
