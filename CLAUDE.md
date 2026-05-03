# OpenRx — AI Healthcare Platform

OpenRx is a **Next.js 14 healthcare clinic management platform** powered by **OpenClaw**, a multi-agent orchestration system. Twelve autonomous AI agents collaborate to handle every aspect of patient care, from onboarding to billing to clinical trials.

## Tech Stack

- **Framework**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **AI**: Anthropic Claude (primary), OpenAI GPT-4o-mini (fallback)
- **Database**: PostgreSQL via Prisma ORM
- **Payments**: Coinbase Base / USDC (wagmi + onchainkit)
- **Testing**: Playwright (E2E)

## The 12 OpenClaw Agents

All agents are configured in `lib/openclaw/config.ts`. Each has a unique system prompt, personality, inter-agent messaging permissions, and tool profile.

| ID | Name | Role | Can Message |
|----|------|------|-------------|
| `coordinator` | Atlas | Routes all messages, air traffic control | `*` (all agents) |
| `onboarding` | Sage | New patient setup, frictionless intake | rx, scheduling, wellness, billing, coordinator |
| `triage` | Nova | After-hours symptom assessment, urgency classification | scheduling, rx, coordinator |
| `scheduling` | Cal | Insurance-aware appointment booking | billing, coordinator, wellness |
| `billing` | Vera | Claims analysis, error detection, appeals | rx, prior-auth, coordinator |
| `rx` | Maya | Medication reconciliation, adherence, pharmacy | scheduling, prior-auth, billing, coordinator |
| `prior-auth` | Rex | Prior authorization workflows, submissions to appeals | billing, coordinator, scheduling |
| `wellness` | Ivy | Preventive care, USPSTF screenings, health goals | scheduling, rx, coordinator, onboarding |
| `screening` | Quinn | Risk stratification, preventive screening priorities | triage, scheduling, wellness, coordinator, trials |
| `second-opinion` | Orion | Diagnosis and care-plan review | triage, wellness, scheduling, coordinator, screening |
| `trials` | Lyra | Clinical trial discovery and enrollment fit | coordinator, screening, wellness, billing, scheduling |
| `devops` | Bolt | Builds, deployments, monitoring, self-improvement | coordinator |

### Agent Architecture (lib/openclaw/)

```
lib/openclaw/
├── config.ts           # Agent definitions, system prompts, cron jobs, webhooks
├── orchestrator.ts     # Message bus, collaboration sessions, task delegation, keyword routing
├── router.ts           # LLM-based semantic routing (Claude Haiku fallback to keywords)
├── client.ts           # HTTP gateway client (ws://127.0.0.1:18789)
├── self-improve.ts     # Agent-driven improvement pipeline with collaborative voting
└── human-input-protocol.ts  # Human-in-the-loop approval for high-stakes actions
```

### Core AI Engine (lib/ai-engine.ts)

- `runAgent(params)` — Execute a single agent with patient context injection
- `runParallelExperts(params)` — MoE-style fan-out to multiple agents simultaneously (GQA cache)
- `runCoordinator(message, sessionId?, walletAddress?)` — Route via Atlas, auto-handoff to specialist

**Extended thinking** is enabled for high-stakes agents: `prior-auth`, `second-opinion`, `triage`.

**GQA-inspired caching**: Patient context is fetched once and shared across all parallel expert calls (30s TTL).

## API Endpoints

### OpenClaw Agent APIs (`app/api/openclaw/`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/openclaw/chat` | Send `{ agentId, message, sessionId?, walletAddress? }` to a specific agent |
| GET | `/api/openclaw/orchestrator` | Get collaboration map (sessions, tasks, agent statuses) |
| POST | `/api/openclaw/orchestrator` | Trigger multi-agent workflow `{ message, sessionId? }` |
| GET | `/api/openclaw/status` | Gateway health + recent agent actions |
| POST | `/api/openclaw/experts` | Fan-out to experts `{ expertIds[], message, sessionId?, walletAddress? }` |
| GET | `/api/openclaw/improvements` | Self-improvement pipeline metrics |
| POST | `/api/openclaw/actions` | Trigger specific agent actions |

### Care Team Command Center (`app/api/agent-notify/`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/agent-notify` | Agent posts `needs_input` human approval request |
| POST | `/api/agent-notify/resolve` | Human approves/rejects agent action |
| GET | `/api/agent-notify` | Snapshot of pending human-input requests |
| GET | `/api/agent-notify/stream` | SSE stream for real-time care team updates |

### External APIs

| Path | Description |
|------|-------------|
| `/api/providers` | NPPES NPI registry search (free, no auth) |
| `/api/pharmacy` | Pharmacy NPI search by name/location |
| `/api/payments/*` | USDC payment intents, verify, refunds, receipts |
| `/api/screening` | Free screening preview, optional advanced review payment, and trackable next-step requests |

## Cron Jobs (10 automated jobs)

Defined in `OPENCLAW_CONFIG.cronJobs`:
- `appointment-reminders` — Daily 8AM, Cal sends tomorrow's reminders
- `adherence-check` — Mon/Thu 10AM, Maya checks prescription adherence
- `claim-followup` — Weekdays 9AM, Vera follows up on pending claims
- `pa-status-check` — Weekdays 2PM, Rex checks PA status updates
- `no-show-followup` — Weekdays 5PM, Cal contacts no-shows
- `refill-reminders` — Daily 9AM, Maya alerts patients with <7-day supply
- `screening-reminders` — Monday 8AM, Ivy checks due screenings
- `daily-health-check` — Daily 6AM, Bolt pings all routes
- `daily-deploy` — Daily 2AM, Bolt deploys pending changes
- `security-audit` — Weekly Monday 7AM, Bolt runs CVE/dependency audit

## Database Schema (prisma/schema.prisma)

Key models: `User`, `PatientProfile`, `DoctorProfile`, `Appointment`, `Prescription`, `Message`, `Payment`, `LabResult`, `VitalSign`, `MedicalRecord`, `AuditLog`

Roles: `PATIENT`, `DOCTOR`, `ADMIN`, `PHARMACIST`

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...

# Optional AI model overrides
OPENRX_MAPPER_MODEL=claude-sonnet-4-6

# Blockchain/Payments
NEXT_PUBLIC_ONCHAINKIT_API_KEY=...
NEXT_PUBLIC_DEVELOPER_WALLET=0x...
OPENRX_TREASURY_WALLET=0x...
OPENRX_SCREENING_FEE_USDC=5.00

# OpenClaw gateway (optional external)
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=...
OPENCLAW_QUALITY_MODE=strict

# Care team
OPENRX_CARE_TEAM_STORE_PATH=/path/to/store
OPENRX_CARE_TEAM_ENCRYPTION_KEY=...

# Admin
OPENRX_ADMIN_API_KEY=...
OPENRX_ADMIN_EMAILS=admin@example.com
OPENRX_TRUST_ROLE_HEADER=false
```

## Quality Guardrails (Applied to All Agents)

All agents have these mandatory rules injected:
- Ask one clear question at a time when patient context is incomplete
- Never fabricate availability, network status, pricing, or clinical certainty
- Require explicit human confirmation for high-stakes actions (billing changes, prescriptions, PA submissions)
- If uncertain, say what is missing and propose the fastest safe next step
- Keep responses concise, plain-language, and actionable for non-technical patients

## Human-in-the-Loop Protocol

When agents need human approval: `lib/openclaw/human-input-protocol.ts`
- Agents call `requestHumanInput()` to pause and post to `/api/agent-notify`
- Care Team Command Center (`app/(app)/care-team/`) shows pending requests
- Clinician approve/reject/edit → agent resumes
- All decisions are immutably logged with hash references

## Self-Improvement Engine

`lib/openclaw/self-improve.ts` — Agents autonomously suggest improvements:
- Any agent can submit a suggestion with priority and category
- 3+ agent votes = auto-approved and queued for deployment
- Bolt deploys approved improvements at 2AM UTC

## MCP Integration (scripts/mcp-openclaw.ts)

An MCP server wraps the OpenClaw API for direct Claude Code tool access:
- `openclaw_chat` — Chat with any of the 12 agents
- `openclaw_route` — Route a message via the orchestrator (Atlas)
- `openclaw_experts` — Fan-out to multiple agents in parallel
- `openclaw_status` — Get gateway health and recent agent actions
- `openclaw_orchestrator` — Get collaboration sessions, tasks, agent statuses
- `openclaw_improvements` — Get self-improvement pipeline metrics

Start the dev server first: `npm run dev`, then the MCP server connects to `http://localhost:3000`.

## Common Development Patterns

### Adding a new agent

1. Add system prompt constant in `lib/openclaw/config.ts`
2. Add agent entry to `OPENCLAW_CONFIG.agents[]` with `id`, `name`, `role`, `systemPrompt`, `tools`, `canMessage`
3. Update `AgentId` type (auto-derived from config)
4. Add routing rules to `routeUserMessage()` in `lib/openclaw/orchestrator.ts`
5. Add to `router.ts` LLM routing prompt if needed

### Modifying agent behavior

- System prompts: `lib/openclaw/config.ts` — the `*_PROMPT` constants
- Routing rules: `lib/openclaw/orchestrator.ts` — `routeUserMessage()` keyword rules
- LLM routing: `lib/openclaw/router.ts` — update the agent list in the prompt

### Adding a new API route

Standard Next.js App Router pattern: `app/api/<route>/route.ts`
- Import agents from `lib/openclaw/config.ts`
- Use `runAgent()` or `runParallelExperts()` from `lib/ai-engine.ts`

### Database changes

Edit `prisma/schema.prisma` → run `npx prisma migrate dev` → update types
