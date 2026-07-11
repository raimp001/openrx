# OpenRx Critical App Audit Prompt Pack

Date: July 11, 2026

## Live Audit Summary

Audited production routes:

- `/`
- `/chat`
- `/screening`
- `/providers`
- `/clinical-trials`
- `/join-network`
- `/trust`
- `/privacy-explained`

Checks run:

- Production commit check via `/api/deploy-info`.
- Console error scan.
- Horizontal overflow scan.
- First-viewport screenshot review.
- Contrast candidate scan.
- Source scan for stale phrases, low-contrast utility usage, and old visual systems.

## Critical Issues Found

1. `/privacy-explained` was visually inconsistent with the rest of OpenRx.
   - It used a pale page background while most public and app surfaces now use the dark minimal system.
   - The brand wordmark was nearly invisible in the header.
   - Several list rows used white text on light gray panels.
   - It looked like an older product rather than part of the current OpenRx experience.

2. The product has strong clinical/compliance mechanics, but the user-facing quality bar depends on every page feeling like the same application.
   - Landing, chat, screening, provider search, and trials are now much closer.
   - Privacy/trust pages must not feel like separate template leftovers because they are confidence-critical.

3. The app still has many very low-opacity surfaces.
   - Some audit candidates are false positives because transparent overlays are composited in-browser.
   - The practical product rule should be: patient-facing text should use `text-zinc-300` or stronger unless it is decorative metadata.

4. The best next product upgrade after this patch is not more copy.
   - It is fewer surfaces, consistent action controls, and compact answer-first panels on every workflow page.

## Improvement Plan

1. Convert `/privacy-explained` to the current dark, minimal OpenRx system.
2. Replace light panels with high-contrast rows and restrained dark surfaces.
3. Add page metadata and canonical URL.
4. Preserve all privacy/compliance content while making it easier to scan.
5. Rebuild, test, push, deploy, and verify production commit.

## Execution Prompts

### Prompt 1: Privacy Page Theme Fix

Rewrite only `/privacy-explained` to match the current OpenRx visual system. Use dark background, high-contrast text, minimal cards, simple divider rows, and the dark brand header. Preserve all policy content. Do not touch clinical, referral, analytics, or persistence logic.

### Prompt 2: High-Contrast Product QA

Run a first-viewport visual QA on `/privacy-explained`, `/trust`, `/chat`, `/screening`, `/providers`, and `/clinical-trials`. Flag any page that uses a different theme, low-contrast text, or nested card-heavy layouts. Fix only the highest-impact inconsistency in the current pass.

### Prompt 3: Production Verification

After commit and push, verify:

- Vercel status is successful.
- `https://openrx.health/api/deploy-info` reports the new commit.
- `https://openrx.health/privacy-explained` renders the new dark page.
- A focused Playwright smoke check passes for privacy, chat, and screening.

## Patch Applied

- Reworked `/privacy-explained` into the dark system.
- Added metadata and canonical route metadata.
- Replaced old light panels with high-contrast dark rows.
