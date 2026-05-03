---
name: openrx-health
description: Safely improve OpenRx healthcare workflows, screening rules, wallet identity, provider/caregiver onboarding, admin review, and AI/OpenClaw integrations without overclaiming clinical, payment, or operational capabilities.
---

# OpenRx Health Skill

Use this skill when modifying OpenRx healthcare product flows.

## Workflow

1. Inspect `app/(app)`, `app/api`, `lib/screening`, `lib/api-auth.ts`, `lib/wallet-context.tsx`, `lib/provider-applications.ts`, and `prisma/schema.prisma` before editing.
2. Prefer functional backend-backed changes over copy-only polish.
3. Keep clinical rules in `lib/screening/`, not React components.
4. Use `requestWalletProofMatches()` for wallet-scoped server routes.
5. Preserve demo mode, but label demo-only or non-persistent states clearly.
6. Add Playwright/node tests for clinical safety and workflow state transitions.

## Clinical Boundaries

- USPSTF is average-risk baseline only.
- High-risk, hereditary, symptomatic, prior abnormal, or personal cancer history cases require clinician review unless exact source-backed rules are implemented.
- Do not claim diagnosis, ordering, prior-auth submission, coverage approval, or HIPAA compliance without actual implementation.

## Privacy Boundaries

- Do not store PHI on-chain.
- Do not send wallet addresses to LLMs.
- Use internal IDs or hashes for wallet-linked clinical workflows.
- Do not log PHI-heavy request bodies.

## Required Checks

Run:

```bash
npm run lint
npm run build
npm run test:e2e
```

Document any skipped tests or missing production env honestly.
