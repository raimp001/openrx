#!/usr/bin/env bash
set -euo pipefail
umask 077

job_id="${1:-${OPENRX_CRON_JOB_ID:-}}"
base_url="${OPENRX_BASE_URL:-}"
admin_key="${OPENRX_ADMIN_API_KEY:-}"
agent_token="${OPENRX_AGENT_NOTIFY_TOKEN:-}"
worker_id="${OPENRX_WORKER_ID:-}"
worker_type="${OPENRX_WORKER_TYPE:-researcher-vm}"
message="${OPENRX_CRON_MESSAGE:-}"
wallet_address="${OPENRX_WALLET_ADDRESS:-}"
triggered_at="${OPENRX_CRON_TRIGGERED_AT:-}"
idempotency_key="${OPENRX_CRON_IDEMPOTENCY_KEY:-}"
session_id="cron-${job_id:-job}-$(date +%s)"

if [[ -z "$job_id" ]]; then
  printf '%s\n' "Set OPENRX_CRON_JOB_ID or pass a job id as the first argument." >&2
  exit 1
fi

if [[ -z "$base_url" ]]; then
  printf '%s\n' "OPENRX_BASE_URL is required." >&2
  exit 1
fi

if [[ -z "$admin_key" && -z "$agent_token" ]]; then
  printf '%s\n' "Set OPENRX_ADMIN_API_KEY or OPENRX_AGENT_NOTIFY_TOKEN." >&2
  exit 1
fi

payload="$(
  python3 - "$message" "$wallet_address" "$session_id" "$triggered_at" "$idempotency_key" <<'PY'
import json
import sys

message, wallet_address, session_id, triggered_at, idempotency_key = sys.argv[1:6]
body = {"sessionId": session_id}
if message:
    body["message"] = message
if wallet_address:
    body["walletAddress"] = wallet_address
if triggered_at:
    body["triggeredAt"] = triggered_at
if idempotency_key:
    body["idempotencyKey"] = idempotency_key
print(json.dumps(body))
PY
)"

auth_header=()
if [[ -n "$admin_key" ]]; then
  auth_header=(-H "x-admin-api-key: $admin_key")
else
  auth_header=(-H "Authorization: Bearer $agent_token")
fi

curl -fsS -X POST \
  "${base_url%/}/api/openclaw/cron/${job_id}" \
  -H "Content-Type: application/json" \
  "${auth_header[@]}" \
  --data "$payload"

if [[ -n "$worker_id" ]]; then
  heartbeat_payload="$(
    python3 - "$worker_id" "$worker_type" "$job_id" <<'PY'
import json
import sys

worker_id, worker_type, job_id = sys.argv[1:4]
print(json.dumps({
    "workerId": worker_id,
    "workerType": worker_type,
    "status": "running",
    "metadata": {
        "lastJobId": job_id,
    },
}))
PY
)"

  curl -fsS -X POST \
    "${base_url%/}/api/openclaw/worker-heartbeat" \
    -H "Content-Type: application/json" \
    "${auth_header[@]}" \
    --data "$heartbeat_payload" >/dev/null
fi
