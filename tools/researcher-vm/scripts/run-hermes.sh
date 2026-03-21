#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_root="${APP_ROOT:-$repo_root}"
hermes_bin="${HERMES_BIN:-$HOME/.local/bin/hermes}"

if [[ ! -x "$hermes_bin" ]]; then
  printf '%s\n' "Hermes binary not found at $hermes_bin" >&2
  exit 1
fi

export PATH="$(dirname "$hermes_bin"):$PATH"
cd "$app_root"
exec "$hermes_bin" "$@"
