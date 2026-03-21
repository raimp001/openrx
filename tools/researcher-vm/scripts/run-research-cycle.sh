#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_root="${APP_ROOT:-$repo_root}"
python_bin="${PYTHON_BIN:-python3}"
data_dir="${TAO_AUTORESEARCH_DATA_DIR:-$app_root/tao_autoresearch/data}"
dataset_path="${TAO_RESEARCH_DATASET:-$data_dir/kraken_tao_usd.json}"
output_dir="${TAO_RESEARCH_OUTPUT_DIR:-$app_root/tao_autoresearch/runs}"
budget_seconds="${TAO_RESEARCH_BUDGET_SECONDS:-300}"
max_candidates="${TAO_RESEARCH_MAX_CANDIDATES:-128}"
seed="${TAO_RESEARCH_SEED:-1337}"
improvement_state="${TAO_IMPROVEMENT_STATE:-$app_root/runtime/tao_improvement.db}"
improvement_report="${TAO_IMPROVEMENT_REPORT:-$app_root/output/tao_improvement/latest.json}"
improvement_output_dir="${TAO_IMPROVEMENT_OUTPUT_DIR:-$app_root/output/tao_improvement}"
min_objective_delta="${TAO_IMPROVEMENT_MIN_OBJECTIVE_DELTA:-0.75}"
min_return_pct="${TAO_IMPROVEMENT_MIN_RETURN_PCT:-0.5}"
min_trades="${TAO_IMPROVEMENT_MIN_TRADES:-10}"
max_drawdown_pct="${TAO_IMPROVEMENT_MAX_DRAWDOWN_PCT:-8.0}"
max_drawdown_regression_pct="${TAO_IMPROVEMENT_MAX_DRAWDOWN_REGRESSION_PCT:-1.0}"

mkdir -p "$data_dir" "$output_dir" "$improvement_output_dir" "$(dirname "$improvement_state")" "$(dirname "$improvement_report")"

cd "$app_root/tao_autoresearch"
"$python_bin" prepare.py --output-dir "$data_dir"

cd "$app_root"
exec "$python_bin" -m tao_trader tao-improve \
  --config "$app_root/data/tao_bot.json" \
  --dataset "$dataset_path" \
  --output-dir "$improvement_output_dir" \
  --report "$improvement_report" \
  --state "$improvement_state" \
  --budget-seconds "$budget_seconds" \
  --max-candidates "$max_candidates" \
  --seed "$seed" \
  --min-objective-delta "$min_objective_delta" \
  --min-return-pct "$min_return_pct" \
  --min-trades "$min_trades" \
  --max-drawdown-pct "$max_drawdown_pct" \
  --max-drawdown-regression-pct "$max_drawdown_regression_pct" \
  "$@"
