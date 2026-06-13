# OpenRx design tokens

Source of truth: `lib/design-tokens.ts`.

This file defines the next OpenRx visual system before component refactors. It is additive for now: existing components are intentionally unchanged until the scoped hero, screening, docs, pricing, and trust passes.

## Direction

- Patient-facing surfaces use `patientLight`: high contrast, light clinical background, readable type, restrained blue actions, and sage/teal trust signals.
- Developer, MCP, API, and audit surfaces use `developerDark`: dark technical workspace, precise borders, teal actions, and readable code-focused contrast.
- Components should reference semantic tokens such as `--orx-action`, `--orx-surface`, `--orx-border`, and `--orx-text-primary`, not primitive hex values.
- Recommendation and consent UI should use the `recommendation`, `source`, `grade`, `due`, and `verified` variants so clinical provenance stays visually consistent.

## Usage rules

1. New UI work imports tokens from `lib/design-tokens.ts` or maps its CSS variables into Tailwind.
2. Do not add new hardcoded colors, shadows, radii, or one-off gradients in components.
3. Use `patientLight` by default for screening, referrals, provider search, labs, imaging, and consent flows.
4. Use `developerDark` for API docs, MCP surfaces, prior-auth demo workspaces, compliance ledgers, and audit consoles.
5. Card radius should default to the tokenized `0.5rem`; larger radii are reserved for major panels or modals.
6. Buttons must use token variants so text/background contrast stays predictable.
7. PHI-adjacent UI changes still require the `/cso` checkpoint. Tokens can change presentation only; they must not change logging, persistence, disclosure scope, or referral state-machine behavior.

## Migration plan

1. Wire CSS variables from `openRxCssVariableThemes` into `app/globals.css`.
2. Update `tailwind.config.ts` aliases to reflect token semantics instead of legacy names.
3. Refactor the landing hero first.
4. Refactor one component at a time: screening intake, docs nav, trust/compliance, pricing.
5. Run QA at 375px, 768px, and 1440px after each visual pass.
