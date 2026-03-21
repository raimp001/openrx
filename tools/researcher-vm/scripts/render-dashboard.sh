#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_root="${APP_ROOT:-$repo_root}"
python_bin="${PYTHON_BIN:-python3}"
mode="${TAO_MODE:-paper}"
runtime_db="${TAO_RUNTIME_DB:-$app_root/runtime/tao_bot_${mode}.db}"
autopilot_db="${TAO_HEARTBEAT_DB:-$app_root/runtime/tao_autopilot.db}"
backtest_report="${TAO_BACKTEST_REPORT:-$app_root/output/tao_backtest/tao_backtest.json}"
dashboard_output="${TAO_DASHBOARD_OUTPUT:-$app_root/output/tao_dashboard/index.html}"

mkdir -p "$(dirname "$dashboard_output")"

cd "$app_root"
exec "$python_bin" -m tao_trader tao-dashboard \
  --mode "$mode" \
  --runtime-db "$runtime_db" \
  --autopilot-db "$autopilot_db" \
  --backtest-report "$backtest_report" \
  --output "$dashboard_output" \
  "$@"
