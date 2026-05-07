# OpenRx UI Audit - Chat Workspace Pass

Date: 2026-05-07

## Before Artifacts

Screenshots were captured from production `https://openrx.health`:

- `artifacts/ui-audit/before/desktop-light-landing.png`
- `artifacts/ui-audit/before/desktop-light-chat-empty.png`
- `artifacts/ui-audit/before/desktop-light-chat-screening-answer.png`
- `artifacts/ui-audit/before/mobile-light-chat-empty.png`
- `artifacts/ui-audit/before/desktop-dark-chat-empty.png`
- `artifacts/ui-audit/before/audit.json`

## Issues Found

- The chat surface had no persistent conversation history, no search, no grouping by recency, and no restore-on-reload path.
- The old app rail and topbar made chat feel like a dashboard subpage instead of the primary clinical workspace.
- Dark mode was effectively incomplete: token values did not switch globally and several pages had low contrast or pale panels with light text.
- Screening citations rendered as ordinary inline links instead of an evidence/reference block.
- User message content inherited primary text styles inside the dark user bubble, creating poor contrast.
- Persisted chat content was initially at risk of being collapsed into a one-line preview shape; this was fixed by preserving message newlines server-side.
- The generic "cancer" word in "cancer screening" was parsed as personal cancer history, creating an inappropriate follow-up-plan recommendation.
- The product mark was still a generic status/check shape and did not read cleanly as a clinical decision-support mark at small sizes.
- Live before audit showed a dashboard analytics fetch console error. Local after audit showed no console/page errors in the captured routes.

## After Artifacts

Screenshots were captured from local `http://127.0.0.1:3000` after the main implementation pass:

- `artifacts/ui-audit/after/desktop-light-landing.png`
- `artifacts/ui-audit/after/desktop-light-chat-empty.png`
- `artifacts/ui-audit/after/desktop-light-chat-screening-answer.png`
- `artifacts/ui-audit/after/mobile-light-chat-empty.png`
- `artifacts/ui-audit/after/desktop-dark-chat-empty.png`
- `artifacts/ui-audit/after/audit.json`

Note: the final screenshot refresh after the last dark-token and mobile-header refinements was blocked by the tool approval/usage limit. The captured after set still documents the new sidebar, chat shell, evidence cards, and logo pass.

## Implemented Fixes

- Added server-side chat conversation APIs and anonymous/wallet-scoped owner resolution.
- Rebuilt `/chat` as the primary clinical workspace with restore-on-reload and conversation-aware URLs.
- Added the required persistent chat-history sidebar: recency groups, search, new chat, collapse, mobile drawer, rename, delete, pin, export, and keyboard shortcuts.
- Hid the legacy topbar on `/chat` so the clinical chat is not competing with global navigation.
- Added numbered reference cards in chat answers and kept screening recommendations in the conversation.
- Added a screening care action to find care options after recommendations without routing users to the old screening form.
- Replaced the product mark and shipped favicon, Apple touch icon, OG image, and light/dark wordmark SVGs.
- Moved color values toward shared CSS/Tailwind tokens with dark-mode values and stronger focus/contrast behavior.
- Fixed the screening parser so a generic request for "cancer screening" is not treated as personal cancer history.

## Validation

- `npm run lint`
- `npm run build`
- `npm run test:e2e -- tests/e2e/critical-actions.spec.ts`
- `npm run test:e2e -- tests/e2e/critical-actions.spec.ts tests/e2e/screening-engine.spec.ts tests/e2e/screening-simple.spec.ts -g '(screening chat answers common|compact family|Ask page saves|Ask page sends|chat answers cancer)'`

## Remaining Risks

- Chat persistence currently uses a server-side file store by default. It is safe for local/demo restore behavior, but production should move this to Prisma/Postgres for durable multi-instance history.
- The local database warning is expected when `DATABASE_URL` is absent in development; it should not appear in production when Supabase is configured.
- Clinical recommendations are guideline decision support and still need clinician validation before public medical launch.
