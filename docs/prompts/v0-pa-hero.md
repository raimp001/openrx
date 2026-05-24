# OpenRx Hero Prompt for v0 or Lovable

Design a high-trust hero section for a healthtech SaaS called OpenRx.

Audience: hematology-oncology and primary care physicians.

Primary promise:

**From clinical answer to approved prior auth, in one chat.**

Required qualification beneath the promise:

**Built for the 2027 CMS FHIR prior authorization transition. Demo submissions are simulated until a payer integration is active.**

Design direction:

- Clinical and restrained.
- Dark graphite background with warm white text and one muted cyan action color.
- No stock gradients, no decorative medical crosses, no emojis.
- Generous whitespace and strong contrast.
- Clear typography, small amount of precise copy, no marketing clutter.
- System font stack is acceptable.

Hero layout:

- Left: eyebrow `OPENRX FOR CLINICIANS`, headline, two-line subcopy, primary button `Run denial demo`, secondary text link `Review trust posture`.
- Directly under actions: quiet proof line `Cited evidence | Human review required | FHIR-ready workflow`.
- Right: a realistic chat/workflow panel.

Right-side fake chat:

1. Clinician message: `Teclistamab denied: RRMM after 4 prior lines. Draft an appeal.`
2. OpenRx answer: `The denial may be addressable. I found required prior-therapy documentation and a version-pinned evidence reference.`
3. Citation card: `FDA Tecvayli indication, March 5, 2026` with a visible source link.
4. Secondary source status: `NCCN Multiple Myeloma: licensed version verification required before submission.`
5. Primary inline action button: `Generate appeal letter`.
6. Small status stepper: `Ask` then `Cite` then `Submit`.

Below the fold:

- A trust strip containing: `USPSTF`, `CDC`, `ACS`, `NCCN source policy`, `HIPAA readiness path`, `SOC 2 in progress`.
- Do not say `HIPAA compliant` or `SOC 2 certified`.
- Add one sentence: `Clinical output requires clinician review. Prior authorization submission is simulated in this public demo.`

Accessibility:

- WCAG AA contrast.
- Visible focus states.
- Buttons at least 44 px tall.
- Usable on mobile with chat panel below headline.

Do not use em dash characters anywhere in copy or generated UI.
