#!/usr/bin/env bash
set -euo pipefail
umask 077

base_url="${OPENRX_BASE_URL:-}"
admin_key="${OPENRX_ADMIN_API_KEY:-}"
agent_token="${OPENRX_AGENT_NOTIFY_TOKEN:-}"
worker_id="${OPENRX_WORKER_ID:-researcher-vm-prod-1}"
worker_type="${OPENRX_WORKER_TYPE:-aws-scheduler}"
triggered_at="${OPENRX_SCHEDULER_AT:-$(date -u +"%Y-%m-%dT%H:%M:00Z")}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "$base_url" ]]; then
  printf '%s\n' "OPENRX_BASE_URL is required." >&2
  exit 1
fi

if [[ -z "$admin_key" && -z "$agent_token" ]]; then
  printf '%s\n' "Set OPENRX_ADMIN_API_KEY or OPENRX_AGENT_NOTIFY_TOKEN." >&2
  exit 1
fi

auth_header=()
if [[ -n "$admin_key" ]]; then
  auth_header=(-H "x-admin-api-key: $admin_key")
else
  auth_header=(-H "Authorization: Bearer $agent_token")
fi

payload="$(
  curl -fsS \
    "${base_url%/}/api/openclaw/cron?dueOnly=true&at=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$triggered_at")" \
    "${auth_header[@]}"
)"

due_jobs=()
while IFS= read -r job_id; do
  [[ -n "$job_id" ]] && due_jobs+=("$job_id")
done < <(
  python3 - "$payload" <<'PY'
import json
import sys

data = json.loads(sys.argv[1])
for job in data.get("jobs", []):
    job_id = job.get("id")
    if job_id:
        print(job_id)
PY
)

heartbeat_payload="$(
  python3 - "$worker_id" "$worker_type" "$triggered_at" "${#due_jobs[@]}" <<'PY'
import json
import sys

worker_id, worker_type, triggered_at, due_count = sys.argv[1:5]
print(json.dumps({
    "workerId": worker_id,
    "workerType": worker_type,
    "status": "idle" if due_count == "0" else "running",
    "metadata": {
        "lastSchedulerAt": triggered_at,
        "dueJobCount": int(due_count),
    },
}))
PY
)"

curl -fsS -X POST \
  "${base_url%/}/api/openclaw/worker-heartbeat" \
  -H "Content-Type: application/json" \
  "${auth_header[@]}" \
  --data "$heartbeat_payload" >/dev/null

if [[ "${#due_jobs[@]}" -eq 0 ]]; then
  printf '%s\n' "No due OpenRx jobs at ${triggered_at}."
  exit 0
fi

for job_id in "${due_jobs[@]}"; do
  export OPENRX_CRON_TRIGGERED_AT="$triggered_at"
  export OPENRX_CRON_IDEMPOTENCY_KEY="${job_id}-$(date -u +"%Y%m%d%H%M")"
  export OPENRX_WORKER_ID="$worker_id"
  export OPENRX_WORKER_TYPE="$worker_type"
  unset OPENRX_CRON_JOB_ID
  unset OPENRX_CRON_MESSAGE
  unset OPENRX_WALLET_ADDRESS
  "$script_dir/run-openrx-cron.sh" "$job_id"
done
