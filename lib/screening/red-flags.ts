import type { ScreeningIntake, ScreeningNextStep } from "./types"

export type RedFlagFinding = {
  key: keyof ScreeningIntake["symptoms"] | "otherRedFlags"
  label: string
  cancerContext: string
  nextSteps: ScreeningNextStep[]
}

export function detectRedFlags(intake: ScreeningIntake): RedFlagFinding[] {
  const findings: RedFlagFinding[] = []
  const symptoms = intake.symptoms

  if (symptoms.rectalBleeding) {
    findings.push({
      key: "rectalBleeding",
      label: "Rectal bleeding",
      cancerContext: "colorectal or other GI concern",
      nextSteps: ["seek_urgent_care", "request_specialist_review", "request_referral"],
    })
  }
  if (symptoms.unexplainedWeightLoss) {
    findings.push({
      key: "unexplainedWeightLoss",
      label: "Unexplained weight loss",
      cancerContext: "systemic symptom",
      nextSteps: ["request_specialist_review", "request_care_navigation"],
    })
  }
  if (symptoms.breastMass) {
    findings.push({
      key: "breastMass",
      label: "New breast lump or mass",
      cancerContext: "breast diagnostic evaluation",
      nextSteps: ["request_specialist_review", "request_imaging"],
    })
  }
  if (symptoms.hemoptysis) {
    findings.push({
      key: "hemoptysis",
      label: "Coughing blood",
      cancerContext: "lung or airway diagnostic evaluation",
      nextSteps: ["seek_urgent_care", "request_specialist_review", "request_imaging"],
    })
  }
  if (symptoms.abnormalUterineBleeding) {
    findings.push({
      key: "abnormalUterineBleeding",
      label: "Abnormal uterine bleeding",
      cancerContext: "gynecologic diagnostic evaluation",
      nextSteps: ["request_specialist_review", "request_referral"],
    })
  }
  if (symptoms.neurologicDeficit) {
    findings.push({
      key: "neurologicDeficit",
      label: "New neurologic deficit",
      cancerContext: "urgent symptom evaluation",
      nextSteps: ["seek_urgent_care", "request_specialist_review"],
    })
  }
  if (symptoms.severePain) {
    findings.push({
      key: "severePain",
      label: "Severe new pain",
      cancerContext: "urgent symptom evaluation",
      nextSteps: ["seek_urgent_care", "request_specialist_review"],
    })
  }
  if (symptoms.otherRedFlags?.length) {
    findings.push({
      key: "otherRedFlags",
      label: symptoms.otherRedFlags.slice(0, 2).join(", "),
      cancerContext: "reported red-flag symptom",
      nextSteps: ["request_specialist_review", "request_care_navigation"],
    })
  }

  return findings
}
