#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  printf '%s\n' "Run this script as root." >&2
  exit 1
fi

repo_url="${1:-}"
branch="${BRANCH:-main}"
app_root="${APP_ROOT:-/opt/tao-trader/current}"
venv_root="${VENV_ROOT:-/opt/tao-trader/venv}"
state_root="${STATE_ROOT:-/var/lib/tao-trader}"
env_root="${ENV_ROOT:-/etc/tao-trader}"
service_user="${SERVICE_USER:-taoresearch}"
service_group="${SERVICE_GROUP:-$service_user}"
hermes_install="${HERMES_INSTALL:-1}"
nanochat_install="${NANOCHAT_INSTALL:-1}"
nanochat_root="${NANOCHAT_ROOT:-/opt/nanochat/current}"

if [[ -z "$repo_url" ]]; then
  printf '%s\n' "Usage: sudo bash deploy/bootstrap/setup-research-vm.sh <git_repo_url_or_local_repo_path>" >&2
  exit 1
fi

as_user() {
  su -s /bin/bash "$service_user" -c "$*"
}

sync_repo() {
  if [[ -d "$repo_url" ]]; then
    mkdir -p "$app_root"
    rsync -a --delete --exclude '.git/' "$repo_url"/ "$app_root"/
    chown -R "$service_user:$service_group" "$app_root"
    return
  fi

  if [[ ! -d "$app_root/.git" ]]; then
    as_user "git clone --branch '$branch' '$repo_url' '$app_root'"
  else
    as_user "git -C '$app_root' fetch origin"
    as_user "git -C '$app_root' checkout '$branch'"
    as_user "git -C '$app_root' pull --ff-only origin '$branch'"
  fi
}

install -d -m 0755 /opt/tao-trader "$state_root/research"
install -d -m 0755 "$(dirname "$nanochat_root")"
install -d -m 0750 "$env_root"

if ! id -u "$service_user" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/$service_user" --shell /bin/bash "$service_user"
fi

chown -R "$service_user:$service_group" /opt/tao-trader "$state_root" "$(dirname "$nanochat_root")"
chown root:"$service_group" "$env_root"

apt-get update
apt-get install -y curl git python3 python3-venv rsync

sync_repo

if [[ ! -x "$venv_root/bin/python3" ]]; then
  as_user "python3 -m venv '$venv_root'"
fi
as_user "'$venv_root/bin/pip' install -e '$app_root'"

if [[ "$hermes_install" == "1" ]]; then
  as_user "'$app_root/scripts/install-hermes.sh'"
fi

if [[ "$nanochat_install" == "1" ]]; then
  as_user "NANOCHAT_ROOT='$nanochat_root' '$app_root/scripts/setup-nanochat.sh'"
fi

install -m 0600 "$app_root/deploy/env/research.example.env" "$env_root/research.env.new"
if [[ ! -f "$env_root/research.env" ]]; then
  mv "$env_root/research.env.new" "$env_root/research.env"
else
  rm -f "$env_root/research.env.new"
fi

chown root:"$service_group" "$env_root/research.env"
chmod 0640 "$env_root/research.env"

cp "$app_root/deploy/systemd/tao-trader-research.service" /etc/systemd/system/
cp "$app_root/deploy/systemd/tao-trader-research.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable tao-trader-research.timer

cat <<EOF
Research VM bootstrap complete.

Next:
1. Edit $env_root/research.env
2. Run Hermes interactively:
   sudo -u $service_user $app_root/scripts/run-hermes.sh
3. Start the timer:
   systemctl start tao-trader-research.timer
EOF
