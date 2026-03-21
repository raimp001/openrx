#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export APP_ROOT="${APP_ROOT:-$repo_root}"
export TAO_MODE="live"
exec "$repo_root/scripts/run-autopilot.sh" "$@"
