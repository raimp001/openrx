# HIPAA Readiness and Trust Shelf

Date: May 24, 2026
Scope: Pre-seed OpenRx, clinician founder, demo data only today. This is a product and operational checklist, not legal advice.

## Current public posture

The live privacy page accurately says OpenRx is a personal coordination and decision-support product, not a hospital, insurer, or clinician, and offers demo-first exploration. Keep that honesty. Do not publish `HIPAA compliant`, `SOC 2 certified`, or `live payer submission` claims until the corresponding legal and technical evidence exists.

## 1. Must be public before any pilot conversation

| Requirement | Status needed | Fellow-status issue |
| --- | --- | --- |
| A `/trust` page stating demo versus production boundaries, citation policy, model-provider policy, security contact, BAA availability status, incident contact, and SOC 2 status | Publish before outreach | None by itself |
| Clear disclaimer that OpenRx is decision support and authorization workflow assistance, not ordering, diagnosis, medical care, or approval guarantee | Publish throughout demo | **Flag:** do not imply the founder personally provides clinical care through the product |
| Accurate CMS statement: API compliance generally begins January 1, 2027 for impacted payers; final-rule PA API coverage excludes drugs, while 2026 drug expansion is proposed | Publish on PA pages | None |
| Source provenance and version policy, including NCCN licensed-access boundary | Publish before citing NCCN in demo | **Flag:** clinical credibility does not permit redistribution of licensed institutional content |
| Privacy notice describing demo data, analytics allowlist, deletion contact, wallet status, and no PHI on-chain policy | Publish | None |
| Company identity and contact information; separate product identity from training institution | Publish | **Flag:** do not use fellowship program, hospital logo, patient access, or institutional endorsement without written authorization |

## 2. Must be signed or in place before first PHI touches the stack

| Requirement | Minimum evidence | Fellow-status issue |
| --- | --- | --- |
| Written HIPAA applicability assessment with counsel: covered entity, business associate, direct-to-consumer path, and pilot data flow | Signed memo and data-flow diagram | **Flag:** whether information is received as a treating clinician, employee, researcher, or vendor materially changes obligations |
| BAAs with every vendor that creates, receives, maintains, or transmits ePHI on behalf of a covered entity or business associate, including cloud hosting, database, model provider, support, observability, OCR, messaging and telephony where applicable | Executed agreements and approved configuration inventory | None |
| Security risk analysis and remediation tracker | Documented risk analysis, asset inventory, risk owner, remediation dates | None |
| Access control, MFA, least privilege, separate production access, audit logs, encryption at rest and transit, backup and recovery validation | Screenshots/config export plus tested procedures | **Flag:** no use of hospital credentials or patient records for product testing |
| Incident response and breach-notification process | Approved policy, response roles, contact tree, tabletop record | None |
| Data retention and deletion policy; production PHI excluded from analytics and AI training by contract/configuration | Policy plus vendor verification | None |
| Pilot agreement and clinical safety protocol: who reviews output, who submits PA, who owns patient communication, escalation pathway | Signed agreement | **Flag:** a fellow cannot independently represent institutional workflow authority unless authorized; ensure supervising and institutional approval where the pilot overlaps training duties |
| Professional liability and corporate coverage review | Written broker/counsel review | **Flag:** malpractice coverage through training may not cover startup product activity |

HHS states that a cloud provider creating, receiving, maintaining, or transmitting ePHI on behalf of a covered entity or business associate is itself a business associate even if the data is encrypted and the provider cannot decrypt it. A BAA and risk analysis are therefore prerequisites for any PHI pilot path.

## 3. Ninety-day path to SOC 2 Type 1

SOC 2 is not HIPAA compliance and is not required by HIPAA. It is a procurement trust artifact. Cost estimates below are market estimates, not guaranteed quotes.

| Days | Work | Estimated external spend |
| --- | --- | ---: |
| 0 to 15 | Define Security-only scope, production boundary, vendors, assets, access list, data-flow diagram, HIPAA counsel review, select readiness platform or lightweight policy stack | $3,000 to $15,000 legal and advisory; $0 to $8,000 tooling annualized |
| 16 to 35 | Implement MFA/SSO where feasible, device and access management, logging, vulnerability/dependency program, change control, backups, incident response, vendor review, BAA register | $2,000 to $15,000 tooling and remediation |
| 36 to 55 | Run gap assessment, remediate findings, perform security risk analysis, conduct tabletop, gather evidence, choose CPA auditor | $3,000 to $12,000 advisory or pentest depending scope |
| 56 to 75 | Freeze scope, collect point-in-time evidence, management representation preparation, audit fieldwork | $7,000 to $20,000 boutique Type 1 audit for a very small scoped startup; quotes vary substantially |
| 76 to 90 | Receive report or close remaining exceptions, publish truthful status statement, begin Type 2 observation planning | $0 to $5,000 incremental remediation |

Budget recommendation for a one-founder, narrowly scoped demo-to-pilot company: allocate **$20,000 to $60,000** for counsel, security readiness, tooling, targeted testing, and Type 1 audit. Obtain at least three CPA quotes. Public pricing summaries vary widely, with small startup Type 1 audit figures commonly beginning near $7,000 to $15,000 and broad ranges substantially higher.

## 4. Clauses for a standard partner BAA template

Have counsel draft and negotiate the actual agreement. Required or prudent clauses include:

1. Definition of PHI and ePHI and identification of the services covered.
2. Permitted and required uses and disclosures limited to contracted services and applicable law.
3. No sale, advertising use, model training, secondary analytics, or de-identification use except as expressly approved in writing.
4. Administrative, physical, and technical safeguards, including encryption, access controls, MFA, audit logging, secure deletion, backups and disaster recovery.
5. Subcontractor obligations and a maintained subprocessor list; subcontractors that handle PHI must accept equivalent BAA restrictions.
6. Incident and breach notice deadline shorter than the HIPAA outer deadline, including content requirements, investigation support, mitigation and cost allocation.
7. Access, amendment, accounting-of-disclosures and records-production support obligations.
8. Data return or destruction on termination, with written certification and clearly documented backup exceptions.
9. Audit and security-assurance rights, including risk assessments, penetration-test summaries, SOC reports when available, and remediation notices.
10. Data residency and cross-border transfer restrictions where required by the customer.
11. Termination rights for material security or privacy violation.
12. Order of precedence between the BAA and service agreement for PHI handling.
13. Allocation of responsibility for clinical decisions and payer submissions: OpenRx assists workflow; authorized clinical and billing personnel remain responsible for review and submission unless a later contracted workflow states otherwise.

## Sources

- HHS, Guidance on HIPAA and Cloud Computing: https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/
- HHS, Business Associates: https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html
- HHS, Guidance on Risk Analysis: https://www.hhs.gov/hipaa/for-professionals/security/guidance/guidance-risk-analysis/index.html
- CMS, Interoperability and Prior Authorization Final Rule CMS-0057-F: https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f
- Market reference for SOC 2 range, not an official standard: https://soc2scout.com/soc2-audit-cost
