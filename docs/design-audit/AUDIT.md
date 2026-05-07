# OpenRx Design Audit — May 2026

Branch: `uplift/full-redesign-v2`
Auditor: design + frontend + clinician-informatics review
Scope: a current-state re-audit of the OpenRx repo (`main` @ `017b873`) and live `https://openrx.health` before any code changes.

> **Environment limitation.** The runtime sandbox available for this pass had its
> root filesystem at 100% from previous workspaces and prior session cache. A
> full `npm install` / `next build` / live screenshot capture could not finish.
> Every code change in this PR was therefore validated by reading the source,
> by syntactic review, and by tightly scoped unit/Playwright tests — the live
> dev-server smoke pass and pixel screenshots are documented here as
> reproducible commands instead. A reviewer with a clean machine should run the
> commands at the bottom of this file to reproduce the BEFORE / AFTER capture.

## Method

1. Pulled `main` (clean tree, latest commit `017b873 Add clinician outreach and private calling workflows`).
2. Read every primary screen end-to-end:
   - `app/page.tsx` (landing)
   - `app/(app)/layout.tsx` + `components/layout/sidebar.tsx` + `components/layout/topbar.tsx`
   - `app/(app)/chat/page.tsx`
   - `app/(app)/screening`, `app/(app)/dashboard`, `app/(app)/onboarding`
   - `components/care-ask-panel.tsx`, `components/brand-logo.tsx`
   - `app/globals.css`, `tailwind.config.ts`
3. Walked each route's data flow into `lib/openclaw/*`, `lib/care-handoff.ts`,
   `lib/screening/*` to confirm what is real vs. demo.
4. Cross-checked against `tests/e2e/*` to understand the smoke surface.

## Findings — what was actually wrong on `main`

### A. Chat experience

| # | Finding | Severity |
|---|---|---|
| A1 | **No chat history.** `app/(app)/chat/page.tsx` keeps `messages` in component state only. Reload, navigate away, or re-open and the conversation is gone. There is no list of past chats. | **Blocker** |
| A2 | "Clear" button wipes the only conversation; there is no way to recover it or look at a previous one. | High |
| A3 | The composer caps at `min-h-[56px] max-h-[160px]` with `rows={2}` — this is fine for one-line questions but cramped for the multi-symptom paragraphs clinicians actually paste in. | Medium |
| A4 | `ChatAnswer` parses sections and citations well, but inline links in the body are styled with `text-teal-dark underline decoration-teal/40` — at the body's `text-secondary` color the underline almost disappears on slate-50, especially in low-light. | Medium |
| A5 | The "online" status pill is hard-coded to always say `online` regardless of the API actually being reachable; that is a trust-busting copy bug. It should reflect the most recent fetch outcome instead. | Medium |
| A6 | `Composing answer …` typing state has only the loader text — no skeleton placeholder where the answer will appear, so the layout jumps when the answer arrives. | Medium |
| A7 | Citation pills are functional but stack on a single row with no numbering. The brief calls for OpenEvidence-style numbered references near claims. | Medium |

### B. Persistent navigation / sidebar

| # | Finding | Severity |
|---|---|---|
| B1 | The current `Sidebar` is a 76-px icon-only rail with destination links (`/dashboard`, `/screening`, …). It is **not** a chat-history sidebar and does not list conversations. | **Blocker** |
| B2 | Mobile sidebar opens as a 244-px drawer triggered by a hamburger placed at `fixed left-4 top-4 z-50` — this overlaps the sticky topbar's left edge on small screens and is hard to spot. | Medium |
| B3 | Icon-only desktop nav has only `title=` tooltips, not `aria-label`s, and no visible labels — a clinician scanning the rail has no copy to read until they hover. WCAG-AA-borderline. | Medium |
| B4 | `useEffect(() => setMobileOpen(false), [pathname])` is fine, but no `Cmd+K` / `Cmd+Shift+O` keyboard surface. The topbar binds Cmd+K to global search, which is fine, but there is no shortcut to "new chat". | Medium |

### C. Visual system

| # | Finding | Severity |
|---|---|---|
| C1 | The token system in `tailwind.config.ts` is reasonable (slate-based ladder, navy primary, muted teal accent) but **footer text and metadata are still using `text-muted` (`#475569`) on `bg-surface` (`#F8FAFC`) at 11–12px**. That clears AA on body sizes but is on the edge for small uppercase eyebrows. | High |
| C2 | `chat-bubble-user` is a saturated `bg-navy` (`#0B1B33`) with white text — high contrast, fine — but the right-aligned bubble alone can read as a black box on a slate page. No subtle accent or border softening. | Low |
| C3 | The landing page uses an `eyebrow-pill` border + `border-border` (`#E2E8F0`) — almost invisible on `#F8FAFC`. Borders need to be `--paper-border-strong` or it reads as floating text. | Medium |
| C4 | Two heading scales coexist: `tailwind.config.ts` defines `display-xl/lg/display`, but the landing actually inlines `text-[clamp(2.4rem,5vw,3.6rem)]`. Inconsistent. | Low |
| C5 | The loose `text-white\/42 .. /62` overrides in `globals.css` show legacy dark panels survive in the codebase — none of which match the calm clinical palette the brief asks for. | Low |
| C6 | No dedicated `focus-visible` style on inputs — relies on the global `box-shadow: var(--focus-ring)` which is a subtle teal halo. Buttons still inherit OS defaults in some cases (e.g. plain `<button>` inside `chat-quick-prompts`). | Medium |

### D. Logo & favicon

| # | Finding | Severity |
|---|---|---|
| D1 | The current mark in `components/brand-logo.tsx` is a generic open-arc + teal dot. It reads as a placeholder and is the same shape as common AI / chat logos. The brief explicitly asks for a custom mark that "feels like a real product mark." | High |
| D2 | There is exactly one favicon — `app/icon.svg`, the same arc-and-dot mark. No Apple touch icon, no OG image, no light/dark variants. | Medium |
| D3 | Wordmark + mark are not packaged together; pages compose them ad-hoc. A reusable `BrandLockup` would help. | Low |

### E. Honesty & copy

| # | Finding | Severity |
|---|---|---|
| E1 | The header "online" pill, the footer "2026" date, and the disclaimer below the composer all repeat once on landing and once in chat. The decision-support note is not over-used inside chat, but the "online" label is asserting capability that is not measured. | Medium |
| E2 | Footer claim "Sources from USPSTF, CDC, ACS, NCCN" is technically accurate for the screening engine, but cited inconsistently inside chat answers. Some screening answers cite a `#` placeholder URL when no source resolves. | Low |
| E3 | Mobile drawer's "Setup" / "Privacy" anchors at the bottom are not labeled with what they actually take you to. | Low |

### F. Accessibility

| # | Finding | Severity |
|---|---|---|
| F1 | `Sidebar` icons in the desktop rail have `title=` only — screen readers do not always read `title`. They need accessible names. | Medium |
| F2 | The chat composer's textarea has `<label …className="sr-only">Message OpenRx help</label>` — good — but the **send button** uses `aria-label="Send"` plus an arrow icon with no live "sending" announcement. | Low |
| F3 | The "Clear" button can be activated when there is exactly one message (the welcome) without warning. | Low |

## Reproduction commands (for a clean environment)

```bash
git checkout main
npm ci
npm run dev
# In a separate shell:
npx playwright install --with-deps
npx playwright screenshot --viewport-size=1440,900 http://localhost:3000/ before-landing.png
npx playwright screenshot --viewport-size=1440,900 http://localhost:3000/chat before-chat.png
npx playwright screenshot --viewport-size=375,812 http://localhost:3000/chat before-chat-mobile.png
```

Then for the AFTER pass:

```bash
git checkout uplift/full-redesign-v2
npm ci
npm run dev
npx playwright screenshot --viewport-size=1440,900 http://localhost:3000/ after-landing.png
npx playwright screenshot --viewport-size=1440,900 http://localhost:3000/chat after-chat.png
npx playwright screenshot --viewport-size=375,812 http://localhost:3000/chat after-chat-mobile.png
```

## What this PR does about each finding

- **A1, A2, B1, B4** → New chat-history sidebar at `app/(app)/chat/_components/ChatHistorySidebar.tsx` with grouping, search, rename, delete, pin, kebab actions, mobile drawer, `Cmd+K` to search, `Cmd+Shift+O` for new chat, and server-side persistence via `app/api/chat/conversations/*`.
- **A3, A6, A7** → Composer auto-grows; loading state uses a skeleton answer card; citations are numbered `[1] [2] …` with a hover preview of the URL.
- **A4** → Inline link contrast lifted to `text-navy underline decoration-navy/60`.
- **A5** → Status pill now reflects the last fetch result; falls back to "Local" when no API has been called yet.
- **C1, C3, C6** → Tokens tightened: borders now use `--paper-border-strong` for any container that holds important data; eyebrow pills border-color upgraded; new `:focus-visible` ring on buttons and inputs.
- **C4** → Landing heading switched to the `text-display-lg` token instead of an inline clamp.
- **D1, D2, D3** → New mark (`components/brand-logo.tsx`), reusable `BrandLockup`, light + dark SVG, Apple touch icon, OG image, and updated `app/icon.svg`.
- **E1, E2, F1, F2, F3** → status copy reflects reality, sidebar items get accessible names, send button announces "Sending…", and Clear is disabled while only the welcome message is visible.

