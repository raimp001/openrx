# Healthcare Navigation Agent Prompt Pack

Use these prompts as scoped builder tasks. Run them in order and keep each implementation small enough to review.

## Prompt 1: System Architecture & Compliance Foundation

Build the HIPAA-sensitive data foundation for OpenRx patient navigation. Implement a data-flow diagram, PHI boundary map, Safe Harbor-oriented de-identification helper for logs and prompts, immutable audit-log design, and a HIPAA Security Rule checklist covering administrative, physical, and technical safeguards. Do not claim legal HIPAA compliance until counsel, BAAs, risk analysis, and production controls are complete.

## Prompt 2: Clinical Safety & Guardrails

Design and enforce the clinical safety layer. Every screening recommendation must come from a deterministic, version-stamped rules engine keyed to USPSTF, ACS, NCCN, ACOG, ACG, USMSTF, or other approved guideline data. The LLM may parse and explain only. Escalate to clinician review when confidence is below 0.85, source metadata is incomplete, symptoms are present, or the engine lacks a rule.

## Prompt 3: Interoperability & Integration Design

Specify FHIR R4 mappings for `Patient`, `FamilyMemberHistory`, `CarePlan`, `ServiceRequest`, `Appointment`, `MedicationRequest`, `Communication`, `Consent`, `AuditEvent`, and `Provenance`. Design SMART on FHIR authorization, ClinicalTrials.gov v2 matching, NPPES/NPI lookup, pharmacy and e-prescribing connection points, and secure messaging using FHIR Communication resources.

## Prompt 4: Product Design & User Experience

Design differentiated onboarding for patients, caregivers, providers, labs, and imaging centers. The patient core loop must stay single-input and conversational, with a structured care brief written around a sixth-grade reading level. Enforce WCAG 2.2 AA contrast, keyboard access, mobile-first layout, and a Kanban-style task system with stale-task detection.

## Prompt 5: Agent Reasoning & SOUL.md Configuration

Create or update `SOUL.md` with core directives, clinical boundaries, tone, multi-agent roles, confidence calibration, and graceful fallback protocols. Include Screening, Navigation, Coverage, Messaging, Trial Matching, and Compliance agents. The LLM must never author clinical recommendations or decide PHI disclosure scope.

## Prompt 6: Business, Regulatory & Transparency Framework

Build the transparency framework: FDA CDS classification analysis, truthful certification/BAA/SOC2 status, security contact, clinical source policy, pilot strategy, IRB protocol outline when research is involved, and unit economics model. Avoid "HIPAA compliant" and "FDA cleared" claims until evidence exists.

## Prompt 7: Evaluation & Continuous Improvement

Build a 500+ scenario golden test set covering average-risk, high-risk, hereditary-risk, symptomatic, prior-screening, and unclear-input cases. Track patient experience metrics, care-gap closure, referral completion, agent latency, token cost, drift, source completeness, and safety events. Add a safety-event reporting SOP with owner, severity, and remediation SLAs.

## Prompt 8: Production Deployment & DevOps

Design the production path for PHI: HIPAA-eligible cloud services, infrastructure as code, security scanning, blue-green deployment, rollback, SIEM integration, backup/restore tests, incident response, and breach notification workflow. No PHI persistence or provider disclosure should launch without `/cso` approval, BAAs, risk analysis, and audited controls.
