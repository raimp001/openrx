# Website UX Iteration Prompt Pack

Date: July 9, 2026

## Critical Website Critique

OpenRx has stronger clinical infrastructure than the UI currently communicates. The website proves safety, sourcing, provider lookup, and referral discipline, but the patient-facing flow still asks the user to scan too many sections before understanding the answer.

Key issues:

1. The screening page has the right data, but the first result state is not yet a crisp care brief. The user should immediately see: what is due, what is uncertain, and what to do next.
2. Action links are present but dispersed. Provider search, source links, clinician messaging, local matches, and trials need to feel like one connected care path.
3. The UI still uses multiple framed surfaces in sequence. It should feel more like ChatGPT/OpenEvidence: one focused input, one clear answer, then compact actions.
4. Safety controls are technically present but should be patient-legible. "Safety gate passed" or "clinician review needed" is clearer than buried provenance.
5. The product should reduce words, not add more. Each result state should answer one question: "What should I do next?"

## Improvement Plan

1. Add a minimal care-brief result band to `/screening`.
2. Put the safety gate, top recommendation, missing details, and action links in that band.
3. Keep the detailed plan, evidence, and directory sections below for users who want depth.
4. Preserve deterministic recommendation logic, source links, audit behavior, and referral consent.
5. Build, deploy, and verify production commit with `/api/deploy-info`.

## Execution Prompts

### Prompt 1: Screening Care Brief

Redesign only the first result state on `/screening`. Keep the existing form, rules engine, referral workflow, and evidence sections. Add a minimal care brief immediately after an assessment completes. It must show one plain-language answer, the clinical safety gate status, up to three missing details, and action buttons for finding care, opening the guideline source, drafting a clinician message, and exploring trials when relevant. Avoid nested cards and excess prose.

### Prompt 2: Connected Care Actions

Make action links feel like a care path, not separate features. For the top actionable recommendation, connect to provider search with handoff context, the source URL, clinician-message drafting, and trial search. Keep all actions visibly secondary to the clinical answer.

### Prompt 3: Result-State QA

Verify the result state for `age 45 male` has a colorectal screening recommendation, a source link, safety-gate status, and a care-navigation action. Verify that missing-history questions still appear and that no PHI is transmitted by simply opening provider search.
