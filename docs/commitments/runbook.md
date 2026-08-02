# Sandbox Runbook

## Local Mock

1. Copy the commitment placeholders from `.env.example` into `.env.local`.
2. Enable the four pilot flags.
3. Set `OPENRX_COMMITMENT_NETWORK=local-mock`.
4. Set `OPENRX_TRUST_ROLE_HEADER=true` only for local role simulation.
5. Start Next.js.
6. Open `/screening`, enter a profile that produces a `due`, sourced recommendation,
   and select **Reserve my screening**.
7. Use `/admin-review/commitments` with a local admin role to submit the audited mock
   completion event.

No Coinbase account, RPC, wallet, or real funds are used in this mode.

## Database

Validate and apply the migration only to a disposable local database:

```bash
npx prisma validate
npx prisma migrate deploy
```

The sandbox service currently uses its in-memory store. The migration documents the
durable target and can be reviewed independently; it is not yet wired as the runtime
repository.

## Tests

```bash
npm run test:unit -- tests/unit/screening-commitment-pilot.test.ts
npm run test:contracts
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3011 PORT=3011 \
  npx playwright test tests/e2e/screening-commitment-pilot.spec.ts
```

The Playwright config enables the flags only for the test server and selects
`local-mock`.

## Base Sepolia Configuration

Do not use these steps until sandbox security review is complete.

1. Obtain the current Base Sepolia USDC address from official Coinbase documentation.
2. Set server-only CDP credentials in the secret manager.
3. Set the Base Sepolia RPC URL, token address, escrow address, and policy-scoped CDP
   account names.
4. Provide separate multisig admin, verifier, and fee-recipient addresses.
5. Apply the example paymaster and verifier policies after replacing placeholders.
6. Deploy only with a unique idempotency key:

```bash
npm run commitments:deploy:sepolia
```

The deployment script rejects any network except Base Sepolia, rejects Vercel
production, rejects an admin that equals the deployer, and requires an explicit policy
reference.

## Webhooks

Coinbase:

- Verify `X-Hook0-Signature` over the exact raw body.
- Enforce the timestamp window.
- Persist a hash of the idempotency key, not the raw body.
- Never log the event payload.

Provider/laboratory:

- Use an institutional credential.
- Validate signature, timestamp, nonce, expected provider, and idempotency key.
- Match only the opaque offchain commitment ID.
- Reject results, codes, patient identifiers, appointment data, and notes.

The manual completion endpoint is local-mock only and rejects Base Sepolia.

## Operations

- Run the deadline worker through authenticated cron.
- Queue reminders only once per configured interval.
- Retry failed refunds without replaying the completion event.
- Reconcile every confirmed chain transition with the offchain ledger.
- Use exceptional refunds only with an administrator reason and audit event.
- A returned deposit arrives as USDC in the OpenRx wallet. Never state that it returns
  automatically to the original card or bank.

## Preview Restrictions

A Vercel preview may opt in only with:

```text
OPENRX_COMMITMENT_SANDBOX=true
OPENRX_COMMITMENT_NETWORK=local-mock
```

Vercel production remains rejected even when flags are accidentally enabled. Do not set
real Coinbase secrets on the preview until vendor, legal, privacy, and security approval.

## Production Stop Conditions

Stop immediately if any of these are true:

- target network is not local mock or Base Sepolia;
- a real patient or real screening event is proposed;
- a wallet or transaction identifier appears in analytics/logs;
- completion payload includes clinical data;
- refund account lacks a restrictive CDP policy;
- admin is not a multisig;
- the Postgres repository and reconciliation worker are absent;
- independent contract audit is incomplete;
- `/cso`, legal, privacy, Coinbase, and partner approvals are incomplete.
