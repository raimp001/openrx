# Before / After Changelog — `uplift/full-redesign-v2`

## Chat experience

| Area | Before | After |
| --- | --- | --- |
| Conversation persistence | Lost on reload — `messages` state only. | Server-persisted via `/api/chat/conversations/*` (file-store today; DB-ready tomorrow). |
| Past chats | Not surfaced anywhere. | Persistent left sidebar with grouping (Today / Yesterday / Previous 7 / Previous 30 / Older), plus pinned section. |
| Per-chat actions | None. | Hover/kebab menu with Rename, Pin, Export to Markdown, Delete (with confirm). |
| Search | None. | Sidebar search filters by title and preview. |
| New chat | Implicit "Clear" button. | Pinned **New chat** primary CTA in sidebar. `Cmd/Ctrl + Shift + O` shortcut. |
| Mobile | Sidebar scrollable, chat below. | Slide-over drawer triggered by header hamburger; Esc closes it. |
| Composer | `rows={2}`, max 160 px. | Auto-grows up to 220 px. |
| Citations | Pills with no numbering. | Numbered references list under each answer; inline links carry a `[n]` superscript that maps back to the list. |
| Loading | Single spinner line. | Skeleton answer card so layout doesn't jump. |
| Inline link contrast | `text-teal-dark` underline barely visible. | `text-navy` with `decoration-navy/40` — clearer on slate page. |
| Send button | Loading state silent. | `aria-label` toggles to "Sending" while in flight. |

## Visual system

- Eyebrow pill borders upgraded to `paper-border-strong` plus a 1-px ground shadow so they stop floating against `#F8FAFC`.
- Distinct `:focus-visible` rings on buttons, links, inputs, and `[role=button]` elements with proper offset (was a near-invisible global box-shadow).
- Landing heading switched from a one-off `clamp` to the `text-display-lg` token defined in `tailwind.config.ts`.
- Footer date is computed from `new Date()` instead of a hard-coded `2026`.
- Landing footer secondary links now use `text-muted` with hover to `text-primary` — visible state changes.

## Logo / brand

- New `BrandMark`: a "decision node" — three nodes forming a forward-pointing triangle, joined by a quiet stroke, with a single muted-teal accent on the leading node. Reads at 16 px, ties conceptually to clinical decision support without using literal Rx, cross, or pill clip-art.
- New `BrandLockup` shipped for reuse. `BrandWordmark` left intact.
- Updated `app/icon.svg` to match the new mark.
- Added `app/apple-icon.svg` (180 × 180) and `app/opengraph-image.svg` (1200 × 630).

## Navigation

- `app/(app)/layout.tsx` widened content frame to `max-w-[1240px]` so the chat shell can host both the global rail and the new chat history pane without crowding.
- Global mobile hamburger is hidden on `/chat` so the chat-history drawer toggle owns that corner.
- Sidebar `aria-label`, `tabIndex`, and `:focus-visible` improvements.

## API surface (new)

- `GET /api/chat/conversations` — list conversations for the authenticated wallet or the cookie-bound anonymous owner.
- `POST /api/chat/conversations` — append a message; creates the conversation when none is supplied; derives a title from the first user message.
- `GET /api/chat/conversations/[id]` — fetch a single conversation with messages.
- `PATCH /api/chat/conversations/[id]` — rename or pin/unpin.
- `DELETE /api/chat/conversations/[id]` — remove a conversation.
- `GET /api/chat/conversations/[id]/export` — download as Markdown.

## Tests added

- `tests/e2e/chat-history-sidebar.spec.ts` — sidebar render, collapse toggle, mobile drawer, `Cmd+Shift+O` keyboard shortcut.
- `tests/e2e/chat-history-api.spec.ts` — append → list → rename → pin → list ordering → fetch detail → delete.

## Files changed (key)

- `app/(app)/chat/page.tsx`
- `app/(app)/layout.tsx`
- `app/page.tsx`
- `app/globals.css`
- `app/icon.svg`, `app/apple-icon.svg`, `app/opengraph-image.svg` (new)
- `components/brand-logo.tsx`
- `components/chat-history/chat-history-sidebar.tsx` (new)
- `components/layout/sidebar.tsx`
- `lib/chat-history/{store,types,owner}.ts` (new)
- `lib/hooks/use-chat-history.ts` (new)
- `app/api/chat/conversations/route.ts` (new)
- `app/api/chat/conversations/[id]/route.ts` (new)
- `app/api/chat/conversations/[id]/export/route.ts` (new)
- `tests/e2e/chat-history-{sidebar,api}.spec.ts` (new)
- `docs/design-audit/{AUDIT,CHANGELOG,QA}.md` (new)

## Known limitations

- The chat-history file store (`.openrx-chat-history.json`) is intentionally a JSON file that already matches the existing `lib/care-team/file-store.ts` pattern. A Prisma model could replace it without changing any callers (the store API surfaces are `listConversations`, `appendMessage`, etc.).
- The audit/screenshot pass was performed source-side because the sandbox root partition was at 100% from prior workspace clones; reproduction commands are documented in `AUDIT.md`.
- Streaming is not yet wired through the chat-history layer — the agent reply is appended once the response resolves, not incrementally.
