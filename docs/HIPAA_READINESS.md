# OpenRx HIPAA Readiness Checklist
**Mapped to actual infrastructure: Vercel (hosting) · Neon/Postgres (database) · OpenAI + Anthropic (AI) · Resend (email) · Coinbase CDP/OnchainKit + Base (payments)**
Date: 2026-07-24 · Status legend: ✅ done in code · ⚙️ config/vendor action · 📋 policy/organizational action

---

## 1. Business Associate Agreements (BAAs) — blocking, before any real PHI

| Vendor | BAA available? | Action | Status |
|---|---|---|---|
| OpenAI | Yes — API BAA via OpenAI platform for qualifying accounts | Sign BAA, then set `OPENRX_OPENAI_BAA_ENABLED=true` in Vercel env. **Code already hard-blocks PHI-adjacent OpenAI calls until this flag is true** (verified in `/api/health`) | ⚙️ |
| Anthropic | Yes — Anthropic offers BAAs for API customers | Sign BAA for the primary AI engine (`lib/ai-engine.ts`). Consider an equivalent BAA gate for Anthropic calls (currently only OpenAI is gated) | ⚙️ |
| Neon (Postgres) | Yes — on paid/scale plans | Upgrade + sign BAA. Confirm production `DATABASE_URL` points at the covered Neon project | ⚙️ |
| Vercel | **Only on Enterprise plans** | Upgrade to Enterprise + BAA, or keep PHI out of Vercel-managed layers (PHI lives in Postgres; ensure no PHI in Vercel logs — see §3) | ⚙️ |
| Resend | Yes — on Pro plans | Sign BAA; keep `lib/phi-safe-notifications.ts` guards as defense-in-depth | ⚙️ |
| Coinbase CDP / Base | Not a covered-entity vendor — payment metadata only | No BAA needed **provided no PHI is ever placed in payment metadata or on-chain memos** (on-chain data is public and immutable — see §4) | ✅ (by design) |

## 2. Technical safeguards — status in code

| Safeguard | Implementation | Status |
|---|---|---|
| PHI de-identification | `lib/phi-deidentification.ts` — Safe Harbor 18-identifier categories | ✅ |
| PHI-free outbound notifications | `lib/phi-safe-notifications.ts` — assertion before any send | ✅ |
| Audit logging | `lib/audit.ts` — PHI-safe metadata only | ✅ |
| Encrypted context storage | `prisma/schema.prisma` — `encryptedContext` fields | ✅ (verify at-rest encryption on Neon plan) |
| AI PHI gate | `lib/openai-healthcare.ts` — OpenAI disabled unless BAA flag; gate confirmed ACTIVE live | ✅ |
| Auth & access control | `lib/api-auth.ts` — session/clinic auth, admin gates, wallet-scoped checks | ✅ |
| Demo data in production | Demo-wallet bypass disabled when `NODE_ENV=production` | ✅ |
| PHI in application logs | Verify no PHI in Vercel runtime logs / error paths | ⚙️ |
| Rate limiting / abuse controls | Add edge middleware rate limits on auth + AI endpoints | ⚙️ |
| Session management | Verify TTLs, secure/HttpOnly cookies, rotation | ⚙️ |

## 3. Data-flow hygiene

- **AI calls**: all clinical narratives must pass de-identification before OpenAI/Anthropic — enforce as invariant (no direct SDK imports outside `lib/ai-engine.ts` / `lib/openai-healthcare.ts`).
- **Email (Resend)**: extend PHI-free guard tests with 18-identifier fixtures.
- **Error tracking**: if Sentry/similar is added, enable server-side PII scrubbing + BAA.
- **Vercel logs**: no request-body logging in API routes.

## 4. Blockchain/payment-specific (critical)

- **Never put PHI on-chain.** Payment metadata stays in Postgres (private); only tx hashes/addresses/amounts touch Base. Add a CI test asserting payment metadata rejects PHI-shaped strings.
- Treasury/developer addresses masked for anonymous users ✅; keep admin-gated.

## 5. Organizational requirements 📋

1. Designate a Security Officer and Privacy Officer.
2. Annual Security Risk Analysis (NIST 800-66).
3. Written policies: access control, incident response & breach notification (60-day rule), retention & disposal, training, contingency/backup (verify Neon PITR).
4. Patient rights workflows: access (30-day), amendment, accounting of disclosures; formalize data-export + deletion per user.
5. Counsel review of consent UX at `/onboarding` before enrolling real patients.

## 6. Minimum viable compliance sequence

1. Sign BAAs: OpenAI + Anthropic + Neon + Resend; decide Vercel Enterprise vs PHI-free-edge.
2. Set `OPENRX_OPENAI_BAA_ENABLED=true` only after OpenAI BAA countersigned.
3. Enable Neon PITR backups; confirm encryption at rest.
4. Log-scrub pass + rate limiting.
5. Risk analysis + policy docs (HHS SRA tool).
6. Counsel review of consent flows.

**Bottom line:** gates, de-identification, and audit patterns are real in code. Remaining work is vendor paperwork (BAAs), hardening items, and organizational process. Do not onboard real patient PHI until §6 items 1–4 are complete.
