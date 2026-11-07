import type { ScreeningNextStep, ScreeningRecommendation } from "./types"

type CareSearchRecommendation = Pick<
  ScreeningRecommendation,
  "screeningName" | "cancerType" | "recommendedNextStep" | "nextSteps"
>

function hasStep(rec: CareSearchRecommendation, steps: ScreeningNextStep[]) {
  return steps.some((step) => rec.nextSteps.includes(step))
}

export function careSearchQueryForRecommendation(rec: CareSearchRecommendation): string {
  const signal = `${rec.screeningName} ${rec.cancerType} ${rec.recommendedNextStep}`.toLowerCase()

  if (hasStep(rec, ["request_colonoscopy"]) || /colorectal|colonoscop|colon/.test(signal)) {
    return "gastroenterology providers for colonoscopy"
  }
  if (hasStep(rec, ["request_mammogram"]) || /mammogram|breast/.test(signal)) {
    return "mammogram imaging centers"
  }
  if (hasStep(rec, ["request_ldct", "request_imaging"]) || /lung|ldct|low-dose ct/.test(signal)) {
    return "radiology centers for low-dose CT screening"
  }
  if (hasStep(rec, ["request_cervical_screening"]) || /cervical|pap|hpv/.test(signal)) {
    return "primary care or gynecology providers for cervical cancer screening"
  }
  if (hasStep(rec, ["request_psa_discussion"]) || /prostate|psa/.test(signal)) {
    return "primary care or urology providers for prostate screening discussion"
  }
  if (hasStep(rec, ["request_genetic_counseling"]) || /genetic|hereditary|brca|lynch/.test(signal)) {
    return "genetic counseling providers"
  }

  return `providers for ${rec.screeningName}`
}
