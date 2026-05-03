# OpenRx

AI-powered healthcare clinic management platform — powered by [OpenClaw](https://openclaw.ai).

**Live:** [openrx.health](https://openrx.health)

## Features

- **Dashboard** — Real-time metrics, today's schedule, revenue chart, AI agent activity feed
- **Patients** — Searchable patient registry with detailed profiles and AI actions
- **Scheduling** — Insurance-aware appointment management with AI slot suggestions
- **Billing & Claims** — Claims analysis, error detection, AI-powered appeals
- **Prescriptions** — Adherence monitoring, refill coordination, AI outreach
- **Prior Authorization** — Status tracking, AI form submission, appeal preparation
- **Care Network Search** — Live NPI Registry search (provider/caregiver/lab/radiology) with natural-language gating
- **Pharmacy Finder** — Natural-language pharmacy search with clarification-first flow before query execution
- **AI Screening** — Source-tagged screening engine with USPSTF average-risk baseline, high-risk routing, red-flag escalation, and trackable next-step requests
- **Network Onboarding + Email Admin Review** — Provider/caregiver applications with signed email approval/rejection actions
- **Second Opinion** — Structured diagnosis and treatment-plan review
- **Clinical Trials** — Condition-aware trial matching with fit scoring
- **Compliance Ledger** — Payment intents, Base Pay verification, receipts, attestations, refunds, and audit ledger postings
- **Platform Readiness** — Live operational coverage checks for search, onboarding, screening, and payments
- **Messages** — Multi-channel conversations (WhatsApp, SMS, portal) with AI triage
- **AI Agent** — Interactive chat with 12 specialized healthcare agents

## OpenClaw Integration

OpenRx uses OpenClaw as its AI backbone with 12 specialized agents:

| Agent | Responsibility |
|-------|---------------|
| Onboarding | New patient setup, profile and care-team orchestration |
| Coordinator | Routes patient messages to the right specialist |
| Triage | After-hours symptom assessment and urgency classification |
| Scheduling | Insurance-aware booking, reminders, no-show follow-up |
| Billing | Claims error detection, appeal generation, revenue optimization |
| Rx Manager | Adherence monitoring, refill reminders, pharmacy coordination |
| PA Agent | Prior auth form filling, criteria matching, ePA submission |
| Wellness | Preventive care plans and screening follow-through |
| Screening | Risk stratification and preventive screening prioritization |
| Second Opinion | Structured care-plan review and clinician question prep |
| Clinical Trials | Trial matching and enrollment-fit guidance |
| DevOps | Deployments, health checks, and self-improvement pipeline |

10 automated cron jobs handle reminders, adherence checks, follow-ups, and platform health checks.

## Live API Integrations

- **NPI Registry (NPPES)** — Real-time provider search by city, ZIP, specialty, or name. Free CMS API, no key needed.
- **NPI Registry (Organizations)** — Natural-language pharmacy finder with location validation.
- **Base Account (`@base-org/account`)** — Server-side Base Pay status verification for payment settlement controls.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## End-to-End Testing (Playwright)

```bash
npx playwright install chromium
npm run test:e2e
```

Useful variants:

```bash
npm run test:e2e:headed
npm run test:e2e:ui
```

Included E2E coverage:

- Codebase visualizer map flow, interactive node inspection, exports, Ask Mapper, and Improve Diagram
- Provider search regression checks for `hillsboro internal medicine provider`, `hillsboro`, and `97123`

## OpenClaw Gateway (optional)

To connect the live AI gateway:

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

Create `.env.local`:

```env
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-token-here
```

The app detects gateway availability automatically and reports live/offline status in the UI.

## Production Environment Requirements

Set these for production deployments:

```env
# Required for live AI responses
OPENAI_API_KEY=...

# Required for durable, compliance-oriented file persistence
OPENRX_APPLICATIONS_PATH=/secure/path/openrx-applications.json
OPENRX_LEDGER_PATH=/secure/path/openrx-ledger.json

# Required for email-first admin approval workflow
OPENRX_ADMIN_EMAILS=admin1@company.com,admin2@company.com
OPENRX_ADMIN_REVIEW_SECRET=long-random-secret
RESEND_API_KEY=...
OPENRX_EMAIL_FROM=OpenRx <no-reply@yourdomain.com>

# Optional admin API hardening (for /api/admin/* read/update endpoints)
OPENRX_ADMIN_API_KEY=...
```

Optional live pricing integration:

```env
OPENRX_DRUG_PRICE_PROVIDER_URL=https://your-pricing-provider.example/api/prices
OPENRX_DRUG_PRICE_PROVIDER_KEY=...
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS with custom design system
- **Charts:** Recharts
- **Icons:** Lucide React
- **AI Gateway:** OpenClaw
- **APIs:** NPPES NPI Registry (free, no key)
- **Deployment:** Vercel

## Project Structure

```
app/
├── (app)/            # Authenticated layout (sidebar + topbar + agent bar)
│   ├── dashboard/    # Metrics, schedule, chart, agent activity feed
│   ├── patients/     # Patient list + [id] detail pages
│   ├── scheduling/   # Appointment management
│   ├── billing/      # Claims and billing
│   ├── prescriptions/
│   ├── prior-auth/
│   ├── providers/    # Live NPI provider search
│   ├── pharmacy/     # Natural-language pharmacy finder
│   ├── screening/    # Screening intake, safety-ranked recommendations, and next-step requests
│   ├── join-network/ # Provider/caregiver onboarding
│   ├── admin-review/ # Admin queue + release actions
│   ├── second-opinion/
│   ├── clinical-trials/
│   ├── compliance-ledger/
│   ├── messages/     # Multi-channel messaging
│   └── chat/         # AI agent interface
├── api/
│   ├── openclaw/     # Chat, status, webhook routes
│   ├── providers/    # NPI provider search proxy
│   ├── pharmacy/     # NPI pharmacy search proxy
│   ├── admin/        # Network application and notification review APIs
│   ├── screening/    # Screening assessment, next-step requests, and nearby care routing
│   └── payments/     # Intents, verify, refunds, receipts, attestations, ledger
├── page.tsx          # Landing page
└── layout.tsx        # Root layout (fonts, metadata, SEO)
components/
├── layout/           # Sidebar, topbar, agent bar
├── dashboard/        # Revenue chart
└── ai-action.tsx     # Reusable AI action button (3 variants)
lib/
├── openclaw/         # Gateway client + 12-agent configuration
├── basehealth.ts     # Screening, second-opinion, and trial matching logic
├── payments-ledger.ts # Compliance ledger and Base Pay verification workflow
├── live-data.server.ts # Wallet-linked patient snapshot mapping from Prisma
└── utils.ts          # Formatting utilities
```

## License

MIT
