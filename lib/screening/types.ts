export type SexAtBirth = "female" | "male" | "intersex" | "unknown"

export type ScreeningRelationship =
  | "mother"
  | "father"
  | "sibling"
  | "child"
  | "second_degree"
  | "other"

export type ScreeningNextStep =
  | "request_care_navigation"
  | "request_referral"
  | "request_imaging"
  | "request_lab"
  | "request_colonoscopy"
  | "request_mammogram"
  | "request_ldct"
  | "request_cervical_screening"
  | "request_psa_discussion"
  | "request_genetic_counseling"
  | "request_specialist_review"
  | "download_clinician_summary"
  | "seek_urgent_care"

export type ScreeningStatus =
  | "due"
  | "not_due"
  | "discuss"
  | "high_risk"
  | "urgent_clinician_review"
  | "surveillance_or_follow_up"
  | "unknown"
  | "needs_clinician_review"

export type ScreeningRiskCategory =
  | "average_risk"
  | "increased_risk"
  | "high_risk"
  | "hereditary_risk"
  | "personal_history"
  | "symptomatic"
  | "unknown"

export type ScreeningSourceSystem = "USPSTF" | "NCCN" | "ACG" | "USMSTF" | "ACS" | "LOCAL" | "PENDING"

export type GuidelineSource = {
  id: string
  organization: ScreeningSourceSystem
  topic: string
  versionOrDate: string
  url?: string
  notes?: string
}

export type ScreeningIntake = {
  patientId?: string
  demographics: {
    age?: number
    dateOfBirth?: string
    sexAtBirth?: SexAtBirth
    genderIdentity?: string
  }
  personalHistory: {
    cancers?: Array<{
      type: string
      diagnosisAge?: number
      year?: number
    }>
    colonPolyps?: boolean
    advancedAdenoma?: boolean
    inflammatoryBowelDisease?: boolean
    priorChestRadiation?: boolean
    immunosuppression?: boolean
    hysterectomy?: boolean
    cervixPresent?: boolean
  }
  familyHistory: Array<{
    relationship: ScreeningRelationship
    cancerType: string
    diagnosisAge?: number
    knownMutation?: string
  }>
  genetics: {
    knownPathogenicVariants?: Array<{
      gene: string
      variant?: string
      classification?: "pathogenic" | "likely_pathogenic" | "unknown"
    }>
    priorGeneticCounseling?: boolean
    priorGeneticTesting?: boolean
  }
  smoking: {
    currentSmoker?: boolean
    formerSmoker?: boolean
    packYears?: number
    quitYearsAgo?: number
  }
  priorScreening: Array<{
    screeningType: string
    date?: string
    result?: "normal" | "abnormal" | "unknown"
    details?: string
  }>
  symptoms: {
    rectalBleeding?: boolean
    unexplainedWeightLoss?: boolean
    breastMass?: boolean
    hemoptysis?: boolean
    abnormalUterineBleeding?: boolean
    neurologicDeficit?: boolean
    severePain?: boolean
    otherRedFlags?: string[]
  }
}

export type ScreeningRecommendation = {
  id: string
  cancerType: string
  screeningName: string
  status: ScreeningStatus
  riskCategory: ScreeningRiskCategory
  rationale: string
  recommendedNextStep: string
  suggestedTiming?: string
  dueDate?: string
  sourceSystem: ScreeningSourceSystem
  sourceId?: string
  sourceVersion?: string
  evidenceGrade?: string
  requiresClinicianReview: boolean
  patientFriendlyExplanation: string
  clinicianSummary: string
  nextSteps: ScreeningNextStep[]
}

export type ScreeningEngineResult = {
  generatedAt: string
  intakeCompleteness: "minimal" | "partial" | "actionable"
  recommendations: ScreeningRecommendation[]
  safetyMessages: string[]
  sourceIds: string[]
}
