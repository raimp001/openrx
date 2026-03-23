# Background agents & AWS (OpenClaw / OpenRx)

OpenRx’s OpenClaw agents run inside the Next.js app via `runAgent` / `runCoordinator` in [`/Users/shardingdog/openrx/lib/ai-engine.ts`](/Users/shardingdog/openrx/lib/ai-engine.ts). Cron-style jobs are declared in [`/Users/shardingdog/openrx/lib/openclaw/config.ts`](/Users/shardingdog/openrx/lib/openclaw/config.ts) under `OPENCLAW_CONFIG.cronJobs`.

If you want agents to keep working while your laptop sleeps, the correct shape is:

1. Keep the patient-facing app on Vercel.
2. Run an external worker or VM on AWS.
3. Let that worker call narrow OpenRx HTTPS endpoints.
4. Keep secrets in AWS Secrets Manager or SSM, not in the repo.

This repo now includes a dedicated background-dispatch endpoint for that purpose:

- `POST /api/openclaw/cron/[jobId]`
- `GET /api/openclaw/cron?dueOnly=true&at=<iso-minute>`

The endpoint:

- validates the cron job against `OPENCLAW_CONFIG.cronJobs`
- requires `x-admin-api-key` or `Authorization: Bearer <OPENRX_AGENT_NOTIFY_TOKEN>` in production
- dispatches directly to the configured OpenClaw agent
- returns the agent response plus runtime metadata

## What “auto-research VM” should mean here

For OpenRx, an autoresearch or Hermes VM should not become a shadow backend. It should be an external worker that:

- runs long-lived planning or review loops
- calls the app through documented endpoints
- stays out of the patient request path
- never bypasses OpenRx auth, audit, or care-team guardrails

That keeps the system explainable and makes the risk surface smaller.

## Recommended AWS shapes

| Pattern | Best fit |
| --- | --- |
| ECS Fargate + EventBridge Scheduler | Repeatable background jobs with minimal ops |
| EC2 + systemd | Long-running Hermes/OpenClaw experiments, SSH access, custom sandboxes |
| Lambda + EventBridge | Short idempotent jobs only |

For OpenRx background agents, the practical defaults are:

- `Fargate` for scheduled production jobs
- `EC2` for exploratory Hermes/autoresearch loops

## Worker responsibilities

1. Poll for due jobs every minute.
2. Authenticate with `OPENRX_ADMIN_API_KEY` or `OPENRX_AGENT_NOTIFY_TOKEN`.
3. Call the narrow OpenRx endpoint, not the patient chat surface.
4. Log to CloudWatch.
5. Alert on non-2xx responses.
6. Avoid storing PHI on disk unless your HIPAA posture and BAA coverage explicitly allow it.

Example request:

```bash
curl -fsS -X POST "https://openrx.health/api/openclaw/cron/screening-reminders" \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: $OPENRX_ADMIN_API_KEY" \
  -d '{"sessionId":"cron-screening-reminders"}'
```

## Researcher VM location

The local autoresearch workspace now lives under:

- [`/Users/shardingdog/openrx/tools/researcher-vm`](/Users/shardingdog/openrx/tools/researcher-vm)

That workspace is intentionally isolated from the Next.js app. Use it as an auxiliary worker or experimentation kit, not as part of the request-response path for patients.

Useful entry points:

- [`/Users/shardingdog/openrx/tools/researcher-vm/scripts/run-openrx-cron.sh`](/Users/shardingdog/openrx/tools/researcher-vm/scripts/run-openrx-cron.sh)
- [`/Users/shardingdog/openrx/tools/researcher-vm/scripts/run-openrx-due-jobs.sh`](/Users/shardingdog/openrx/tools/researcher-vm/scripts/run-openrx-due-jobs.sh)
- [`/Users/shardingdog/openrx/tools/researcher-vm/deploy/env/openrx-research.example.env`](/Users/shardingdog/openrx/tools/researcher-vm/deploy/env/openrx-research.example.env)
- [`/Users/shardingdog/openrx/tools/researcher-vm/deploy/systemd/openrx-cron@.service`](/Users/shardingdog/openrx/tools/researcher-vm/deploy/systemd/openrx-cron@.service)
- [`/Users/shardingdog/openrx/tools/researcher-vm/deploy/systemd/openrx-scheduler.service`](/Users/shardingdog/openrx/tools/researcher-vm/deploy/systemd/openrx-scheduler.service)
- [`/Users/shardingdog/openrx/tools/researcher-vm/deploy/systemd/openrx-scheduler.timer`](/Users/shardingdog/openrx/tools/researcher-vm/deploy/systemd/openrx-scheduler.timer)

## Recommended cutover

1. Keep the current Vercel cron entries only as temporary fallback.
2. Install the scheduler timer on the AWS worker.
3. Confirm `/api/openclaw/status` shows the AWS worker and real cron runs.
4. Remove the Vercel cron entries after the AWS timer is stable.

## Guardrails

- Do not let the research VM mutate billing, prior auth, prescriptions, or appointments without explicit OpenRx-side auth and audit.
- Do not embed patient identifiers in research logs unless required and covered.
- Do not store exchange-style secrets or unrelated automation credentials on a healthcare worker.
- Keep production background jobs narrow, deterministic, and observable.

## Natural next hardening step

Persist orchestrator sessions and task history in Postgres instead of in-memory state so:

- `/api/openclaw/orchestrator` survives deploys
- background jobs can be audited across process restarts
- care-team dashboards show stable runtime history
