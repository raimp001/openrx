# OpenRx Agent Guide

OpenRx is a Next.js App Router healthcare coordination MVP. Keep changes functional, safe, and honest: do not make UI claims that imply live clinical ordering, live prior authorization submission, live NPI credential verification, HIPAA compliance, or insurance approval unless code and operations truly support it.

## Repo Map

- `app/(app)/` contains patient-facing pages: dashboard, onboarding, screening, providers, join-network, admin-review, prior-auth, wallet, chat, and care timeline.
- `app/api/` contains server routes. Keep AI, NPI, payment, wallet proof, admin, and screening request logic server-side.
- `lib/screening/` contains typed screening rules, source metadata, hereditary-risk routing, red-flag detection, and next-step request storage.
- `lib/basehealth.ts` bridges legacy risk scoring with the typed screening engine.
- `lib/wallet-context.tsx`, `lib/api-auth.ts`, and `lib/wallet-auth-message.ts` implement wallet identity and signed wallet proof headers.
- `lib/provider-applications.ts` and `app/api/admin/applications/*` implement provider/caregiver applications and admin review.
- `prisma/schema.prisma` defines durable records. If production tables are missing, routes must degrade honestly instead of claiming persistence.

## Safety Rules

- Store clinical records by internal user IDs or patient IDs, not raw wallet addresses.
- Never put PHI on-chain or in transaction metadata.
- Never log full request bodies containing PHI.
- Keep external LLM calls server-side and send the minimum context needed.
- Route symptoms, personal cancer history, hereditary risk, and uncertain high-risk cases to clinician review.
- USPSTF is the baseline for average-risk screening only. Do not invent NCCN/ACG/USMSTF intervals; mark pending rules as clinician review.
- Demo mode may prepare sample requests, but should clearly say what is not persisted.

## Screening Engine

Use `lib/screening/recommend.ts` for clinical screening logic. Recommendation objects must include status, risk category, rationale, source metadata, patient-facing explanation, clinician summary, and next steps. Add tests when changing rules.

Core checks to preserve:

- Average-risk colorectal screening ages 45-75.
- Recent normal screening can return `not_due`.
- Family history does not fall through to blind average-risk rules.
- BRCA/Lynch/APC/MUTYH/PALB2/etc. route to genetics/high-risk review unless exact intervals are implemented.
- Personal cancer history routes to survivorship/surveillance.
- Red-flag symptoms route to urgent clinician review or diagnostic evaluation.

## Wallet/Auth

Production must not trust unsigned wallet headers. Client wallet flows should call `getWalletAuthHeaders()` and server routes should use `requestWalletProofMatches()` before exposing wallet-scoped data.

## Testing Commands

Run real project commands only:

```bash
npm run lint
npm run build
npm run test:e2e
```

`tests/e2e/cron-side-effects.spec.ts` may skip locally when DB/core env is absent. Do not treat that skip as proof production workers are healthy.

## Definition Of Done

A change is done when it compiles, tests cover the risky logic, UI copy matches actual backend capability, and remaining production risks are called out directly.
