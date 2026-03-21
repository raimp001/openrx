#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_dir="${1:-$HOME/tao-trader}"

mkdir -p "$target_dir"

rsync -a --delete \
  --exclude '.git/' \
  --exclude '__pycache__/' \
  --exclude '.pytest_cache/' \
  --exclude 'output/' \
  --exclude 'runtime/' \
  --exclude 'notes/' \
  --exclude '*.pyc' \
  --exclude '.DS_Store' \
  "$repo_root/" "$target_dir/"

mkdir -p "$target_dir/runtime"
touch "$target_dir/runtime/.gitkeep"

if [[ ! -d "$target_dir/.git" ]]; then
  git -C "$target_dir" init -b main >/dev/null 2>&1
fi

perl -0pi -e 's/^# Founder Researcher$/# TAO Trader/m' "$target_dir/README.md"
perl -0pi -e 's/Local founder and company research workflow inspired by \[karpathy\/autoresearch\]\(https:\/\/github\.com\/karpathy\/autoresearch\)\./Standalone TAO trading and research app, including the TAO swing bot, autopilot loop, exchange adapters, and the local autoresearch pack./' "$target_dir/README.md"
perl -0pi -e 's/python -m researcher/python -m tao_trader/g' "$target_dir/README.md"
perl -0pi -e 's/`researcher`/`tao-trader`/g' "$target_dir/README.md"
perl -0pi -e 's/name = "founder-researcher"/name = "tao-trader"/' "$target_dir/pyproject.toml"
perl -0pi -e 's/description = ".*?"/description = "Standalone TAO trading and research app."/' "$target_dir/pyproject.toml"
perl -0pi -e 's/^researcher = "researcher\.cli:main"\n//m' "$target_dir/pyproject.toml"

printf '%s\n' "Exported standalone app to $target_dir"
