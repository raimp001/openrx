# Clinician outreach — privacy-preserving patient calls

OpenRx provides a clinician-facing outreach workspace at `/outreach` that lets a
provider place a call to a patient from a masked OpenRx caller ID. The
clinician's personal phone number is never exposed to the patient.

This document captures what is implemented today and what is required before
live calling can be enabled in production.

## What ships in this PR

- `app/(app)/outreach/page.tsx` — clinician outreach UI (call form, masked
  caller ID picker, consent attestation, call lifecycle, documentation, and
  follow-through routing into screening / scheduling / care team).
- `app/api/clinician-calls/route.ts` and `app/api/clinician-calls/[id]/route.ts`
  — JSON APIs that wrap the active call provider.
- `lib/clinician-calls/` — typed call session model (`types.ts`),
  phone-normalisation helpers (`utils.ts`), a deterministic in-process mock
  provider (`mock-provider.ts`), and a provider resolver (`provider.ts`).
- `components/clinician-command-bar.tsx` — universal clinician command box with
  fuzzy matching across common workflows (call, screening, scheduling,
  pharmacy, prior auth, referrals, labs, messages, ask).
- `components/chat-action-plan.tsx` and an action-plan derivation in
  `lib/care-handoff.ts` — the chat now renders an "Action plan" rail next to
  the answer with up to four restrained next-step cards.

## Defaults

- Live calling is **disabled** by default. The UI shows a "Demo mode" banner
  and the API responds with `demoMode: true`.
- Only the last four digits of any patient phone are stored on the call
  session record. The full E.164 number is used solely to dispatch the call
  through the provider, then discarded.
- The clinician's personal phone is never accepted as input — calls always go
  through an OpenRx-controlled masked number.

## Required before enabling live calling

These are explicit gates. Do not flip `OPENRX_CALL_PROVIDER=twilio` (or any
other live provider) until every item below is complete.

### Legal and contractual

1. Signed Business Associate Agreement (BAA) with the telephony provider
   (Twilio, Bandwidth, etc.). HIPAA-eligible accounts only.
2. Documented retention/deletion policy for Call Detail Records (CDRs) and any
   recordings.
3. Two-party consent recording flow per US state where the org operates.
4. Patient consent capture (per-patient or per-org policy) recorded in the
   patient record.

### Engineering

1. Add provider implementation under `lib/clinician-calls/` and switch on it
   in `provider.ts`. Read keys from server-only env vars (no
   `NEXT_PUBLIC_*`).
2. Add per-clinician rate limiting and abuse detection (replace the in-process
   limiter in `app/api/clinician-calls/route.ts` with a distributed limiter).
3. Persist call sessions to Postgres so they survive restarts and can be
   audited. Today the mock provider keeps state in-process only.
4. Stream CDRs to the OpenRx audit log (`lib/audit.ts`) and the Care Team
   Command Center.
5. Add an emergency-use disclaimer interstitial (already partially shown via
   the consent checkbox copy and the safety panel — extend per legal review).
6. Role-based access control: only `DOCTOR`, `ADMIN`, or other authorised
   roles should be able to start a call. The MVP UI does not yet check
   `resolveClinicSession`; wire that in before the live launch.
7. Verify the masked caller IDs route correctly back to OpenRx (so patients
   calling back reach a real care line, not a dead number).

### Compliance and security

1. Threat model the call APIs (rate limiting, replay, enumeration of patient
   IDs, consent forgery).
2. PHI logging audit — confirm the `console.error`/`console.warn` paths in the
   call routes do not log full phone numbers, patient names, or note bodies.
3. Annual HIPAA security review covering the telephony surface.
4. Review encryption-at-rest for any retained recordings or transcripts.

## API surface

```
GET  /api/clinician-calls            -> { provider, capabilities, recent }
POST /api/clinician-calls            -> { session, liveCallingEnabled, demoMode }
GET  /api/clinician-calls/:id        -> { session }
PATCH /api/clinician-calls/:id       -> body { action: "end" | "document", ... }
```

`POST` requires `patientRef`, `patientPhone` (E.164), `reason`, and
`consentAttested: true`. The masked caller ID is selected by `callerIdLabel`.

## Testing

`tests/e2e/clinician-outreach.spec.ts` covers:

- Setup banner is visible when live calling is disabled.
- Clinician command bar surfaces clinical actions.
- Consent and phone validation block call placement.
- A mock call lifecycle: place → end → document outcome → follow-through
  routes (e.g. `/scheduling`, `/screening`).

The chat action-plan test also asserts that an "Action plan" rail appears in
chat answers when the backend responds, and is robust to API errors in CI.
