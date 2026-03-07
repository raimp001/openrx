# BaseBuilder Integration

OpenRx now includes a reusable BaseBuilder integration layer for Base Pay flows.

## Added modules

- `lib/basebuilder/config.ts`
  - Resolves network (`base` / `base-sepolia`)
  - Exposes chain id and explorer URL helpers
- `lib/basebuilder/pay.ts`
  - Validates USDC amount and recipient address
  - Wraps `@base-org/account` pay call in one shared helper

## Wired flows

- Screening deep-dive pay gate:
  - `app/(app)/screening/page.tsx`
- Compliance ledger Base Pay launch:
  - `app/(app)/compliance-ledger/page.tsx`
- Wallet runtime visibility:
  - `app/(app)/wallet/page.tsx`

## UX additions

- Wallet page now shows:
  - active BaseBuilder network (`base` / `base-sepolia`)
  - resolved chain id
  - explorer link (BaseScan)
  - recent wallet-linked payment transactions from compliance ledger
- Screening and compliance ledger payment forms now auto-show a BaseScan link
  whenever the entered transaction hash is a valid EVM tx hash.

## Optional env

- `NEXT_PUBLIC_BASEBUILDER_NETWORK=base` (default)
- `NEXT_PUBLIC_BASEBUILDER_NETWORK=base-sepolia`
