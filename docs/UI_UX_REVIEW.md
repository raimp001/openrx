# OpenRx UI/UX review

See full backlog in git history. **Recently implemented:**

- **Skip link** — `.skip-link` in `app/globals.css`; first focusable control in `app/(app)/layout.tsx` targets `#main-content`.
- **Main landmark** — `<main id="main-content" tabIndex={-1}>` wraps app page content (focus target after skip).
- **Shared brand** — `components/brand-logo.tsx` (`BrandMark`, `BrandWordmark`) used on landing header and sidebar.
- **Chat** — Message list `role="log"` + `aria-live="polite"`; composer sticky with backdrop + safe-area padding; `min-h-11` touch targets; labeled inputs/buttons; chat card uses `surface-card` + flex min/max height for scroll behavior.

Remaining backlog: landing skip link, shared skeleton kit, table mobile pass, `prefers-reduced-motion` for animations.

Second pass applied:

- **Billing** — table-style claims list replaced by a review lane with priority cards, claim summaries, and clearer patient-facing next steps.
- **Messages** — thread view now matches the chat shell: sticky composer, conversation stats, and a side rail for AI drafting/context.
- **Vitals** — charts and alerts now live inside the same ops-panel structure used elsewhere, with a clearer patient synopsis rail.
- **Compliance ledger** — command deck, refund queue, and artifact feeds are grouped into operational sections instead of flat forms.
