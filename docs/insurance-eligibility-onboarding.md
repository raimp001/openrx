# OpenRx Insurance Eligibility Onboarding

Status: product and integration design, implementation-ready  
Last reviewed: May 5, 2026

## Product Principle

Insurance is never the front door.

OpenRx should answer the first screening question without account creation, wallet setup, or insurance capture. Insurance appears only when it improves the handoff:

- after a recommendation: "Want me to check how your plan treats this?"
- during care search: "Want me to filter for likely in-network options?"
- during bill explanation: "Want me to compare this bill against your plan?"

The capture is optional, reversible, and scoped to the current task. Anonymous users keep working through a pseudonymous session ID.

## Contextual Entry Wireframes

### 1. After Screening Recommendation

```text
Chat
OpenRx
Based on what you shared, colorectal cancer screening may be due.

Recommended next step
[Ask OpenRx to coordinate] [Find care options] [Find primary care]

Plan check, optional
Want me to confirm how your plan treats this before you call?
[Check my coverage]     [Skip]

Small print:
I will only check eligibility for this screening and show exactly what was checked.
```

Rules:

- Show after a screening recommendation card, not before the answer.
- Use only for a concrete service, for example colonoscopy, FIT, mammogram, LDCT, Pap/HPV, PSA discussion, genetic counseling.
- If the user skips, remember that only for the current session and keep the recommendation usable.

### 2. On "Find Care Near Me"

```text
Provider search
Find gastroenterology providers for colonoscopy near Portland, OR

OpenRx found directory options.
These are not yet filtered by your insurance.

[Add insurance to filter likely in-network]     [Show all options]

Result card
Portland GI Clinic
NPI-backed directory result
Network status: not checked
[Call] [Map] [Check plan]
```

Rules:

- Do not hide directory results while insurance is missing.
- Once linked, add filter chips: `Likely in-network`, `Needs referral`, `Prior auth possible`, `Cash price unknown`.
- If eligibility fails, degrade gracefully to all NPI-backed options with "network not checked."

### 3. On "Explain This Bill"

```text
Bill explanation
Upload or paste the confusing bill.

OpenRx can explain common billing terms without insurance.
If you want a plan-grounded answer, link insurance.

[Explain generally] [Compare against my plan]

After plan link
What I checked
- active coverage
- deductible / copay / coinsurance when returned
- preventive-service indicators when available
- network/referral clues when available
```

Rules:

- Default is general explanation.
- Plan-grounded explanation requires explicit consent.
- Never claim the bill is wrong unless the evidence supports a narrow statement like "this looks inconsistent with the eligibility response."

## Three-Tap Insurance Capture Sheet

The sheet opens over the current chat or action card. It is not a new page.

```text
Bottom Sheet: Check coverage for this step

Tap 1: Scan card
--------------------------------
Take a photo of your insurance card.
Front is usually enough. Back helps for pharmacy or payer phone details.

[Scan card] [Enter manually]

Privacy line:
Used only to check this plan. You can delete it later.

Tap 2: Confirm + consent
--------------------------------
OpenRx found:
Plan: Blue Cross Example PPO
Member ID: ••••1234
Group: 98765
Name: Manoj Rai
DOB: 01/01/1968

Consent:
[x] Check eligibility for colorectal cancer screening and related care search.
[x] Save encrypted plan details for future OpenRx checks.
[ ] Delete card image after extraction. Recommended.

[Confirm and check]

Tap 3: Eligibility result
--------------------------------
Coverage active
Likely preventive benefit: yes, if in-network and coded as preventive
Referral path: PPO, referral usually not required. Verify with plan.
Patient estimate: not enough payer detail yet / $0 preventive flag / estimated range
Prior auth: not returned / possible / required

[Find likely in-network care] [View what OpenRx checked] [Delete insurance]
```

Copy constraints:

- Say "likely" unless the payer response is explicit.
- Prefer "plan-grounded estimate" over "guaranteed cost."
- Show failures as normal: "The payer did not return enough detail. We can still help you ask the right question."

## Chat Microcopy

### Screening Recommendation

Primary:

> This screening may be covered as preventive care when it is done in-network and coded correctly. Want me to check how your plan treats it?

Buttons:

- `Check my coverage`
- `Find care without insurance`
- `Skip for now`

Failure:

> I could not confirm eligibility from the payer. The recommendation still stands; I can help you call with the right questions.

### Find Care

Primary:

> I can show all directory options now. If you link insurance, I can try to filter for likely in-network care and flag referral rules.

Buttons:

- `Filter with my plan`
- `Show all options`

After linked:

> I checked your plan for this search. Network data can be incomplete, so call before scheduling. I kept the questions you should ask.

### Explain Bill

Primary:

> I can explain the bill generally. If you link insurance, I can compare it against your plan details and the eligibility response.

Buttons:

- `Explain generally`
- `Compare against my plan`

After linked:

> Here is what the plan data supports, what is uncertain, and what to ask the biller next.

## ACA Preventive Messaging Guidelines

Use:

- "Most Marketplace and many other plans cover certain preventive services without copay or coinsurance when delivered in-network."
- "This may be $0 cost-share if it is preventive, in-network, and coded correctly."
- "Coverage can vary; OpenRx checks what your plan returned."
- "If a screening turns into diagnostic care, or if the provider is out-of-network, costs may apply."

Avoid:

- "Guaranteed free"
- "Your insurance will pay"
- "No prior auth"
- "Covered everywhere"
- "$0 no matter what"

UI labels:

- `ACA preventive flag`
- `Likely $0 preventive benefit`
- `Network required`
- `Coding matters`
- `Plan did not return enough detail`

## Integration Architecture

### Important Caveat

FHIR `CoverageEligibilityRequest` is the correct FHIR resource shape for asking an insurer to validate active coverage, benefits, service coverage, and possible authorization requirements. CMS Patient Access APIs create the payer FHIR access surface for patients, claims, clinical data, and prior authorization information, but they do not guarantee that every payer exposes a real-time eligibility endpoint through Patient Access today.

Therefore OpenRx should implement:

1. FHIR-first eligibility when the payer exposes the needed FHIR endpoint.
2. SMART on FHIR patient-standalone OAuth 2.0 where the payer requires member authorization.
3. EDI 270/271 clearinghouse fallback for real-time eligibility where FHIR eligibility is unavailable.
4. Prior-auth heads-up through CMS-0057-F aligned FHIR APIs when available, with a January 1, 2027 readiness path for impacted payers.

### Components

```text
Client
  InsuranceCaptureSheet
  WhatOpenRxCheckedDrawer
  PlanStatusChip

Server
  /api/insurance/ocr-intent
  /api/insurance/ocr-confirm
  /api/insurance/eligibility
  /api/insurance/check-log
  /api/insurance/delete

Connectors
  OcrVendorAdapter
  SmartOnFhirPayerClient
  FhirEligibilityClient
  Edi270271ClearinghouseClient
  PriorAuthDiscoveryClient

Stores
  InsuranceLinkSession
  CoverageVaultRecord
  EligibilityCheckLog
  ConsentRecord
```

### Data Model

```ts
type InsuranceLinkSession = {
  id: string
  pseudonymousSessionId: string
  internalUserId?: string
  trigger: "screening" | "provider_search" | "bill_explain"
  taskContextId: string
  status: "started" | "ocr_pending" | "awaiting_consent" | "checking" | "linked" | "failed" | "deleted"
  createdAt: string
  expiresAt: string
}

type CoverageVaultRecord = {
  id: string
  pseudonymousSessionId: string
  internalUserId?: string
  encryptedFhirCoverage: string
  payerName?: string
  payerId?: string
  memberIdLast4?: string
  planType?: "HMO" | "PPO" | "EPO" | "POS" | "Medicare" | "Medicaid" | "Unknown"
  source: "ocr_confirmed" | "smart_fhir" | "manual"
  imageRetention: "deleted_after_extraction" | "temporarily_encrypted" | "none"
  revokedAt?: string
}

type EligibilityCheckLog = {
  id: string
  coverageVaultRecordId: string
  pseudonymousSessionId: string
  purpose: "coverage_validation" | "benefits" | "network_filter" | "bill_explain" | "prior_auth_heads_up"
  serviceCode?: string
  serviceLabel: string
  pathUsed: "fhir_coverage_eligibility" | "smart_patient_access" | "edi_270_271" | "manual_fallback"
  payerEndpointHost?: string
  clearinghouse?: "stedi" | "availity" | "change_healthcare"
  resultSummary: string
  rawPayloadPointer?: string
  createdAt: string
}
```

Storage rules:

- Encrypt `Coverage` and raw 271/FHIR response payloads at rest.
- Store member ID only encrypted; UI may show last four.
- Store card image only if needed for retry, encrypted, short TTL. Default: delete after extraction.
- No PHI in analytics events. Use event names plus session/task IDs only.
- Do not store insurance data on-chain or in wallet metadata.

### FHIR Coverage Creation

Map card extraction to FHIR R4 `Coverage`:

```json
{
  "resourceType": "Coverage",
  "status": "active",
  "subscriberId": "ENCRYPTED_OR_SERVER_ONLY",
  "beneficiary": { "reference": "Patient/pseudonymous-patient" },
  "payor": [{ "display": "Payer name from card" }],
  "class": [
    { "type": { "text": "group" }, "value": "ENCRYPTED_OR_SERVER_ONLY" },
    { "type": { "text": "plan" }, "value": "Plan label" }
  ]
}
```

### FHIR Eligibility Request

Use `CoverageEligibilityRequest` with scoped purpose:

```json
{
  "resourceType": "CoverageEligibilityRequest",
  "status": "active",
  "purpose": ["validation", "benefits", "auth-requirements"],
  "patient": { "reference": "Patient/pseudonymous-patient" },
  "created": "2026-05-05T00:00:00Z",
  "insurer": { "reference": "Organization/payer" },
  "insurance": [
    {
      "focal": true,
      "coverage": { "reference": "Coverage/encrypted-coverage-id" }
    }
  ],
  "item": [
    {
      "productOrService": {
        "coding": [
          { "system": "urn:openrx:screening-service", "code": "colorectal-screening" }
        ],
        "text": "Colorectal cancer screening"
      }
    }
  ]
}
```

Interpret response into:

- active coverage
- service eligibility
- preventive flag
- deductible/copay/coinsurance if returned
- referral requirement clues
- prior authorization requirement if returned
- uncertainty reason

### SMART on FHIR Flow

Use patient-standalone OAuth 2.0:

1. User taps `Check my coverage`.
2. OpenRx detects payer from card or asks user to choose payer.
3. Discover payer `.well-known/smart-configuration`.
4. Start authorization with minimum scopes.
5. Request patient context and payer data scopes only needed for the task.
6. Exchange authorization code server-side.
7. Store access/refresh tokens encrypted with short TTL and revocation support.
8. Fetch `Coverage`, `ExplanationOfBenefit`, and prior authorization data where the payer exposes it.

Minimum useful scopes depend on payer support, but expected pattern:

```text
openid fhirUser launch/patient patient/Coverage.read patient/ExplanationOfBenefit.read
```

### EDI 270/271 Fallback

Use when FHIR eligibility is not available or insufficient.

Flow:

1. Convert confirmed card fields + service context into clearinghouse JSON.
2. Clearinghouse translates to X12 270.
3. Payer returns 271.
4. Normalize to OpenRx `EligibilityCheckResult`.
5. Show patient summary and store raw response pointer in encrypted object storage.

Recommended first fallback: Stedi, because it has public eligibility pricing, JSON-native eligibility APIs, raw X12 support, and real-time 270/271 support. Availity and Change Healthcare remain enterprise alternatives but require commercial/onboarding validation.

Example normalized result:

```ts
type EligibilityCheckResult = {
  activeCoverage: "yes" | "no" | "unknown"
  planName?: string
  planType?: "HMO" | "PPO" | "EPO" | "POS" | "Unknown"
  preventiveServiceFlag: "likely_zero_cost_share" | "not_returned" | "not_applicable" | "uncertain"
  inNetworkRequired: boolean
  referralPath: "likely_required" | "likely_not_required" | "not_returned"
  priorAuth: "required" | "not_required" | "possible" | "not_returned"
  patientResponsibility: {
    copay?: string
    coinsurance?: string
    deductibleApplies?: boolean
    estimateText: string
  }
  uncertainty: string[]
}
```

## "What OpenRx Checked" Drawer

```text
What OpenRx checked

Purpose
Coverage check for colorectal cancer screening

Data used
Plan name, member ID ending 1234, DOB, service label

Path
FHIR eligibility request / 270-271 clearinghouse fallback

Result
Active coverage returned.
Preventive benefit likely when in-network and coded preventive.
Prior auth not returned by payer.

[Delete insurance] [Download check summary] [Close]
```

Drawer requirements:

- Show every eligibility call.
- Show timestamp, purpose, data categories, path used, and result summary.
- Show revocation/delete action.
- Do not expose raw member ID unless user explicitly opens a secure details view.

## OCR Vendor Matrix

| Vendor | Health insurance card support | Public pricing | HIPAA/BAA posture | SDK/API maturity | OpenRx fit |
|---|---|---:|---|---|---|
| Veryfi | Explicit healthcare / health insurance card extraction; mobile/browser capture ecosystem | Free 100 docs/month; Starter $500+/month minimum on public pricing, but insurance-card and Lens pricing may need sales confirmation | Veryfi states HIPAA compliance and says it will sign a BAA upon request where healthcare PHI is handled | Strong: REST APIs, docs, SDKs, mobile/browser capture, webhooks | Best first choice if BAA and card-field accuracy validate in pilot |
| Klippa | Explicit health insurance card OCR; API plus scanning SDK; JSON/XML/CSV output; supports anonymization/pseudonymization | Quote-based for health insurance cards; pay-per-use and monthly licenses listed | GDPR/ISO/DPA posture is visible; US HIPAA BAA not clearly public, must verify before PHI use | Solid API and SDK; EU-first posture | Good fallback if BAA and US data-region terms are acceptable |
| AZAPI | Explicit health insurance card OCR API; REST API claims and trial | Public pricing page lists generic OCR credits, but health insurance card-specific pricing not clearly visible | HIPAA/BAA not clearly public; must verify before PHI use | REST API appears available; SDK maturity less clear publicly | Do not use for PHI until BAA/security docs are verified |

Procurement gate:

- No card images or PHI go to any OCR vendor until BAA, subprocessors, retention, deletion SLA, region, encryption, breach notice, audit logging, and no-training/no-HITL terms are signed.

## Build Sequence

1. Add `InsuranceCaptureSheet` as a reusable modal with mock OCR and manual entry.
2. Add `WhatOpenRxCheckedDrawer` with local/demo check logs.
3. Add encrypted `CoverageVaultRecord` model and delete/revoke endpoint.
4. Implement Veryfi adapter behind feature flag; no PHI in logs.
5. Implement Stedi 270/271 sandbox adapter.
6. Add plan-aware labels to screening, providers, and billing.
7. Add SMART on FHIR payer connection adapter where payer endpoints support it.
8. Add CMS-0057-F prior-auth heads-up model for 2027 payer API readiness.

## References

- HL7 FHIR `CoverageEligibilityRequest`: https://hl7.org/fhir/R4B/coverageeligibilityrequest.html
- HL7 FHIR `Coverage`: https://www.hl7.org/fhir/r4/coverage.html
- SMART App Launch v2.2.0: https://hl7.org/fhir/smart-app-launch/
- SMART scopes and launch context: https://hl7.org/fhir/smart-app-launch/STU2.2/scopes-and-launch-context.html
- CMS Interoperability and Patient Access Final Rule: https://www.cms.gov/about-cms/obrhi/interoperability/policies-and-regulations/cms-interoperability-and-patient-access-final-rule-cms-9115-f
- CMS Interoperability and Prior Authorization Final Rule: https://www.cms.gov/priorities/key-initiatives/burden-reduction/interoperability/policies-and-regulations/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f
- CMS CMS-0057-F fact sheet: https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f
- HealthCare.gov preventive services: https://www.healthcare.gov/coverage/preventive-care-benefits/
- CDC preventive services coverage: https://www.cdc.gov/high-quality-care/hcp/resources/preventive-services-coverage.html
- HHS Business Associates guidance: https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html
- Stedi healthcare clearinghouse APIs: https://www.stedi.com/healthcare
- Stedi eligibility API docs: https://www.stedi.com/docs/healthcare/api-reference/post-healthcare-eligibility
- Stedi pricing: https://www.stedi.com/pricing
- Veryfi healthcare solution: https://www.veryfi.com/solutions/healthcare/
- Veryfi pricing: https://www.veryfi.com/pricing/
- Veryfi security / BAA statement: https://www.veryfi.com/security/
- Klippa health insurance card OCR: https://www.klippa.com/en/ocr/medical-documents/health-insurance-cards/
- Klippa OCR API: https://www.klippa.com/en/ocr/ocr-api/
- AZAPI health insurance card OCR: https://azapi.ai/services/ocr/health-insurance-card-ocr-api/
- AZAPI pricing: https://azapi.ai/pricing/
