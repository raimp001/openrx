# Security and Privacy Threat Model

## Assets

- Patient authentication session and internal patient ID.
- Encrypted patient-to-wallet binding.
- Commitment terms and consent snapshot.
- Deposit and refund state.
- Provider/laboratory completion signing material.
- CDP API and wallet secrets.
- Escrow administrative roles.
- Private credential issuer key.
- Credential share token and access history.
- Audit-event integrity.

## Trust Boundaries

1. Patient browser to OpenRx API.
2. OpenRx server to Coinbase.
3. OpenRx server to Base Sepolia RPC.
4. Provider/laboratory system to completion webhook.
5. OpenRx server to Postgres.
6. OpenRx issuer to patient-controlled credential share.
7. Administrator/support user to restricted pilot operations.

## Threats and Controls

| Threat | Control in sandbox | Production requirement |
| --- | --- | --- |
| A recommendation is forged | Patient-bound HMAC proof over exact engine output | Rotate secret; transactional one-time use |
| PHI is put onchain | Opaque random ID and prohibited-data tests | DLP gate on every calldata/event path |
| Wallet reveals medical identity | Encrypted mapping; generic contract | Dedicated/per-commitment accounts and privacy review |
| Unlimited token allowance | Exact amount encoded and tested | Wallet simulation and allowance monitoring |
| Fake completion event | HMAC, timestamp, nonce, provider match, idempotency | Institutional asymmetric signing or mTLS |
| Webhook replay | Timestamp window, nonce and idempotency sets | Durable unique constraints and replay cache |
| Duplicate refund | Idempotent service and contract transition | Transactional outbox/reconciliation worker |
| Refund fails after completion | Failed state remains retryable | Durable queue, alerting, and support SLA |
| Server controls all funds | Separate role model and required CDP policy | Multisig admin, constrained verifier, no shared hot key |
| Contract is paused maliciously | Role control; emergency refund | Multisig pauser, monitored pause, runbook |
| Admin accesses patient data | Role checks and ownership checks | Mature IdP, least privilege, break-glass controls |
| Share token leaks | High entropy, expiry, hash-only storage, revocation | Rate limits, verifier binding, access alerts |
| Credential reveals clinical detail | Generic completion payload only | Schema governance and automated forbidden-field check |
| Analytics leaks identity | Aggregate-only internal metrics | Privacy review, minimum cell sizes, retention controls |
| Onramp metadata leaks care purpose | Opaque funding reference only | Vendor contract and packet-level validation |
| Spoofed client IP reaches Coinbase | Production refuses untrusted forwarded header | Trusted platform-derived address adapter |
| Configuration enables mainnet | Network allowlist and Vercel production denial | CI policy and deployment-control test |
| A dependency affects disabled flow | Coinbase SDK dynamically loaded at active adapter | SBOM, pinning, SCA, lockfile enforcement |

## Privacy Analysis

A public observer can still infer that an address interacted with a generic conditional
deposit contract. A generic contract reduces semantic disclosure but does not remove
linkability. Reusing a wallet across commitments or other activity increases that risk.
This is a material residual risk, not solved by hashing.

No predictable clinical or identity value may be hashed and published. The presence of
a hash can still enable dictionary matching. Opaque IDs must be generated from at least
256 bits of cryptographic randomness.

Coinbase KYC proves a Coinbase account relationship; it does not establish that the
wallet holder matches a provider or laboratory patient record. Identity matching is a
separate offchain gate.

## Key and Role Model

- Escrow `DEFAULT_ADMIN_ROLE`: multisig only.
- Verifier/refund role: policy-scoped service account; only allowlisted contract methods.
- Pauser: separate incident-response role under multisig governance.
- Fee recipient: approved treasury account.
- CDP API, wallet, and webhook secrets: server secret manager only.
- Completion signer: institutional key with rotation and revocation.
- Credential issuer: separate key from completion signer and CDP account.

No single application-server key should be able to reconfigure the contract and move all
funds.

## Audit Requirements

Record:

- actor role and hashed actor ID;
- event type and timestamp;
- opaque commitment ID;
- previous audit hash and current audit hash;
- consent version and hash;
- adapter/provider name;
- generic status and failure code.

Do not record raw patient input, wallet address, transaction hash, screening name,
result, Coinbase response, webhook body, or provider notes in logs.

## Required Work Before Any Real Funds

- Independent Solidity audit and remediation.
- Durable Postgres implementation with transactions and row-level authorization.
- Transactional outbox and chain reconciliation.
- Formal key-management and multisig ceremony.
- Production identity and institutional completion adapters.
- Rate limits, WAF rules, alerting, SIEM, and support escalation.
- Coinbase production review and signed vendor/privacy agreements.
- Threat-model review at `/cso`.
- Legal review of custody, refunds, fees, state law, UCC, tax, and unclaimed property.
- Disaster recovery and emergency-refund exercise.
