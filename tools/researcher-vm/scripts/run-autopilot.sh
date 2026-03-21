#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_root="${APP_ROOT:-$repo_root}"
python_bin="${PYTHON_BIN:-python3}"
default_secret_config="$HOME/.config/researcher/live.env"
secret_config="${TAO_TRADER_SECRET_CONFIG:-${RESEARCHER_SECRET_CONFIG:-$default_secret_config}}"
mode="${TAO_MODE:-paper}"
exchange="${TAO_EXCHANGE:-auto}"
config_path="${TAO_CONFIG:-$app_root/data/tao_bot.json}"
runtime_db="${TAO_RUNTIME_DB:-$app_root/runtime/tao_bot_${mode}.db}"
output_dir="${TAO_OUTPUT_DIR:-$app_root/output/tao_bot}"
heartbeat_db="${TAO_HEARTBEAT_DB:-$app_root/runtime/tao_autopilot.db}"
loop_journal_db="${TAO_LOOP_JOURNAL_DB:-$app_root/runtime/tao_autopilot.db}"
improvement_state="${TAO_IMPROVEMENT_STATE:-$app_root/runtime/tao_improvement.db}"
interval_seconds="${TAO_INTERVAL_SECONDS:-900}"
pending_interval_seconds="${TAO_PENDING_INTERVAL_SECONDS:-60}"
research_dataset="${TAO_RESEARCH_DATASET:-$app_root/tao_autoresearch/data/kraken_tao_usd.json}"
research_output_dir="${TAO_RESEARCH_OUTPUT_DIR:-$app_root/tao_autoresearch/runs}"
research_budget_seconds="${TAO_RESEARCH_BUDGET_SECONDS:-300}"
research_max_candidates="${TAO_RESEARCH_MAX_CANDIDATES:-128}"
research_seed="${TAO_RESEARCH_SEED:-1337}"
research_every="${TAO_RESEARCH_EVERY:-12}"
iterations="${TAO_ITERATIONS:-}"
live_ack="${LIVE_ACK:-}"
enable_research="${TAO_ENABLE_RESEARCH:-0}"

is_truthy() {
  case "${1:-0}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

load_secret_config() {
  if [[ -f "$secret_config" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$secret_config"
    set +a
  fi
  export RESEARCHER_SECRET_CONFIG="$secret_config"
  export TAO_TRADER_SECRET_CONFIG="$secret_config"
}

validate_file_backed_secret() {
  local name="$1"
  local file_var="${name}_FILE"
  local inline_value="${!name-}"
  local file_path="${!file_var-}"

  if [[ -n "$inline_value" ]]; then
    printf '%s\n' "Refusing inline $name in autopilot mode. Use $file_var pointing to a file outside the repo." >&2
    exit 1
  fi
  if [[ -z "$file_path" ]]; then
    printf '%s\n' "Missing required $file_var for TAO_MODE=$mode." >&2
    exit 1
  fi
  if [[ ! -f "$file_path" ]]; then
    printf '%s\n' "Missing secret file for $file_var: $file_path" >&2
    exit 1
  fi

  local resolved_file
  resolved_file="$(cd "$(dirname "$file_path")" && pwd -P)/$(basename "$file_path")"
  case "$resolved_file" in
    "$repo_root"/*|"$app_root"/*)
      printf '%s\n' "Refusing secret file inside the repo tree for $file_var: $resolved_file" >&2
      exit 1
      ;;
  esac
}

validate_live_mode() {
  if [[ ! -f "$secret_config" ]]; then
    printf '%s\n' "Missing secret config: $secret_config" >&2
    printf '%s\n' "Copy config/local_secrets.example.env to an external path and set RESEARCHER_SECRET_CONFIG." >&2
    exit 1
  fi

  local resolved_secret_config
  resolved_secret_config="$(cd "$(dirname "$secret_config")" && pwd -P)/$(basename "$secret_config")"
  case "$resolved_secret_config" in
    "$repo_root"/*|"$app_root"/*)
      printf '%s\n' "Refusing to use a live secret config stored inside the repo tree." >&2
      exit 1
      ;;
  esac

  case "$exchange" in
    kraken)
      validate_file_backed_secret "KRAKEN_API_KEY"
      validate_file_backed_secret "KRAKEN_API_SECRET"
      ;;
    coinbase)
      validate_file_backed_secret "COINBASE_API_KEY_NAME"
      validate_file_backed_secret "COINBASE_API_PRIVATE_KEY"
      ;;
    auto)
      validate_file_backed_secret "KRAKEN_API_KEY"
      validate_file_backed_secret "KRAKEN_API_SECRET"
      validate_file_backed_secret "COINBASE_API_KEY_NAME"
      validate_file_backed_secret "COINBASE_API_PRIVATE_KEY"
      ;;
    *)
      printf '%s\n' "Unsupported TAO_EXCHANGE for live mode: $exchange" >&2
      exit 1
      ;;
  esac

  if [[ -n "${TELEGRAM_BOT_TOKEN-}${TELEGRAM_BOT_TOKEN_FILE-}${TELEGRAM_CHAT_ID-}${TELEGRAM_CHAT_ID_FILE-}" ]]; then
    validate_file_backed_secret "TELEGRAM_BOT_TOKEN"
    validate_file_backed_secret "TELEGRAM_CHAT_ID"
  fi

  if [[ "$live_ack" != "I_ACCEPT_REAL_TRADES" ]]; then
    printf '%s\n' "Set LIVE_ACK=I_ACCEPT_REAL_TRADES to confirm real live trading." >&2
    exit 1
  fi

  export RESEARCHER_ENABLE_LIVE_TRADING=1
  export COINBASE_ENABLE_LIVE_TRADING=1
  export KRAKEN_ENABLE_LIVE_TRADING=1
}

load_secret_config

mkdir -p \
  "$(dirname "$runtime_db")" \
  "$(dirname "$output_dir")" \
  "$(dirname "$heartbeat_db")" \
  "$(dirname "$loop_journal_db")" \
  "$research_output_dir"

if [[ "$mode" == "live" ]]; then
  validate_live_mode
fi

args=(
  -m tao_trader
  tao-autopilot
  --config "$config_path"
  --exchange "$exchange"
  --mode "$mode"
  --output-dir "$output_dir"
  --runtime-db "$runtime_db"
  --improvement-state "$improvement_state"
  --heartbeat "$heartbeat_db"
  --loop-journal "$loop_journal_db"
  --interval-seconds "$interval_seconds"
  --pending-interval-seconds "$pending_interval_seconds"
  --research-dataset "$research_dataset"
  --research-output-dir "$research_output_dir"
  --research-budget-seconds "$research_budget_seconds"
  --research-max-candidates "$research_max_candidates"
  --research-seed "$research_seed"
  --research-every "$research_every"
)

if [[ -n "$iterations" ]]; then
  args+=(--iterations "$iterations")
fi
if [[ "$mode" == "live" ]]; then
  args+=(--live-ack "$live_ack")
fi
if is_truthy "$enable_research"; then
  args+=(--enable-research)
fi

cd "$app_root"
exec "$python_bin" "${args[@]}" "$@"
