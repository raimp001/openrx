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
service_user="${SERVICE_USER:-taobot}"
service_group="${SERVICE_GROUP:-$service_user}"

if [[ -z "$repo_url" ]]; then
  printf '%s\n' "Usage: sudo bash deploy/bootstrap/setup-executor-vm.sh <git_repo_url_or_local_repo_path>" >&2
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

install -d -m 0755 /opt/tao-trader "$state_root/runtime" "$state_root/output" "$state_root/research"
install -d -m 0750 "$env_root" "$env_root/secrets"

if ! id -u "$service_user" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/$service_user" --shell /bin/bash "$service_user"
fi

chown -R "$service_user:$service_group" /opt/tao-trader "$state_root"
chown root:"$service_group" "$env_root" "$env_root/secrets"

apt-get update
apt-get install -y git python3 python3-venv rsync

sync_repo

if [[ ! -x "$venv_root/bin/python3" ]]; then
  as_user "python3 -m venv '$venv_root'"
fi
as_user "'$venv_root/bin/pip' install -e '$app_root'"

install -m 0600 "$app_root/deploy/env/executor.example.env" "$env_root/executor.env.new"
install -m 0600 "$app_root/config/local_secrets.example.env" "$env_root/live.env.new"

if [[ ! -f "$env_root/executor.env" ]]; then
  mv "$env_root/executor.env.new" "$env_root/executor.env"
else
  rm -f "$env_root/executor.env.new"
fi

if [[ ! -f "$env_root/live.env" ]]; then
  mv "$env_root/live.env.new" "$env_root/live.env"
else
  rm -f "$env_root/live.env.new"
fi

chown root:"$service_group" "$env_root/executor.env" "$env_root/live.env"
chmod 0640 "$env_root/executor.env" "$env_root/live.env"

cp "$app_root/deploy/systemd/tao-trader-executor.service" /etc/systemd/system/
cp "$app_root/deploy/systemd/tao-trader-dashboard.service" /etc/systemd/system/
cp "$app_root/deploy/systemd/tao-trader-dashboard.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable tao-trader-executor.service
systemctl enable tao-trader-dashboard.timer

cat <<EOF
Executor VM bootstrap complete.

Next:
1. Edit $env_root/executor.env
2. Edit $env_root/live.env
3. Add exchange and Telegram secret files under $env_root/secrets
4. Start paper mode:
   systemctl start tao-trader-executor.service
   systemctl start tao-trader-dashboard.timer
EOF
