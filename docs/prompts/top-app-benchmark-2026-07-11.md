# OpenRx Top-App Benchmark Prompt Pack

Date: July 11, 2026

## Benchmark Set

- ChatGPT: one focused input, lightweight chrome, quick examples, clear privacy posture, and broad task completion.
- Claude: calm workspace, restrained visual language, strong prompt starters, readable answer surfaces.
- Perplexity: answer-first search with visible source links and follow-up paths.
- OpenEvidence: clinical answer behavior should privilege evidence quality, specialty context, and verifiability over generic prose.

## OpenRx Benchmark Standard

OpenRx should not copy any single app. It should combine the best UX primitives from the benchmark set with a healthcare-specific moat:

1. One primary input on every patient-facing entry point.
2. One plain-language answer before any secondary content.
3. Every clinical claim has source, grade, rule version, or a clinician-escalation state.
4. Every answer ends with action links: find care, open source, message clinician, explore trials, pharmacy/prior-auth when relevant.
5. No decorative clutter, nested panels, or duplicated controls.
6. Mobile-first layout with readable contrast, visible focus states, and no low-contrast secondary text.
7. Error states are clean and mutually exclusive with answer templates.

## Critical Site Critique

OpenRx is strongest where ChatGPT, Claude, Perplexity, and OpenEvidence are weakest for patient navigation: the app can turn a sourced recommendation into provider, lab, trial, pharmacy, and prior-auth action. The remaining product issue is that those actions can feel like separate pages instead of a single path.

Highest-impact issues:

1. Action controls were repeated with slightly different shapes and density across landing, chat, and screening.
2. Screening results had the right content but made users scan multiple areas before seeing the next actionable move.
3. Chat felt modern, but the starter actions still used a custom pill style rather than the same action language as the rest of the app.
4. The site needs an explicit benchmark scorecard so future UI iterations preserve minimalism rather than adding explanatory copy.

## Execution Prompts

### Prompt 1: Unified Answer Actions

Create one reusable `AnswerActionGrid` component for all patient-facing next actions. Use compact rounded action rows, high contrast, one primary action, consistent icons, visible focus states, and truncation that prevents layout shifts. Replace bespoke action buttons in the landing page, chat empty state, and screening care brief.

### Prompt 2: Answer-First Screening

Keep the screening engine untouched. In the result state, surface the answer, safety state, missing details, and the unified actions before the detailed plan. The first action should be care navigation when a primary recommendation exists.

### Prompt 3: Benchmark QA

Run build plus focused E2E checks for landing, chat, and screening. Verify `age 45 male` still returns colorectal screening with source/grade, no upstream error leakage, and visible care-navigation actions. Verify production `/api/deploy-info` after deployment.

## Current Implementation

- Added `components/answer-action-grid.tsx`.
- Reused it on `/`, `/chat`, and `/screening`.
- Added first-viewport screening answer actions for missing-history clarification and guideline source review.
- Preserved deterministic screening, source rendering, referral consent, and audit behavior.
