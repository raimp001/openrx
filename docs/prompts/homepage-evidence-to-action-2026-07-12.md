# Homepage Evidence-to-Action Rebuild

Date: July 12, 2026

## Critique Converted To Implementation

OpenRx had the right technical foundation, but the public homepage still made the product feel like several modules sharing one brand: screening, provider search, trials, pharmacy, prior authorization, APIs, and provider enrollment. The highest-leverage change is to make the first five seconds answer one question:

What does OpenRx do?

New answer:

OpenRx turns clinical evidence into the next completed action.

## Product Direction

OpenRx should not compete as a generic medical-search chatbot. The differentiated lane is evidence-to-action:

- ask a clinical or coverage question;
- extract structured facts;
- apply version-stamped rules or evidence policy;
- show the source, grade, version, and rule id;
- identify missing information;
- prepare the next reviewed workflow.

## Patch Plan

1. Replace the broad feature-grid hero with one focused evidence-to-action hero.
2. Simplify public navigation to Product, Clinicians, Patients, Health systems, Trust, and Try OpenRx.
3. Add a synthetic scenario panel above the fold.
4. Render the synthetic scenario through the existing deterministic screening rules engine instead of hard-coding clinical-looking output.
5. Show structured facts, review status, source, grade, rule id, missing inputs, and next actions.
6. Replace six equal modules with three product pillars:
   - Evidence you can inspect.
   - Logic you can audit.
   - Actions you can complete.
7. Preserve clinical, privacy, referral, and external-action behavior.

## Execution Prompt

Redesign only the public homepage. Preserve all clinical rules, model-boundary behavior, referral gates, privacy behavior, and external submission boundaries. Build the homepage around the headline "Clinical evidence is only useful when it becomes action." The page must prove the product with one synthetic evidence-to-action workflow and three audience doors: clinicians, patients, and health systems.

## Acceptance Notes

- The synthetic example is explicitly labeled and educational.
- The example uses `recommendScreenings(screeningIntakeFromLegacy(...))`.
- The page no longer presents screening, providers, trials, pharmacy, prior auth, APIs, and network enrollment as six equal above-the-fold product identities.
- Tests assert the new copy and server-rendered engine-backed example.
