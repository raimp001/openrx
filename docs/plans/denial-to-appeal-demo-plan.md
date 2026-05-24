# Denial-to-Appeal Demo Build Plan

## Goal

Provide a zero-auth, canned-data `/demo` experience that proves OpenRx can convert a clinical denial into a reviewable appeal workflow without claiming a real payer submission.

## User flow

1. Select one scenario:
   - Teclistamab denied after four prior lines
   - Semaglutide denied for type 2 diabetes with BMI 31
   - CAR-T denied for relapsed or refractory DLBCL
2. Read a preloaded denial letter and minimal synthetic patient summary in the chat surface.
3. Retrieve version-pinned evidence metadata.
4. Generate a cited draft appeal letter.
5. Click `Submit via FHIR PA`.
6. See a sandbox MCP trace and fake tracking number with explicit labels: no payer received data and no authorization was submitted.

## Gstack tasks

| Task | Files | Test |
| --- | --- | --- |
| Model synthetic cases and source metadata | `lib/demo/prior-auth.ts` | Validate scenario IDs, source versions, and sandbox submission shape |
| Expose canned server workflow | `app/api/demo/prior-auth/route.ts` | POST evidence, draft, submit; reject unknown action/scenario |
| Build public demo page | `app/demo/page.tsx`, `components/demo/denial-to-appeal-demo.tsx` | Select scenario, create draft, show FHIR stub success |
| Track safe workflow events | `lib/product-analytics.ts`, demo component | Permit only event stage metadata, no denial free text |
| Add discoverability | `app/sitemap.ts`, `app/robots.ts`, metadata | Route smoke test and generated metadata check |
| Quality and safety | `tests/e2e/denial-demo.spec.ts` | No auth, no real submission claim, cited draft, fake tracking number |

## Source handling

- Public FDA and CMS links may be displayed directly.
- NCCN may be shown only as guideline metadata with a pinned version and `licensed verification required` status unless licensed source retrieval exists.
- Semaglutide evidence must not be mislabeled as NCCN or USPSTF if the cited path is FDA or ADA.
- Every appeal draft must say clinician review is required before any external submission.

## MCP and FHIR fallback

The first demo implementation uses a deterministic server-side stub:

```text
tool: prior_authorization.submit
transport: FHIR R4 / Da Vinci PAS sandbox adapter
endpoint: sandbox://openrx/payer/prior-auth
result: accepted_for_demo_tracking
```

If an MCP server is unavailable, the UI returns the same deterministic stub trace with `adapterStatus: simulated`. It never silently falls back to a claim of payer transmission.

## Definition of done

- No login, wallet, or PHI required.
- Three scenario cards work on mobile and desktop.
- Appeal output includes source labels, versions, and links.
- FHIR submit state is visibly simulated.
- Test coverage rejects any phrasing that implies live payer submission.
