# Screening Commitment Pilot

Status: local sandbox implementation. Disabled by default. Not approved for real funds,
production use, or Base Mainnet.

## Scope

The pilot adds an optional refundable commitment to any `due` recommendation emitted by
the existing deterministic screening engine. It does not add or change a clinical rule.
An HMAC eligibility proof binds the authenticated patient to the exact version-stamped
recommendation shown in the UI before a commitment can be created.

The local sandbox supports the complete demonstration path:

1. Generate a deterministic, source-linked screening recommendation.
2. Accept versioned optional-commitment terms.
3. Create a dedicated mock wallet binding and verify identity offchain.
4. Fund exactly $20 in mock USDC.
5. Receive a signed, replay-protected mock laboratory completion event.
6. Return the full mock USDC deposit.
7. Issue an EAS-compatible private offchain credential.
8. Share, verify, and revoke a time-limited verifier link.

Base Sepolia adapters are present for an existing OpenRx wallet, Coinbase Onramp
options/quotes/session creation, exact USDC approval and escrow funding, CDP RPC receipt
verification, and a policy-scoped CDP verifier transaction. They require explicit
sandbox flags and secrets. The repository never defaults to them.

## Assumptions

- Existing OpenRx wallet onboarding and recovery remain the patient wallet system.
  This pilot does not migrate to a new wallet provider.
- Local development uses the mock adapters and mock ERC-20 contract.
- Base Sepolia patients use an existing OpenRx wallet. It is not a per-commitment
  account in this implementation, so the residual public-linkability risk remains.
- Provider completion is an opaque institutional signal. OpenRx does not receive the
  screening result through the commitment webhook.
- Provider, support, compliance, administrator, and patient are distinct enforceable
  roles. Local role headers are ignored in production.
- The cancellation and unresolved-expiration fee is $2 by default. Completion has no
  fee. These are configurable product terms, not clinical logic.
- Pilot cohort assignment is manual. Random assignment is not active.
- The Prisma migration is the intended durable schema. The current runtime adapter is
  in-memory for the local sandbox and must be replaced by a transactional Postgres
  adapter before any preview with durable state.
- The private credential is an EIP-712 signed, EAS-compatible offchain payload. No
  patient credential is written to a public EAS registry.

## Feature Flags

All four flags must remain false in production:

```text
SCREENING_COMMITMENT_PILOT=false
COINBASE_ONRAMP_PILOT=false
PRIVATE_COMPLETION_CREDENTIALS=false
INSURER_VERIFIER_DEMO=false
```

The runtime also rejects Vercel production and accepts only `local-mock` or
`base-sepolia`. Base Mainnet is not a valid configuration.

## Key Artifacts

- Domain and adapter interfaces: `lib/commitments/`
- Patient flow: `app/(app)/commitments/`
- Restricted operations: `app/(app)/admin-review/commitments/`
- APIs and signed webhooks: `app/api/commitments/`
- Database schema: `prisma/migrations/20260725000000_screening_commitment_pilot/`
- Escrow contract: `contracts/src/ConditionalDepositEscrow.sol`
- Deployment utility: `scripts/deploy-commitment-escrow.mjs`
- Unit/privacy tests: `tests/unit/screening-commitment-pilot.test.ts`
- Browser/API test: `tests/e2e/screening-commitment-pilot.spec.ts`

## Required Approval Gates

No production or real-funds work may proceed until every applicable owner signs off:

- Clinical: eligible recommendation boundary and patient copy.
- Legal: commitment terms, refunds, cancellation/expiration fee, money-transmission
  analysis, consumer protection, unclaimed-property treatment, and pilot consent.
- Privacy: wallet linkability, minimum data, retention, analytics, credential sharing,
  and partner data-flow review.
- Security: contract audit, key custody, multisig ceremony, CDP policies, webhook
  authentication, abuse controls, incident response, and penetration test.
- Compliance `/cso`: PHI boundaries, audit retention, role model, BAA coverage,
  vendor risk review, and breach-response integration.
- Coinbase: CDP, Onramp, Paymaster, and Offramp production eligibility and limits.
- Laboratory/provider: institutional signing credentials, replay contract, expected
  provider mapping, reconciliation, and support ownership.
- Payer: verifier semantics and any real acceptance claim.
- Finance/accounting: custody, fees, reconciliation, chargebacks, tax, and escheatment.
- Research/QI: cohort design, consent, fairness review, and IRB/QI determination before
  randomized assignment or inferential reporting.

See `architecture.md`, `threat-model.md`, `pilot-analytics.md`, and `runbook.md`.
