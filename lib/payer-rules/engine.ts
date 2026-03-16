/**
 * OpenRx Payer Rules Engine
 * Deterministic, evidence-based PA criteria evaluation.
 * Sources: LCD/NCD, NCCN, FDA-approved labeling, payer published criteria.
 */

// ── Types ─────────────────────────────────────────────────────────────

export interface CriterionDef {
  id: string
  label: string
  description: string
  required: boolean
  evidenceLevel?: string  // 1, 2A, 2B, 3, etc.
  source?: string
}

export interface StepTherapyRequirement {
  drug: string
  minWeeks: number
  reason: string
}

export interface IndicationDx {
  icd10: string
  label: string
}

export interface PayerDrugRule {
  drugClass: string
  genericNames: string[]
  brandNames: string[]
  hcpcsCodes: string[]
  indicationsDx: IndicationDx[]
  criteria: CriterionDef[]
  stepTherapy: StepTherapyRequirement[]
  remsRequired: boolean
  remsProgram?: string
  formularyTier?: number
  nccnCategory?: string
  guidelineReferences: string[]
}

export interface CriteriaEvalInput {
  drugName?: string
  hcpcsCode?: string
  icd10Codes?: string[]
  priorTherapies?: string[]
  clinicalNotes?: string
  ecogScore?: number
  payer?: string
}

export interface CriteriaEvalResult {
  found: boolean
  drug?: string
  drugClass?: string
  score: number
  approvalLikelihood: "HIGH" | "MODERATE" | "LOW"
  criteria: {
    met: Array<CriterionDef & { met: true }>
    missing: Array<CriterionDef & { met: false }>
  }
  stepTherapy: { met: boolean; gaps: string[] }
  rems: { required: boolean; program?: string | null }
  formulary: { onFormulary: boolean; tier?: number; pa_required: boolean; notes?: string }
  payerOverride: { additionalCriteria: string[]; preferredBiosimilar?: string } | null
  warnings: string[]
  recommendations: string[]
  guidelines: { nccnCategory?: string; references: string[] }
  message?: string
}

// ── Drug Rule Definitions ─────────────────────────────────────────────

export const DRUG_RULES: PayerDrugRule[] = [
  // ── BCMA Bispecific (Teclistamab) ──────────────────────────────────
  {
    drugClass: "BCMA_BISPECIFIC",
    genericNames: ["teclistamab"],
    brandNames: ["Talvey"],
    hcpcsCodes: ["J9269"],
    indicationsDx: [
      { icd10: "C90.01", label: "Multiple myeloma, in relapse" },
      { icd10: "C90.11", label: "Plasma cell leukemia, in relapse" },
    ],
    criteria: [
      {
        id: "bcma-rrmm",
        label: "Relapsed/Refractory Multiple Myeloma",
        description: "Patient has RRMM with progression on or after ≥4 prior lines of therapy",
        required: true,
        evidenceLevel: "1",
        source: "MajesTEC-1 trial (NEJM 2022)",
      },
      {
        id: "bcma-priorlines",
        label: "≥4 Prior Lines of Therapy",
        description: "Must have received a proteasome inhibitor, IMiD, and anti-CD38 antibody",
        required: true,
        evidenceLevel: "1",
        source: "FDA label",
      },
      {
        id: "bcma-pi",
        label: "Prior Proteasome Inhibitor",
        description: "Exposure to bortezomib, carfilzomib, or ixazomib",
        required: true,
        evidenceLevel: "1",
        source: "NCCN Multiple Myeloma v2.2024",
      },
      {
        id: "bcma-imid",
        label: "Prior IMiD",
        description: "Exposure to lenalidomide or pomalidomide",
        required: true,
        evidenceLevel: "1",
        source: "FDA label",
      },
      {
        id: "bcma-cd38",
        label: "Prior Anti-CD38 Antibody",
        description: "Exposure to daratumumab or isatuximab",
        required: true,
        evidenceLevel: "1",
        source: "FDA label",
      },
      {
        id: "bcma-ecog",
        label: "ECOG Performance Status 0–2",
        description: "Patient has ECOG PS ≤2 (ambulatory and capable of self-care)",
        required: true,
        evidenceLevel: "2A",
        source: "NCCN supportive care guidelines",
      },
    ],
    stepTherapy: [
      { drug: "bortezomib or carfilzomib", minWeeks: 8, reason: "Proteasome inhibitor requirement" },
      { drug: "lenalidomide or pomalidomide", minWeeks: 8, reason: "IMiD exposure required" },
      { drug: "daratumumab or isatuximab", minWeeks: 6, reason: "Anti-CD38 antibody required" },
    ],
    remsRequired: true,
    remsProgram: "TALVEY REMS (hospitalization for step-up dosing)",
    formularyTier: 5,
    nccnCategory: "2A",
    guidelineReferences: [
      "MajesTEC-1: ORR 61.8%, CR 28.5% in RRMM ≥4L (NEJM 2022)",
      "FDA approval Aug 2023 (accelerated approval)",
      "NCCN Multiple Myeloma v2.2024 — Category 2A preferred",
    ],
  },

  // ── CAR-T (Axicabtagene/Tisagenlecleucel) ──────────────────────────
  {
    drugClass: "CAR_T",
    genericNames: ["axicabtagene ciloleucel", "tisagenlecleucel", "lisocabtagene maraleucel"],
    brandNames: ["Yescarta", "Kymriah", "Breyanzi"],
    hcpcsCodes: ["Q2055", "Q2041", "Q2056"],
    indicationsDx: [
      { icd10: "C83.30", label: "Diffuse large B-cell lymphoma (DLBCL)" },
      { icd10: "C91.10", label: "Chronic lymphocytic leukemia/small lymphocytic lymphoma" },
      { icd10: "C90.01", label: "Multiple myeloma, in relapse" },
    ],
    criteria: [
      {
        id: "cart-r2",
        label: "Relapsed/Refractory after ≥2 Prior Lines",
        description: "Large B-cell lymphoma progressed after ≥2 prior lines including anthracycline + anti-CD20",
        required: true,
        evidenceLevel: "1",
        source: "ZUMA-1 trial / JULIET trial",
      },
      {
        id: "cart-transplant-eval",
        label: "Transplant Evaluation or Ineligibility",
        description: "Autologous SCT ineligible OR post-ASCT relapse within 12 months",
        required: true,
        evidenceLevel: "1",
        source: "FDA label",
      },
      {
        id: "cart-rems",
        label: "REMS-Certified Treatment Center",
        description: "Administration only at authorized treatment center enrolled in REMS",
        required: true,
        evidenceLevel: "1",
        source: "FDA REMS requirement",
      },
      {
        id: "cart-ecog",
        label: "ECOG Performance Status 0–1",
        description: "Adequate performance status for CAR-T therapy and CRS management",
        required: true,
        evidenceLevel: "2A",
        source: "NCCN B-Cell Lymphomas v5.2024",
      },
    ],
    stepTherapy: [
      { drug: "R-CHOP or equivalent anthracycline-based chemoimmunotherapy", minWeeks: 18, reason: "First-line requirement" },
      { drug: "salvage chemotherapy (R-ICE, R-DHAP, R-GemOx)", minWeeks: 6, reason: "Second-line salvage required" },
    ],
    remsRequired: true,
    remsProgram: "YESCARTA REMS / KYMRIAH REMS (Risk Evaluation and Mitigation Strategy)",
    formularyTier: 5,
    nccnCategory: "1",
    guidelineReferences: [
      "ZUMA-1: ORR 83%, CR 58% in r/r LBCL (Locke et al., NEJM 2019)",
      "JULIET: ORR 52%, CR 40% in r/r DLBCL (Schuster et al., NEJM 2019)",
      "NCCN B-Cell Lymphomas v5.2024 — Category 1 recommendation",
    ],
  },

  // ── FLT3 Inhibitor (Gilteritinib) ─────────────────────────────────
  {
    drugClass: "FLT3_INHIBITOR",
    genericNames: ["gilteritinib", "midostaurin", "quizartinib"],
    brandNames: ["Xospata", "Rydapt", "Vanflyta"],
    hcpcsCodes: ["J9202"],
    indicationsDx: [
      { icd10: "C91.00", label: "Acute myeloid leukemia (AML), FLT3-mutated" },
      { icd10: "C91.02", label: "AML, in relapse" },
    ],
    criteria: [
      {
        id: "flt3-mutation",
        label: "FLT3 Mutation Confirmed (ITD or TKD)",
        description: "Positive FLT3-ITD or FLT3-TKD mutation on validated molecular assay",
        required: true,
        evidenceLevel: "1",
        source: "ADMIRAL trial — FDA label",
      },
      {
        id: "flt3-rr-aml",
        label: "Relapsed or Refractory AML",
        description: "R/R AML with FLT3 mutation after ≥1 prior AML therapy",
        required: true,
        evidenceLevel: "1",
        source: "ADMIRAL trial (NEJM 2019)",
      },
      {
        id: "flt3-labs",
        label: "Adequate Organ Function",
        description: "AST/ALT ≤2.5× ULN, creatinine ≤1.5× ULN, bilirubin ≤1.5× ULN",
        required: true,
        evidenceLevel: "2A",
        source: "FDA label",
      },
    ],
    stepTherapy: [
      { drug: "induction chemotherapy (7+3 or equivalent)", minWeeks: 4, reason: "Prior AML treatment required" },
    ],
    remsRequired: false,
    formularyTier: 4,
    nccnCategory: "1",
    guidelineReferences: [
      "ADMIRAL trial: OS 9.3 vs 5.6 months vs salvage chemo (NEJM 2019)",
      "FDA approval Nov 2018 (gilteritinib) for r/r FLT3+ AML",
      "NCCN AML v3.2024 — Preferred regimen for FLT3+ r/r AML",
    ],
  },

  // ── PD-1/PD-L1 (Pembrolizumab) ────────────────────────────────────
  {
    drugClass: "PD1_PDL1",
    genericNames: ["pembrolizumab", "nivolumab", "atezolizumab", "durvalumab"],
    brandNames: ["Keytruda", "Opdivo", "Tecentriq", "Imfinzi"],
    hcpcsCodes: ["J9271", "J9299"],
    indicationsDx: [
      { icd10: "C34.10", label: "Non-small cell lung cancer" },
      { icd10: "C18.9", label: "Colorectal cancer, MSI-H/dMMR" },
      { icd10: "C43.9", label: "Melanoma" },
      { icd10: "C61", label: "Prostate cancer" },
    ],
    criteria: [
      {
        id: "pd1-biomarker",
        label: "PD-L1 Expression or MSI-H/TMB-H Testing",
        description: "PD-L1 IHC ≥1% (TPS) OR MSI-H/dMMR OR TMB ≥10 mut/Mb confirmed",
        required: true,
        evidenceLevel: "1",
        source: "KEYNOTE-024/189/590/158",
      },
      {
        id: "pd1-egfr-alk",
        label: "EGFR/ALK Mutation Status (NSCLC)",
        description: "No actionable EGFR, ALK, ROS1, BRAF, MET exon 14 mutations for NSCLC",
        required: false,
        evidenceLevel: "1",
        source: "NCCN NSCLC v8.2024",
      },
      {
        id: "pd1-autoimmune",
        label: "No Active Autoimmune Disease",
        description: "No active autoimmune conditions requiring systemic steroids >10 mg/day",
        required: true,
        evidenceLevel: "2A",
        source: "FDA label",
      },
    ],
    stepTherapy: [],
    remsRequired: false,
    formularyTier: 4,
    nccnCategory: "1",
    guidelineReferences: [
      "KEYNOTE-024: PFS 10.3 vs 6.0 months in PD-L1 ≥50% NSCLC (NEJM 2016)",
      "KEYNOTE-189: OS improvement in non-squamous NSCLC (NEJM 2018)",
      "NCCN NSCLC v8.2024 — First-line preference for PD-L1 ≥50%",
    ],
  },

  // ── IL-4/IL-13 (Dupilumab) ────────────────────────────────────────
  {
    drugClass: "IL4_IL13",
    genericNames: ["dupilumab", "tralokinumab"],
    brandNames: ["Dupixent", "Adbry"],
    hcpcsCodes: ["J0173"],
    indicationsDx: [
      { icd10: "L20.9", label: "Atopic dermatitis" },
      { icd10: "J45.50", label: "Severe persistent asthma" },
      { icd10: "J32.9", label: "Chronic rhinosinusitis with nasal polyps" },
    ],
    criteria: [
      {
        id: "dup-severity",
        label: "Moderate-to-Severe Atopic Dermatitis",
        description: "EASI score ≥16 or IGA ≥3 on optimized topical therapy",
        required: true,
        evidenceLevel: "1",
        source: "SOLO-1/SOLO-2 trials",
      },
      {
        id: "dup-topical-fail",
        label: "Inadequate Response to Topical Therapies",
        description: "Failed adequate trial of medium-high potency topical corticosteroids ≥4 weeks",
        required: true,
        evidenceLevel: "1",
        source: "NCCN / AAD Guidelines 2023",
      },
      {
        id: "dup-systemic-fail",
        label: "Systemic Therapy Trial (Moderate/Severe)",
        description: "For moderate-severe AD: failed or contraindicated cyclosporine or methotrexate",
        required: false,
        evidenceLevel: "2A",
        source: "Payer policies (Aetna, UHC, Cigna)",
      },
    ],
    stepTherapy: [
      { drug: "mid-to-high potency topical corticosteroid (e.g., triamcinolone 0.1%)", minWeeks: 4, reason: "First-line requirement per NCCN/AAD" },
    ],
    remsRequired: false,
    formularyTier: 4,
    nccnCategory: "1",
    guidelineReferences: [
      "SOLO-1/SOLO-2: 36–38% clear/almost clear vs 8–10% placebo at 16 weeks (NEJM 2016)",
      "LIBERTY ASTHMA QUEST: 48% annualized exacerbation rate reduction (NEJM 2018)",
      "AAD Atopic Dermatitis Guidelines 2023 — Strong recommendation",
    ],
  },

  // ── TNF Inhibitor (Adalimumab) ─────────────────────────────────────
  {
    drugClass: "TNF_INHIBITOR",
    genericNames: ["adalimumab", "etanercept", "infliximab", "certolizumab", "golimumab"],
    brandNames: ["Humira", "Enbrel", "Remicade", "Cimzia", "Simponi", "Hadlima", "Hyrimoz", "Cyltezo"],
    hcpcsCodes: ["J0135", "J1438"],
    indicationsDx: [
      { icd10: "M06.9", label: "Rheumatoid arthritis" },
      { icd10: "L40.0", label: "Psoriasis vulgaris" },
      { icd10: "K50.90", label: "Crohn's disease" },
      { icd10: "M45.9", label: "Ankylosing spondylitis" },
    ],
    criteria: [
      {
        id: "tnf-dmard-fail",
        label: "Inadequate Response to csDMARDs (RA)",
        description: "Failed ≥2 conventional DMARDs (methotrexate + one other) at adequate dose/duration",
        required: true,
        evidenceLevel: "1",
        source: "ACR Guidelines 2021",
      },
      {
        id: "tnf-tb-screen",
        label: "TB Screening (Negative or Treated)",
        description: "Negative PPD or IGRA; if positive, completed LTBI treatment",
        required: true,
        evidenceLevel: "1",
        source: "FDA label",
      },
      {
        id: "tnf-infection-screen",
        label: "No Active Serious Infection",
        description: "No active serious infections, opportunistic infections, or sepsis",
        required: true,
        evidenceLevel: "1",
        source: "FDA label — boxed warning",
      },
    ],
    stepTherapy: [
      { drug: "methotrexate (MTX) 15–25 mg/week", minWeeks: 12, reason: "Anchor DMARD required" },
      { drug: "hydroxychloroquine or sulfasalazine", minWeeks: 8, reason: "Second csDMARD required" },
    ],
    remsRequired: false,
    formularyTier: 4,
    nccnCategory: undefined,
    guidelineReferences: [
      "ACR RA Guidelines 2021 — TNFi preferred second-line after MTX failure",
      "Multiple biosimilars available (Hadlima, Hyrimoz) — payer may require step-through",
      "ARMOR trial: Biosimilar adalimumab non-inferior to originator Humira",
    ],
  },

  // ── GLP-1 Agonist (Semaglutide) ───────────────────────────────────
  {
    drugClass: "GLP1",
    genericNames: ["semaglutide", "liraglutide", "tirzepatide", "dulaglutide"],
    brandNames: ["Ozempic", "Wegovy", "Victoza", "Mounjaro", "Zepbound", "Trulicity"],
    hcpcsCodes: ["J3490"],
    indicationsDx: [
      { icd10: "E11.9", label: "Type 2 diabetes mellitus" },
      { icd10: "E66.9", label: "Obesity, BMI ≥30" },
      { icd10: "E66.01", label: "Morbid (severe) obesity" },
    ],
    criteria: [
      {
        id: "glp1-t2dm-or-obesity",
        label: "T2DM or Obesity Diagnosis",
        description: "Confirmed T2DM (A1c ≥7%) or obesity BMI ≥30 (≥27 with weight-related comorbidity for Wegovy)",
        required: true,
        evidenceLevel: "1",
        source: "SUSTAIN-6 / STEP-1 trials",
      },
      {
        id: "glp1-a1c",
        label: "HbA1c ≥7.0% (for T2DM indication)",
        description: "Documented HbA1c ≥7.0% within past 3 months on current regimen",
        required: false,
        evidenceLevel: "2A",
        source: "Aetna CP.PHAR.376 / UHC CS-PHARM.177",
      },
      {
        id: "glp1-metformin",
        label: "Metformin Trial (T2DM, if tolerated)",
        description: "Trial of metformin at maximum tolerated dose for ≥3 months unless contraindicated",
        required: true,
        evidenceLevel: "1",
        source: "ADA Standards of Medical Care 2024",
      },
    ],
    stepTherapy: [
      { drug: "metformin (if tolerated)", minWeeks: 12, reason: "ADA first-line; payers require prior failure or contraindication" },
    ],
    remsRequired: false,
    formularyTier: 3,
    nccnCategory: undefined,
    guidelineReferences: [
      "SUSTAIN-6: 26% MACE reduction with semaglutide in T2DM (NEJM 2016)",
      "STEP-1: 14.9% body weight reduction with Wegovy vs 2.4% placebo (NEJM 2021)",
      "ADA Standards of Medical Care 2024 — GLP-1 RA preferred add-on",
    ],
  },
]

// ── Payer Override Rules ──────────────────────────────────────────────

export interface PayerOverride {
  additionalCriteria: string[]
  preferredBiosimilar?: string
  formularyNote?: string
}

const PAYER_OVERRIDES: Record<string, Record<string, PayerOverride>> = {
  "United Healthcare": {
    TNF_INHIBITOR: {
      additionalCriteria: ["Step-through required: Hyrimoz or Hadlima (biosimilar adalimumab) before Humira"],
      preferredBiosimilar: "Hyrimoz (adalimumab-aqvh)",
      formularyNote: "Humira non-preferred; biosimilar preferred",
    },
  },
  UHC: {
    TNF_INHIBITOR: {
      additionalCriteria: ["Step-through required: Hyrimoz or Hadlima before Humira"],
      preferredBiosimilar: "Hyrimoz",
    },
  },
  Aetna: {
    GLP1: {
      additionalCriteria: [
        "HbA1c ≥7.0% documented within 3 months (T2DM indication)",
        "BMI ≥30 or ≥27 with comorbidity (obesity indication)",
        "Lifestyle intervention program participation recommended",
      ],
    },
    CAR_T: {
      additionalCriteria: [
        "Case Management enrollment required prior to authorization",
        "Outcomes registry participation required",
      ],
    },
  },
  Cigna: {
    CAR_T: {
      additionalCriteria: [
        "Case management program required: Cigna Oncology Case Management",
        "Outcomes registry enrollment required for CAR-T",
        "Treatment at Cigna-designated CAR-T center of excellence",
      ],
    },
  },
  Medicare: {
    BCMA_BISPECIFIC: {
      additionalCriteria: [
        "LCD L38551 compliance required",
        "Documentation of ≥4 prior lines with PI, IMiD, anti-CD38",
        "REMS enrollment verified by MAC",
      ],
    },
    CAR_T: {
      additionalCriteria: [
        "Medicare Coverage Analysis — NCD 110.24 applies",
        "REMS-authorized facility required",
        "Clinical trial participation may be required for certain indications",
      ],
    },
  },
}

// ── Formulary Database ────────────────────────────────────────────────

function getFormularyInfo(drugClass: string): { onFormulary: boolean; tier?: number; pa_required: boolean; notes?: string } {
  const tierMap: Record<string, number> = {
    BCMA_BISPECIFIC: 5,
    CAR_T: 5,
    FLT3_INHIBITOR: 4,
    PD1_PDL1: 4,
    IL4_IL13: 4,
    TNF_INHIBITOR: 4,
    GLP1: 3,
  }
  const tier = tierMap[drugClass]
  return {
    onFormulary: !!tier,
    tier,
    pa_required: true,
    notes: tier === 5 ? "Specialty tier — requires specialty pharmacy" : tier === 4 ? "Non-preferred specialty" : "Preferred brand",
  }
}

// ── Core Evaluation Function ──────────────────────────────────────────

export function evaluatePACriteria(input: CriteriaEvalInput): CriteriaEvalResult {
  const { drugName = "", hcpcsCode = "", icd10Codes = [], priorTherapies = [], clinicalNotes = "", ecogScore, payer = "" } = input

  // Find matching rule
  const rule = findRule(drugName, hcpcsCode)

  if (!rule) {
    return {
      found: false,
      score: 0,
      approvalLikelihood: "LOW",
      criteria: { met: [], missing: [] },
      stepTherapy: { met: true, gaps: [] },
      rems: { required: false },
      formulary: { onFormulary: false, pa_required: true },
      payerOverride: null,
      warnings: [],
      recommendations: [],
      guidelines: { references: [] },
      message: `No payer rules found for "${drugName || hcpcsCode}". Supported drug classes: Teclistamab, CAR-T, Gilteritinib, Pembrolizumab, Dupilumab, Adalimumab, Semaglutide.`,
    }
  }

  // ── Criteria evaluation ───────────────────────────────────────────
  const met: Array<CriterionDef & { met: true }> = []
  const missing: Array<CriterionDef & { met: false }> = []

  for (const criterion of rule.criteria) {
    const isMet = checkCriterion(criterion, { icd10Codes, priorTherapies, clinicalNotes, ecogScore, rule })
    if (isMet) {
      met.push({ ...criterion, met: true })
    } else {
      missing.push({ ...criterion, met: false })
    }
  }

  // ── Step therapy ──────────────────────────────────────────────────
  const stepGaps: string[] = []
  for (const step of rule.stepTherapy) {
    const tried = priorTherapies.some((t) =>
      step.drug.split(" or ").some((d) => t.toLowerCase().includes(d.split(" ")[0].toLowerCase()))
    )
    if (!tried) {
      stepGaps.push(`${step.drug} (${step.minWeeks}+ weeks) — ${step.reason}`)
    }
  }

  // ── Scoring ───────────────────────────────────────────────────────
  const requiredCriteria = rule.criteria.filter((c) => c.required)
  const requiredMet = met.filter((c) => c.required).length
  const optionalMet = met.filter((c) => !c.required).length
  const stepTherapyMet = stepGaps.length === 0

  let score = 0
  if (requiredCriteria.length > 0) {
    score += (requiredMet / requiredCriteria.length) * 65
  } else {
    score += 65
  }
  if (rule.criteria.filter((c) => !c.required).length > 0) {
    score += (optionalMet / rule.criteria.filter((c) => !c.required).length) * 20
  } else {
    score += 20
  }
  if (stepTherapyMet) score += 15

  score = Math.round(Math.max(0, Math.min(100, score)))
  const approvalLikelihood: "HIGH" | "MODERATE" | "LOW" = score >= 85 ? "HIGH" : score >= 60 ? "MODERATE" : "LOW"

  // ── Warnings ──────────────────────────────────────────────────────
  const warnings: string[] = []
  if (rule.remsRequired) {
    warnings.push(`REMS required: ${rule.remsProgram}`)
  }
  if (missing.filter((c) => c.required).length > 0) {
    warnings.push(`${missing.filter((c) => c.required).length} required criteria not yet documented`)
  }
  if (stepGaps.length > 0) {
    warnings.push(`Step therapy gaps detected: ${stepGaps.length} drug(s) not documented`)
  }

  // ── Recommendations ───────────────────────────────────────────────
  const recommendations: string[] = []
  for (const gap of stepGaps) {
    recommendations.push(`Document or obtain: ${gap}`)
  }
  for (const m of missing.filter((c) => c.required)) {
    recommendations.push(`Provide documentation for: ${m.label} — ${m.description}`)
  }
  if (icd10Codes.length === 0) {
    recommendations.push("Ensure ICD-10 diagnosis codes are included in the PA request")
  }
  const validDx = rule.indicationsDx.some((d) => icd10Codes.includes(d.icd10))
  if (icd10Codes.length > 0 && !validDx) {
    recommendations.push(`Verify ICD-10 codes match approved indications: ${rule.indicationsDx.map((d) => d.icd10).join(", ")}`)
  }

  // ── Payer Override ────────────────────────────────────────────────
  const payerOverride = getPayerOverride(payer, rule.drugClass)

  return {
    found: true,
    drug: rule.brandNames[0],
    drugClass: rule.drugClass,
    score,
    approvalLikelihood,
    criteria: { met, missing },
    stepTherapy: { met: stepTherapyMet, gaps: stepGaps },
    rems: { required: rule.remsRequired, program: rule.remsProgram ?? null },
    formulary: getFormularyInfo(rule.drugClass),
    payerOverride,
    warnings,
    recommendations,
    guidelines: { nccnCategory: rule.nccnCategory, references: rule.guidelineReferences },
  }
}

// ── Helper: find rule ─────────────────────────────────────────────────

function findRule(drugName: string, hcpcsCode: string): PayerDrugRule | undefined {
  const drug = drugName.toLowerCase()
  const hcpcs = hcpcsCode.toUpperCase()
  return DRUG_RULES.find((r) =>
    r.hcpcsCodes.includes(hcpcs) ||
    r.genericNames.some((n) => drug.includes(n.split(" ")[0])) ||
    r.brandNames.some((n) => drug.includes(n.toLowerCase()))
  )
}

// ── Helper: evaluate individual criterion ─────────────────────────────

function checkCriterion(
  criterion: CriterionDef,
  ctx: {
    icd10Codes: string[]
    priorTherapies: string[]
    clinicalNotes: string
    ecogScore?: number
    rule: PayerDrugRule
  }
): boolean {
  const { icd10Codes, priorTherapies, clinicalNotes, ecogScore, rule } = ctx
  const notes = clinicalNotes.toLowerCase()
  const therapies = priorTherapies.map((t) => t.toLowerCase())

  // ECOG check
  if (criterion.id.includes("ecog")) {
    if (ecogScore !== undefined) return ecogScore <= (criterion.id.includes("cart") ? 1 : 2)
    if (notes.includes("ecog") || notes.includes("performance status")) return true
    return false
  }

  // Diagnosis check
  if (criterion.id.includes("rrmm") || criterion.id.includes("r2") || criterion.id.includes("rr-aml")) {
    const validDx = rule.indicationsDx.some((d) => icd10Codes.includes(d.icd10))
    return validDx || notes.includes("relapsed") || notes.includes("refractory")
  }

  // Prior therapy checks
  if (criterion.id.includes("priorlines") || criterion.id.includes("pi")) {
    return therapies.some((t) => t.includes("bortezomib") || t.includes("carfilzomib") || t.includes("ixazomib"))
  }
  if (criterion.id.includes("imid")) {
    return therapies.some((t) => t.includes("lenalidomide") || t.includes("pomalidomide") || t.includes("thalidomide"))
  }
  if (criterion.id.includes("cd38")) {
    return therapies.some((t) => t.includes("daratumumab") || t.includes("isatuximab"))
  }
  if (criterion.id.includes("dmard-fail")) {
    return therapies.some((t) => t.includes("methotrexate") || t.includes("mtx") || t.includes("hydroxychloroquine") || t.includes("sulfasalazine"))
  }
  if (criterion.id.includes("metformin")) {
    return therapies.some((t) => t.includes("metformin")) || notes.includes("metformin contraindicated")
  }
  if (criterion.id.includes("topical-fail")) {
    return therapies.some((t) => t.includes("corticosteroid") || t.includes("triamcinolone") || t.includes("betamethasone")) ||
           notes.includes("topical steroid failure")
  }

  // Biomarker checks
  if (criterion.id.includes("biomarker")) {
    return notes.includes("pd-l1") || notes.includes("msi-h") || notes.includes("tmb") || notes.includes("pdl1")
  }
  if (criterion.id.includes("flt3-mutation")) {
    return notes.includes("flt3") || notes.includes("flt-3")
  }

  // Safety checks — assume met if not explicitly contradicted
  if (criterion.id.includes("tb-screen") || criterion.id.includes("infection-screen") || criterion.id.includes("autoimmune")) {
    return notes.includes("tb negative") || notes.includes("igra negative") ||
           notes.includes("no active infection") || notes.includes("negative ppd") || therapies.length > 0
  }

  // Severity / diagnosis checks
  if (criterion.id.includes("severity") || criterion.id.includes("t2dm-or-obesity")) {
    return icd10Codes.length > 0 && rule.indicationsDx.some((d) => icd10Codes.includes(d.icd10))
  }

  // REMS check
  if (criterion.id.includes("rems")) {
    return notes.includes("rems") || notes.includes("authorized center")
  }

  // Labs
  if (criterion.id.includes("labs")) {
    return notes.includes("adequate hepatic") || notes.includes("normal labs") || notes.includes("organ function")
  }

  // Default: if ICD codes provided and match indication, assume criterion met
  return rule.indicationsDx.some((d) => icd10Codes.includes(d.icd10))
}

// ── Payer Override Lookup ─────────────────────────────────────────────

export function getPayerOverride(payer: string, drugClass: string): PayerOverride | null {
  const normalizedPayer = Object.keys(PAYER_OVERRIDES).find((p) =>
    payer.toLowerCase().includes(p.toLowerCase())
  )
  if (!normalizedPayer) return null
  return PAYER_OVERRIDES[normalizedPayer][drugClass] ?? null
}

// ── Formulary Check ───────────────────────────────────────────────────

export function isOnFormulary(drugName: string, hcpcsCode: string): { onFormulary: boolean; tier?: number; pa_required: boolean; notes?: string } {
  const rule = findRule(drugName, hcpcsCode)
  if (!rule) return { onFormulary: false, pa_required: true }
  return getFormularyInfo(rule.drugClass)
}
