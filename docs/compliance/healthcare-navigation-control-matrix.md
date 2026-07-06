# Healthcare Navigation Control Matrix

Date: July 6, 2026

Scope: patient screening, care navigation, provider onboarding, referral handoffs, clinician copilot, and future interoperability work. This is an engineering control matrix, not legal advice.

## Architecture Principle

The LLM is a language interface. It parses, explains, drafts, and routes. It does not author clinical screening recommendations, decide PHI relevance, interpret genetics, place orders, or determine referral disclosure scope. Those outputs come from versioned deterministic rules, consent templates, provider verification gates, and audit-logged workflows.

## Prompt Pack To Build Artifacts

| Prompt | Required artifact | Current repo anchor | Next enforcement gap |
| --- | --- | --- | --- |
| System Architecture & Compliance Foundation | PHI-minimizing data flow, de-identification helper, immutable audit strategy, HIPAA Security Rule checklist | `lib/phi-deidentification.ts`, `lib/audit.ts`, `docs/compliance/hipaa-readiness-shelf.md` | Move audit persistence to append-only storage with tamper-evident hash chaining before PHI pilots |
| Clinical Safety & Guardrails | Versioned screening rules, source metadata, escalation threshold, clinician review protocol | `lib/screening/recommend.ts`, `lib/screening/types.ts`, `tests/unit/deterministic-clinical.test.ts`, `SOUL.md` | Add clinician-reviewed golden vignettes for NCCN/ACG/USMSTF edge cases |
| Interoperability & Integration Design | FHIR R4 mapping, SMART on FHIR launch plan, trial/provider/pharmacy API adapters | `lib/referral-disclosure.ts`, `lib/npi-care-search.ts`, `app/(app)/clinical-trials` | Add typed FHIR DTOs and validation fixtures before any EHR pilot |
| Product Design & UX | patient/caregiver/provider flows, 6th-grade care brief, WCAG 2.2 AA, task stale-state model | app routes and design-token work | Add automated contrast snapshots and keyboard-path checks to every patient workflow |
| Agent Reasoning & SOUL.md | system boundary file, multi-agent roles, confidence fallback | `SOUL.md`, `lib/observability/log.ts` | Add CI assertion that agent prompts include the model-boundary clause |
| Business, Regulatory & Transparency | FDA CDS posture, transparency page, pilot strategy, unit economics | `docs/compliance/hipaa-readiness-shelf.md`, public trust copy | Publish a `/trust` page with current certification/BAA status and security contact |
| Evaluation & Continuous Improvement | 500+ scenario golden set, patient experience metrics, latency/cost/drift monitoring, safety SOP | `lib/clinical-regression.ts`, `reports/clinical-regression-latest.md` | Expand regression set from MVP cases to 500 clinician-reviewed scenarios |
| Production Deployment & DevOps | HIPAA-eligible cloud plan, IaC, CI/CD gates, SIEM, breach protocol | deploy probes and health endpoints | Add infrastructure-as-code and security review gates before production PHI persistence |

## HIPAA Security Rule Control Checklist

HHS summarizes the Security Rule around administrative, physical, and technical safeguards that protect electronic PHI confidentiality, integrity, and availability. OpenRx maps that into these build gates:

| Control area | Engineering requirement | Evidence before PHI pilot |
| --- | --- | --- |
| Risk analysis | Inventory systems that create, receive, maintain, or transmit ePHI | Signed risk analysis, data-flow diagram, remediation tracker |
| Access control | Least privilege, MFA, production role separation, provider/patient RBAC | Access review export and RBAC tests |
| Audit controls | Per-action audit logs for recommendation, consent, disclosure, provider verification, sanctions screen, state transition | Append-only audit store and sampled disclosure audit rows |
| Integrity | Version-stamped rules, consent scope hashes, disclosure template versions | Golden tests and hash verification tests |
| Transmission security | TLS-only endpoints, no PHI in URLs, secure messaging handoffs | Security headers, endpoint tests, traffic review |
| Vendor controls | BAAs and approved configurations for any vendor handling ePHI | BAA register and subprocessor list |
| Contingency | Backup, restore, incident response, breach notification runbooks | Tabletop record and restore test |
| Minimum necessary | Deterministic disclosure scopes from recommendation id | Scope template tests and consent hash tests |

## De-Identification Boundary

The shared `lib/phi-deidentification.ts` helper is a conservative guardrail for logs, prompts, previews, and operational metadata. It is not a legal certification that data is de-identified. HHS recognizes two de-identification methods: Expert Determination and Safe Harbor. Safe Harbor requires removal of 18 identifier categories and no actual knowledge that remaining information can identify the individual.

Engineering rule: use the helper before free text can enter logs or low-trust operational metadata, but do not treat the helper as permission to persist patient intake outside the PHI gate.

## Clinical Safety Boundary

Every patient-facing recommendation must pass these checks:

1. Deterministic rule fired from structured input.
2. Source organization, grade, URL, rule id, source version, and effective date are present when the rule is active.
3. The rule is in scope for the patient profile.
4. The answer includes targeted clarification when prior tests, symptoms, family history, genetics, or organ-status could change timing.
5. Unknown or conflicting inputs route to clinician review.

## FHIR R4 Mapping

| OpenRx concept | FHIR R4 resource |
| --- | --- |
| Patient profile | `Patient`, `FamilyMemberHistory`, `Observation`, `RiskAssessment` |
| Screening plan | `CarePlan`, `Goal`, `ServiceRequest` |
| Provider/facility | `Practitioner`, `PractitionerRole`, `Organization`, `Location`, `HealthcareService` |
| Referral request | `ServiceRequest`, `Task`, `Communication`, `Consent`, `Provenance`, `AuditEvent` |
| Appointment/scheduling | `Appointment`, `Schedule`, `Slot` |
| Medication/prior auth context | `MedicationRequest`, `Coverage`, `Claim`, `ClaimResponse` |
| Consent and disclosure audit | `Consent`, `AuditEvent`, `Provenance` |

SMART on FHIR is the right launch pattern for EHR integration; OpenRx should sit on top of the EHR workflow rather than replace it.

## FDA/CDS Posture

OpenRx should preserve a transparent, source-linked, clinician-reviewable CDS posture. Patient-facing outputs must show the basis of recommendations and avoid directive diagnosis/order language. Any future feature that moves from education/navigation into autonomous diagnosis, ordering, or treatment selection must go through regulatory review before release.

## Clinical Evaluation Plan

- MVP: continue unit and browser tests for age/sex USPSTF plans, LLM failure boundaries, provider lookup, trial lookup, referral consent, and PHI-safe logs.
- Next: build 500+ clinician-reviewed vignettes covering USPSTF, NCCN referral flags, ACG/USMSTF colonoscopy surveillance, ACS/ACR imaging situations, CDC/ACIP if vaccines stay in scope, and symptomatic red-flag paths.
- Monitor: guideline drift, rule activation history, model failure rate, latency, cost, care-gap closure, patient comprehension, referral completion, and safety events.

## Sources

- HHS HIPAA de-identification guidance: https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html
- HHS HIPAA Security Rule summary: https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html
- FDA Clinical Decision Support Software guidance: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software
- HL7 FHIR R4 index: https://hl7.org/fhir/R4/
