# App Router, SEO, and Trust Surface Plan

## Correction to the premise

OpenRx is already implemented in Next.js App Router. The needed work is not a client-only React migration. It is an incremental SSR, metadata, SEO, analytics, and trust-surface completion pass.

## Target file tree

```text
app/
  layout.tsx                         # shared metadata and Organization JSON-LD
  page.tsx                           # decide whether chat redirect remains intentional
  demo/
    page.tsx                         # SSR public PA demo entry
  trust/
    page.tsx                         # security, privacy, BAA and citation posture
  guidelines/
    [slug]/
      page.tsx                       # ISR guideline explainers with FAQPage JSON-LD
  prior-authorization/
    [slug]/
      page.tsx                       # ISR PA-keyword landing pages
  robots.ts
  sitemap.ts
  opengraph-image.png                # 1200 x 630 fallback
public/
  og-image.svg                       # primary vector asset
lib/
  seo/
    structured-data.ts
    guideline-pages.ts
    pa-pages.ts
  analytics/
    posthog-client.ts
    demo-events.ts
```

## Pre-rendering plan

| Surface | Rendering | Reason |
| --- | --- | --- |
| `/` | Static or redirect-free SSR landing, decision required | Search engines need a stable value proposition rather than only a redirect |
| `/demo` | Static shell with client interaction | Investor and pilot demo should load instantly |
| `/trust` | Static | Procurement and clinician review asset |
| Approximately 50 PA keyword pages | `generateStaticParams` plus ISR | Capture precise, truthful workflow intent without hand-writing pages |
| Chat workspace | Dynamic client surface | Conversation state and API interaction |

## JSON-LD plan

- `Organization` on the root landing page only.
- `MedicalWebPage` on factual, reviewed Q and A or clinical guidance pages, not on generated chat messages.
- `FAQPage` on guideline education pages only when visible questions and answers are authored and reviewed.
- Avoid schema markup for unreviewed AI output.

## Analytics plan

PostHog may be enabled only after consent and PHI review. For `/demo`, named events contain synthetic workflow metadata only:

```text
demo_viewed
demo_scenario_selected
demo_evidence_retrieved
demo_appeal_generated
demo_fhir_stub_opened
demo_fhir_stub_completed
demo_source_opened
```

Never send free text, diagnosis detail, denial text, identifiers, or payer member data.

## Migration order

1. Ship `/demo` and event schema with synthetic data only.
2. Add `/trust`, `robots.ts`, `sitemap.ts`, PNG OG fallback, and accurate root metadata.
3. Decide root experience: chat-first landing or short marketing landing with chat entry.
4. Build reviewed guideline content model and JSON-LD helpers.
5. Publish a small first batch of PA pages after clinical and legal review.
6. Expand to approximately 50 pages only after measuring search quality and correcting inaccurate claims.

## Rollback plan

- Feature flag `/demo` navigation entry and any analytics provider initialization.
- Keep PA pages generated from a single content registry so a rollback removes the registry entries and sitemap output.
- Keep the current `/chat` route unchanged while root positioning is evaluated.
- Disable PostHog entirely through an environment switch if consent or data review fails.
- Never require the SEO layer for chat or clinical safety routing.

## Risks

| Risk | Mitigation |
| --- | --- |
| CMS final rule scope overclaimed for medical-benefit drugs | Distinguish final non-drug API scope from 2026 drug proposal on every page |
| Unlicensed NCCN content reproduced or implied to be live | Store metadata and links only until licensing and retrieval rights exist |
| Search pages look like medical advice or payer guarantees | Human review, decision-support language, no coverage promises |
| PostHog captures PHI in URL or event values | Synthetic-only demo events, allowlisted properties, URL scrubbing and consent review |
| Trust page claims HIPAA or SOC 2 status prematurely | Use posture/status language with dates and evidence, never a certification claim without proof |
| Root redirect weakens SEO | Replace with a server-rendered, concise landing once positioning is approved |
