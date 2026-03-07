# AI Care Team Command Center (OpenRx)

## 1) Component Architecture Diagram

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                       /dashboard/care-team (UI)                           │
│                                                                            │
│  ┌───────────────────────────┐    ┌─────────────────────────────────────┐  │
│  │ Agent Sidebar (vertical)  │    │ Main Workspace                      │  │
│  │ - 9 core OpenClaw agents  │    │ - Split Pane A: Agent Log/Chat     │  │
│  │ - Custom agents           │    │ - Split Pane B: Viewer + Browser   │  │
│  │ - Drag reorder            │    │ - Red needs-input banner            │  │
│  │ - Status badges           │    │ - Approve/Reject/Edit actions       │  │
│  │ - Blue glow on needs input│    │ - Modal with full context           │  │
│  └──────────────┬────────────┘    └───────────────────┬─────────────────┘  │
│                 │                                      │                    │
└─────────────────┼──────────────────────────────────────┼────────────────────┘
                  │                                      │
                  ▼                                      ▼
      useCareTeamCommandCenter()                useCareTeamSession()
                  │                                      │
                  ├──────────── SSE ─────────────────────┤
                  │       /api/agent-notify/stream       │
                  │
                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           Command Center API                               │
│                                                                            │
│  POST /api/agent-notify            (agent status + needs_input signal)    │
│  POST /api/agent-notify/resolve    (human approve/reject/edit)            │
│  GET  /api/agent-notify            (snapshot)                              │
│  GET  /api/agent-notify/fallback   (poll fallback + badge counts)         │
│  GET  /api/agent-notify/session    (RBAC session + visibility)            │
│  POST /api/agent-notify/agents     (custom agents)                         │
│  POST /api/agent-notify/demo       (60s demo trigger)                      │
│  GET  /api/agent-notify/openapi    (contract snippet)                      │
└────────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  lib/care-team/store.ts (durable + audit)                 │
│  - Hashed references only (patient/claim/record/doc)                      │
│  - Immutable audit append log                                              │
│  - Rate limiting buckets                                                   │
│  - Core + custom agent registry                                            │
│  - Status recomputation (running/paused/needs_input)                      │
└────────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
        lib/care-team/realtime.ts (in-process event bus)
```

## 2) Folder Structure Changes

```text
app/
  (app)/
    dashboard/
      care-team/
        page.tsx
  api/
    agent-notify/
      route.ts
      agents/route.ts
      demo/route.ts
      fallback/route.ts
      openapi/route.ts
      resolve/route.ts
      session/route.ts
      stream/route.ts

components/
  care-team/
    care-team-command-center.tsx
    request-review-modal.tsx
    resizable-split.tsx

lib/
  care-team/
    constants.ts
    realtime.ts
    security.ts
    store.ts
    types.ts
  hooks/
    use-care-team-command-center.ts
    use-care-team-session.ts
  clinic-auth.ts
  openclaw/
    human-input-protocol.ts

docs/
  ai-care-team-command-center.md
```

## 3) Security & HIPAA Checklist

- [x] Role-based access gate for command center APIs (`admin`, `staff`, `service`) via `lib/clinic-auth.ts`.
- [x] Unauthorized users receive no care-team payloads.
- [x] Notification context stores hashed references only (`patient_id_hash`, `claim_id_hash`, etc.).
- [x] PHI-like strings are redacted/sanitized before storage in audit context.
- [x] Immutable audit trail is append-only (`care_team.request_*`, `care_team.agent_status`).
- [x] All approvals/rejections/edits are timestamped with actor role + hashed actor id.
- [x] Optional AES-256-GCM encryption at rest for context using `OPENRX_CARE_TEAM_ENCRYPTION_KEY`.
- [x] Production durability guard: `OPENRX_CARE_TEAM_STORE_PATH` required.
- [x] Rate limiting enforced on inbound notify endpoint.
- [x] Embedded browser iframe uses sandbox + no-referrer policy.

Recommended production hardening (next step):
- [ ] Back store and audit by Postgres with row-level security.
- [ ] Replace in-process event bus with Supabase Realtime/Pusher fanout.
- [ ] Enforce signed service JWT for OpenClaw agent notifications.
- [ ] Add KMS-backed key rotation for `OPENRX_CARE_TEAM_ENCRYPTION_KEY`.

## 4) OpenClaw Agent ↔ UI Signaling API Contract

### POST `/api/agent-notify`

```json
{
  "agent_id": "rex-prior-auth-42",
  "agent_name": "Rex Prior Auth",
  "status": "needs_input",
  "context": {
    "patient_id_hash": "...",
    "reason": "Prior auth denial - needs MD review",
    "suggested_action": "Approve expedited appeal",
    "document_snapshot_hash": "...",
    "workflow": "prior_auth",
    "confidence_score": 0.82,
    "browser_url": "https://payer-portal.example.com/case/123"
  },
  "timestamp": "2026-02-26T00:00:00.000Z"
}
```

Response (`201` for `needs_input`):

```json
{
  "request": {
    "id": "hitl_xxx",
    "agentId": "rex-prior-auth-42",
    "status": "needs_input"
  },
  "agent": {
    "id": "rex-prior-auth-42",
    "status": "needs_input"
  },
  "event": {
    "type": "request_created"
  }
}
```

### POST `/api/agent-notify/resolve`

```json
{
  "requestId": "hitl_xxx",
  "decision": "approve",
  "note": "Reviewed by clinician"
}
```

Supported `decision`: `approve | reject | edit`.

### SSE `/api/agent-notify/stream`

- Event name: `care_team`
- Bootstrap payload: `{ "type": "bootstrap", "snapshot": { ... } }`
- Incremental events: `request_created | request_resolved | agent_status`

### REST fallback `/api/agent-notify/fallback`

- Returns `needsInputCount`, current open requests, and optionally a specific request by `requestId`.

### Agent protocol helper (OpenClaw)

- Tool schema + helper functions located in:
  - `lib/openclaw/human-input-protocol.ts`
- Includes:
  - `REQUEST_HUMAN_INPUT_TOOL_SCHEMA`
  - `requestHumanInput(...)`
  - `awaitHumanDecision(...)`
  - safety guardrails (`requiresHumanApproval`, `assertHumanDecision`)

