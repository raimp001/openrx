#!/usr/bin/env bash
set -euo pipefail
umask 077

job_id="${1:-${OPENRX_CRON_JOB_ID:-}}"
base_url="${OPENRX_BASE_URL:-}"
admin_key="${OPENRX_ADMIN_API_KEY:-}"
agent_token="${OPENRX_AGENT_NOTIFY_TOKEN:-}"
message="${OPENRX_CRON_MESSAGE:-}"
wallet_address="${OPENRX_WALLET_ADDRESS:-}"
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
  python3 - "$message" "$wallet_address" "$session_id" <<'PY'
import json
import sys

message, wallet_address, session_id = sys.argv[1:4]
body = {"sessionId": session_id}
if message:
    body["message"] = message
if wallet_address:
    body["walletAddress"] = wallet_address
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
