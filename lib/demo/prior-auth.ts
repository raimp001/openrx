export type DemoScenarioId = "teclistamab-rrmm" | "semaglutide-t2dm" | "cart-dlbcl"
export type DemoAction = "retrieve_evidence" | "draft_appeal" | "submit_fhir"

export type DemoSource = {
  id: string
  label: string
  organization: string
  version: string
  url: string
  status: "public_source" | "licensed_verification_required" | "regulatory_context"
  relevance: string
}

export type DemoScenario = {
  id: DemoScenarioId
  shortLabel: string
  title: string
  specialty: string
  denialReason: string
  patientSummary: string[]
  request: string
  sourceBoundary: string
  sources: DemoSource[]
  appealSubject: string
  appealParagraphs: string[]
  documentChecklist: string[]
  trackingNumber: string
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "teclistamab-rrmm",
    shortLabel: "Teclistamab",
    title: "Teclistamab denied after 4 prior lines",
    specialty: "Hematology-oncology",
    denialReason: "Insufficient documentation of required prior therapies and medical necessity.",
    patientSummary: [
      "Synthetic case: adult with relapsed or refractory multiple myeloma",
      "Four prior lines documented: proteasome inhibitor, IMiD, anti-CD38 antibody, salvage regimen",
      "Requested therapy: Tecvayli (teclistamab-cqyv), HCPCS J9380",
    ],
    request: "Draft an appeal for Tecvayli after denial of medical necessity.",
    sourceBoundary: "NCCN guideline metadata is shown for workflow demonstration. A licensed, current guideline view must be verified before a real appeal is submitted.",
    sources: [
      {
        id: "fda-tecvayli-2026",
        label: "Tecvayli indication and REMS",
        organization: "FDA",
        version: "March 5, 2026",
        url: "https://www.fda.gov/drugs/resources-information-approved-drugs/fda-approves-teclistamab-combination-daratumumab-hyaluronidase-fihj-relapsed-or-refractory-multiple",
        status: "public_source",
        relevance: "FDA confirms teclistamab monotherapy for RRMM after at least four prior lines including a proteasome inhibitor, an IMiD, and an anti-CD38 antibody.",
      },
      {
        id: "nccn-mm-version",
        label: "Multiple Myeloma pathway",
        organization: "NCCN",
        version: "Version verification required",
        url: "https://www.nccn.org/guidelines/category_1",
        status: "licensed_verification_required",
        relevance: "Reference pathway for specialist review; content is not reproduced in this public demo.",
      },
      {
        id: "cms-pa-final-rule",
        label: "Prior Authorization API timing",
        organization: "CMS",
        version: "CMS-0057-F, January 17, 2024",
        url: "https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f",
        status: "regulatory_context",
        relevance: "CMS final-rule API mandate generally begins January 1, 2027 for applicable non-drug items and services; drug scope requires separate confirmation.",
      },
    ],
    appealSubject: "Appeal request: Tecvayli (teclistamab-cqyv) for relapsed or refractory multiple myeloma",
    appealParagraphs: [
      "This synthetic appeal requests reconsideration of the denial based on documented treatment history and the FDA-labeled monotherapy indication for relapsed or refractory multiple myeloma after at least four prior lines.",
      "The submitted record should include prior proteasome inhibitor, immunomodulatory agent, and anti-CD38 monoclonal antibody exposure, clinical status, treatment chronology, and required REMS site planning.",
      "Before a real submission, an authorized clinician must confirm current guideline alignment, patient-specific medical necessity, payer criteria, and supporting records.",
    ],
    documentChecklist: ["Treatment-line chronology", "Progression documentation", "FDA indication source", "REMS-capable care-site confirmation", "Signed clinician rationale"],
    trackingNumber: "DEMO-PA-MM-240526-001",
  },
  {
    id: "semaglutide-t2dm",
    shortLabel: "Semaglutide",
    title: "Semaglutide denied for T2DM with BMI 31",
    specialty: "Primary care and endocrinology",
    denialReason: "Step-therapy and indication documentation not present in initial request.",
    patientSummary: [
      "Synthetic case: adult with type 2 diabetes and BMI 31",
      "Requested therapy: semaglutide under a medical-benefit demonstration",
      "Missing packet item: prior therapy and recent glycemic documentation",
    ],
    request: "Draft an appeal focused on diagnosis and missing documentation.",
    sourceBoundary: "This case uses FDA and CMS regulatory context. It does not claim an NCCN or USPSTF indication pathway for semaglutide.",
    sources: [
      {
        id: "fda-ozempic",
        label: "Ozempic prescribing information index",
        organization: "FDA",
        version: "Current label must be confirmed at submission",
        url: "https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=209637",
        status: "public_source",
        relevance: "Reference point for labeled indication and clinician review of current prescribing information.",
      },
      {
        id: "cms-drug-pa-proposal",
        label: "Medical-benefit drug PA proposal",
        organization: "CMS",
        version: "CMS-0062-P, April 10, 2026, proposed rule",
        url: "https://www.cms.gov/newsroom/fact-sheets/2026-cms-interoperability-standards-prior-authorization-drugs-proposed-rule",
        status: "regulatory_context",
        relevance: "CMS proposed electronic PA API requirements for drugs covered under a medical benefit; this is not presented as a final requirement.",
      },
    ],
    appealSubject: "Appeal draft: semaglutide request for type 2 diabetes management",
    appealParagraphs: [
      "This synthetic appeal requests review after an initial denial for missing documentation. The packet should identify the requested product and indication, recent clinical measurements when relevant, and any required prior-treatment record.",
      "The source set is intentionally limited to public regulatory and label context. The payer's current policy and the clinician's patient-specific judgment control any real request.",
      "Before submission, authorized staff must verify benefit channel, formulary criteria, step-therapy requirements, and all patient-specific records.",
    ],
    documentChecklist: ["Benefit channel confirmation", "Diagnosis documentation", "Recent relevant laboratory value if required", "Prior therapy record", "Clinician attestation"],
    trackingNumber: "DEMO-PA-PCP-240526-002",
  },
  {
    id: "cart-dlbcl",
    shortLabel: "CAR-T",
    title: "CAR-T denied, R/R DLBCL",
    specialty: "Cellular therapy",
    denialReason: "Payer requested documentation of prior lines and authorized treatment-center eligibility.",
    patientSummary: [
      "Synthetic case: adult with relapsed or refractory diffuse large B-cell lymphoma",
      "Requested treatment: CAR-T evaluation after prior systemic therapy",
      "Missing packet items: treatment chronology and center documentation",
    ],
    request: "Prepare an appeal packet for CAR-T evaluation and treatment authorization.",
    sourceBoundary: "Specialty guideline metadata is provided as a retrieval checkpoint only. Real eligibility and treatment selection require a cellular-therapy team.",
    sources: [
      {
        id: "fda-cart-products",
        label: "Approved cellular and gene therapy products",
        organization: "FDA",
        version: "Accessed for demo metadata, May 2026",
        url: "https://www.fda.gov/vaccines-blood-biologics/cellular-gene-therapy-products/approved-cellular-and-gene-therapy-products",
        status: "public_source",
        relevance: "Public regulatory source for approved CAR-T products and treatment-center safety context.",
      },
      {
        id: "nccn-b-cell-version",
        label: "B-Cell Lymphomas pathway",
        organization: "NCCN",
        version: "Version verification required",
        url: "https://www.nccn.org/guidelines/category_1",
        status: "licensed_verification_required",
        relevance: "Specialist pathway reference; the guideline text is not reproduced in this demo.",
      },
      {
        id: "cms-pa-final-rule-cart",
        label: "Prior Authorization API timing",
        organization: "CMS",
        version: "CMS-0057-F, January 17, 2024",
        url: "https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f",
        status: "regulatory_context",
        relevance: "Regulatory context for future FHIR PA workflow readiness.",
      },
    ],
    appealSubject: "Appeal request: CAR-T pathway review for relapsed or refractory DLBCL",
    appealParagraphs: [
      "This synthetic appeal asks the payer to reconsider after supporting records are assembled for a relapsed or refractory DLBCL cellular-therapy pathway.",
      "The packet should include prior regimen chronology, relapse or refractory status, specialist evaluation, proposed authorized treatment center, and any payer-specific requirements.",
      "A cellular-therapy clinician must validate product selection, eligibility, guideline version, and safety requirements before a real request proceeds.",
    ],
    documentChecklist: ["Prior lines and response record", "Pathology and disease-status confirmation", "Cellular-therapy consult note", "Authorized treatment-center documentation", "Clinician signature"],
    trackingNumber: "DEMO-PA-CART-240526-003",
  },
]

export function getDemoScenario(id: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((scenario) => scenario.id === id)
}

export function evidenceResponse(scenario: DemoScenario) {
  return {
    sandbox: true as const,
    scenarioId: scenario.id,
    sources: scenario.sources,
    boundary: scenario.sourceBoundary,
    retrievedAt: new Date().toISOString(),
  }
}

export function appealResponse(scenario: DemoScenario) {
  return {
    sandbox: true as const,
    scenarioId: scenario.id,
    subject: scenario.appealSubject,
    paragraphs: scenario.appealParagraphs,
    documentChecklist: scenario.documentChecklist,
    citations: scenario.sources,
    reviewRequired: "Clinician review and payer-specific verification are required before any external submission.",
  }
}

export function fhirSubmissionResponse(scenario: DemoScenario) {
  return {
    sandbox: true as const,
    scenarioId: scenario.id,
    trackingNumber: scenario.trackingNumber,
    status: "accepted_for_demo_tracking" as const,
    liveSubmission: false as const,
    notice: "Simulation complete. No patient data was transmitted and no payer received a prior authorization request.",
    mcpCall: {
      tool: "prior_authorization.submit",
      adapterStatus: "simulated",
      transport: "FHIR R4 / Da Vinci PAS sandbox adapter",
      endpoint: "sandbox://openrx/payer/prior-auth",
      payload: {
        resourceType: "Bundle",
        type: "message",
        purpose: "prior-authorization-appeal-demo",
        scenarioId: scenario.id,
      },
    },
  }
}
