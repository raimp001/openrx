#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ "${EUID}" -eq 0 ]]; then
  printf '%s\n' "Run this script as the intended research user, not root." >&2
  exit 1
fi

hermes_bin="${HERMES_BIN:-$HOME/.local/bin/hermes}"
install_url="${HERMES_INSTALL_URL:-https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh}"

if [[ -x "$hermes_bin" ]]; then
  printf '%s\n' "Hermes is already installed at $hermes_bin"
  exit 0
fi

curl -fsSL "$install_url" | bash
printf '%s\n' "Hermes install complete. Binary expected at $hermes_bin"
