# QA Evidence — `uplift/full-redesign-v2`

## Static checks

| Check | Command | Result |
| --- | --- | --- |
| TypeScript (touched + new files) | `npx tsc --noEmit` filtered to changed paths | **0 errors** |
| ESLint | `node node_modules/next/dist/bin/next lint` | **0 warnings or errors** ("✔ No ESLint warnings or errors") |

The full `tsc --noEmit` run reports 121 errors. Every one is in a file this PR did **not** touch and reproduces on `main` in the same environment — it is caused by `@prisma/client` and `viem`/`wagmi` types not being generated/installed in this sandbox (the root partition was 100% full at session start, and the user declined to reclaim it). A reviewer with a clean machine running `npm ci && npm run build` will not see these.

## Runtime checks not performed in this sandbox

The reproduction notes for these are documented in `AUDIT.md`:

- `npm run dev` → manual screenshot capture (desktop + mobile, light)
- `npm run test:e2e` → including the two new specs

Both should be run on a clean checkout before merge.

## Test additions

`tests/e2e/chat-history-sidebar.spec.ts`

- Sidebar renders with **New chat** and **search** controls.
- Empty state copy appears when no history exists.
- Collapse toggle flips `data-collapsed`.
- Mobile drawer trigger is reachable from the chat header and exposes `aria-hidden`.
- `Cmd/Ctrl+Shift+O` returns focus to the composer for a new chat.

`tests/e2e/chat-history-api.spec.ts`

- POST creates conversation + derives title from first user message.
- POST with `conversationId` appends additional messages.
- PATCH renames and toggles `pinned`.
- GET list returns pinned conversations first.
- GET detail returns the full transcript.
- DELETE removes the conversation.

## Manual verification checklist (recommended before merge)

- [ ] Desktop (≥ 1280px): sidebar pinned at the left of `/chat`, collapse + expand smooth.
- [ ] Tablet (768–1024px): sidebar still pinned; chat panel scrolls independently.
- [ ] Mobile (≤ 480px): hamburger in chat header opens drawer, `Esc` closes it.
- [ ] `Cmd/Ctrl + Shift + O` clears + focuses composer.
- [ ] `Cmd/Ctrl + K` opens the drawer (mobile) and focuses the search box.
- [ ] Send a question → appears in sidebar with derived title.
- [ ] Rename via kebab → reflected in sidebar list.
- [ ] Pin → conversation jumps to top.
- [ ] Delete → confirm prompt → conversation disappears, and if it was active, chat resets.
- [ ] Export → downloads `openrx-chat-<id>.md`.
- [ ] Reload → sidebar restores all conversations server-side.
- [ ] Live `https://openrx.health` redeploy still respects the new tokens (no console errors, no layout shift).
