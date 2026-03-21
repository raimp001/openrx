#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! git -C "$repo_root" rev-parse --git-dir >/dev/null 2>&1; then
  printf '%s\n' "Not inside a git repository: $repo_root" >&2
  exit 1
fi

chmod +x "$repo_root/.githooks/pre-commit"
git -C "$repo_root" config core.hooksPath .githooks

printf '%s\n' "Installed repo hooks from $repo_root/.githooks"
