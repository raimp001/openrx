#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_url="${NANOCHAT_REPO_URL:-https://github.com/karpathy/nanochat.git}"
nanochat_root="${NANOCHAT_ROOT:-$HOME/nanochat}"
branch="${NANOCHAT_BRANCH:-}"
sync_env="${NANOCHAT_SYNC:-0}"
uv_bin="${UV_BIN:-$HOME/.local/bin/uv}"

resolve_branch() {
  if [[ -n "$branch" ]]; then
    printf '%s\n' "$branch"
    return
  fi

  git ls-remote --symref "$repo_url" HEAD 2>/dev/null \
    | awk '/^ref:/ {sub("refs/heads/", "", $2); print $2; exit}'
}

resolved_branch="$(resolve_branch)"
if [[ -z "$resolved_branch" ]]; then
  printf '%s\n' "Could not detect nanochat default branch for $repo_url" >&2
  printf '%s\n' "Set NANOCHAT_BRANCH explicitly and rerun." >&2
  exit 1
fi

if [[ -d "$nanochat_root/.git" ]]; then
  git -C "$nanochat_root" fetch origin
  git -C "$nanochat_root" checkout "$resolved_branch"
  git -C "$nanochat_root" pull --ff-only origin "$resolved_branch"
else
  mkdir -p "$(dirname "$nanochat_root")"
  git clone --branch "$resolved_branch" "$repo_url" "$nanochat_root"
fi

if [[ "$sync_env" != "1" ]]; then
  printf '%s\n' "nanochat cloned to $nanochat_root"
  printf '%s\n' "nanochat branch: $resolved_branch"
  printf '%s\n' "Skipping dependency sync because NANOCHAT_SYNC=$sync_env"
  exit 0
fi

if [[ ! -x "$uv_bin" ]]; then
  printf '%s\n' "uv was not found at $uv_bin. Install Hermes first or install uv before syncing nanochat." >&2
  exit 1
fi

cd "$nanochat_root"
"$uv_bin" sync
printf '%s\n' "nanochat dependencies synced at $nanochat_root"
