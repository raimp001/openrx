# OpenRx Positioning Decision Memo

Date: May 24, 2026
Decision: Keep chat as the interface, position prior authorization execution as the product outcome.

## Decision in one sentence

Use: **From clinical answer to approved prior auth, in one chat.**
Immediately qualify the claim in product copy: OpenRx prepares cited authorization and appeal work in the demo today; live payer submission requires contracted integrations and human confirmation.

## Why this decision is now necessary

- Chat-only clinical answers are entering a crowded, well-funded category. OpenAI documents ChatGPT for Clinicians as free for verified US clinicians using NPI and license verification, with clinical search and citations.
- OpenEvidence reported one million physician consultations in a day in March 2026 and announced a Tandem partnership in April 2026 connecting evidence-based decisions to prescription and prior authorization workflows.
- CMS-0057-F creates a concrete execution timing window. Impacted payers generally must implement Prior Authorization APIs beginning January 1, 2027 for covered items and services, excluding drugs under the final rule. CMS separately proposed medical-benefit drug PA requirements in April 2026; do not describe that proposal as final.

## Option 1: PA-first hero, chat as feature

Positioning: **Submit cleaner prior authorizations and appeals through the 2027 FHIR workflow.**

| Question | Answer |
| --- | --- |
| Buyer | Practice administrator, oncology authorization team, revenue-cycle leader, health system innovation group, specialty pharmacy access team |
| First dollar | Paid pilot for denial work queues, appeal package drafting, or integration readiness assessment. A realistic early contract is workflow software plus implementation, not payer-approved automation. |
| 24-month moat | Payer rule normalization, denial and overturn outcome dataset, FHIR/PAS adapter library, specialty-specific documentation graph, audit evidence, and integrations into ordering workflows. |
| Founders Fund 90-second read | Clear market, regulatory timing, and workflow pain. Weakness: site must prove a usable product, not merely cite the CMS deadline. A PA-first homepage with no working denial demo looks like compliance theater. |

Advantages:

- Directly maps to an economic buyer and measurable ROI: staff time, delay reduction, overturn rate, time to therapy.
- Avoids competing head-on with broad clinical answer products.
- Gives the CMS API date a legitimate reason for urgency.

Risks:

- Requires credible security, workflow audit, payer integration, and specialty policy handling earlier.
- Drug authorization claims need precision because CMS-0057-F final-rule PA API scope excludes drugs; drug expansion was proposed in 2026, not finalized in the cited source.
- A patient-facing site does not naturally convert the PA buyer.

## Option 2: Chat-first hero, PA as the action layer

Positioning: **Ask a clinical question. Get cited guidance and complete the authorization next step in the same conversation.**

| Question | Answer |
| --- | --- |
| Buyer | Clinician champion first, then practice or service-line administrator purchasing execution capability |
| First dollar | Paid specialty pilot attached to one workflow, such as oncology denial-to-appeal review, while clinical answer chat remains a demo or acquisition surface. |
| 24-month moat | Intent-to-action data: which cited decisions lead to PA packets, what evidence changes payer outcomes, and which missing-document prompts prevent denials. The chat surface becomes distribution, not the moat itself. |
| Founders Fund 90-second read | The product is immediately understandable and demoable. Weakness: “clinical chat” looks undifferentiated unless the first screen visibly reaches submission-ready work within seconds. |

Advantages:

- Preserves the most intuitive interface already built in OpenRx.
- Lets a visitor experience the wedge without auth, EHR, or payer connection.
- Shows an execution layer behind an answer instead of a standalone forms product.

Risks:

- Visitors may categorize the company as another medical answer bot unless PA is above the fold and in the demo.
- Clinician acquisition is expensive if execution does not immediately pay for itself.
- Citation credibility requires licensed content or explicit boundaries; do not present a simulated NCCN retrieval as live licensed access.

## Recommendation

Choose **Option 2**, but replace the generic chat-only promise with an execution-shaped promise:

> **From clinical answer to approved prior auth, in one chat.**
> Built for the 2027 CMS FHIR prior authorization transition.

Make the first proof point a no-auth `/demo` flow: choose a denied scenario, see version-pinned evidence metadata, generate a cited appeal draft, and view a clearly labeled sandbox FHIR submission event. This retains chat usability while showing the investable layer: clinical decision to administrative execution.

## Smoke test before an investor meeting

In the first 90 seconds, the site should establish:

1. The buyer problem: a medically supported treatment is denied and staff must assemble an appeal.
2. The product action: the user moves from denial to cited appeal draft to a visible FHIR/MCP submission stub.
3. The truth boundary: sandbox only, human review required, no live payer transaction in the demo.
4. The regulatory timing: CMS PA APIs generally begin January 1, 2027 for impacted payers and applicable non-drug items and services.
5. The wedge: oncology and specialty care PA first, not every healthcare workflow at once.

## Sources

- CMS, Interoperability and Prior Authorization Final Rule CMS-0057-F: https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f
- CMS, 2026 Interoperability Standards and Prior Authorization for Drugs Proposed Rule: https://www.cms.gov/newsroom/fact-sheets/2026-cms-interoperability-standards-prior-authorization-drugs-proposed-rule
- OpenAI, ChatGPT for Clinicians: https://help.openai.com/en/articles/20001202-chatgpt-for-clinicians
- OpenAI, Making ChatGPT better for clinicians: https://openai.com/index/making-chatgpt-better-for-clinicians/
- OpenEvidence and Tandem partnership announcement, Business Wire, April 2, 2026: https://www.businesswire.com/news/home/20260402254260/en/OpenEvidence-and-Tandem-Partner-to-Streamline-Evidence-Based-Prescribing-and-Prior-Authorizations
- OpenEvidence reported usage milestone, PR Newswire, March 12, 2026: https://www.prnewswire.com/news-releases/openevidence-achieves-historic-milestone-1-million-clinical-consultations-between-verified-doctors-and-an-artificial-intelligence-system-in-a-single-day-302712459.html
