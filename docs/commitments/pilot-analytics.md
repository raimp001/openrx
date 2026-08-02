# Pilot Analytics Specification

## Design

Planning envelope: approximately 100 consenting patients over 60 days.

Supported cohorts:

- `reminders_only`
- `commitment_offer`

Assignment is manual and `randomized=false`. Do not enable random assignment or report
causal effectiveness without legal, privacy, operational, fairness, and IRB/QI review.
Declining the commitment must not change care access, recommendations, scheduling
priority, or reminders.

## Event Definitions

| Metric | Numerator | Denominator | Notes |
| --- | --- | --- | --- |
| Booking rate | Commitments created | Eligible patients shown either flow | Deduplicate per recommendation |
| Funding completion | Confirmed deposits | Commitment offers accepted | Exclude quote-only |
| Completion in window | Trusted completion before deadline | Funded commitments | Include approved extension |
| Time to completion | Completion timestamp minus funded timestamp | Completed commitments | Report median and distribution |
| Extension rate | First extension used | Funded commitments | No diagnosis collected |
| Cancellation rate | Patient cancellation | Funded commitments | Separate consent withdrawal |
| Expiration rate | Deadline expiration | Funded commitments | Include refund result |
| Refund success | Confirmed refunds | Refund attempts | Separate first-attempt and eventual |
| Refund timing | Confirmation minus completion/cancel/expiry | Confirmed refunds | Report p50/p95 |
| Onramp abandonment | Session with no confirmed deposit | Onramp sessions | Time-window definition required |
| Offramp abandonment | Started but incomplete | Eligible Offramp sessions | Disabled in current sandbox |
| Wallet recovery | Recovery requests | Wallet bindings | No raw wallet in analytics |
| Support contact rate | Support contacts | Participants | Categorize, do not include message text |
| Fairness/usability | Patient survey response | Survey respondents | Report uncertainty and missingness |

## Privacy

Third-party analytics must never receive:

- patient ID or contact information;
- wallet address;
- transaction hash;
- commitment ID;
- screening name or code;
- provider/laboratory identity;
- identity-verification reference;
- credential or share token.

The service exposes cohort-level counts only. Small-cell suppression, retention, and
export policy require privacy approval before a real pilot.

## Analysis Guardrails

- Predefine exclusions and missing-data treatment.
- Report both accepted-offer and intent-to-offer views where appropriate.
- Do not infer causality from manual cohorts.
- Examine differences in abandonment and support burden, not completion alone.
- Review fairness by legally and ethically approved dimensions only.
- Publish confidence intervals and sample sizes; avoid percentage-only claims.
- Log product configuration and reminder schedule with every analysis period.

## Operational Dashboard

The restricted sandbox dashboard shows:

- commitment/funding states;
- deadlines and extensions;
- completion and webhook failures;
- refund states and retries;
- credential issuance/revocation;
- aggregate cohort counts;
- hash-chained audit events.

It does not send raw identifiers to an external analytics provider.
