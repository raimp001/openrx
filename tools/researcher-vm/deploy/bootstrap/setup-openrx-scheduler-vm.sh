#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  printf '%s\n' "Run this script as root." >&2
  exit 1
fi

repo_url="${1:-}"
branch="${BRANCH:-main}"
app_root="${APP_ROOT:-/opt/openrx/current}"
env_root="${ENV_ROOT:-/etc/openrx}"
service_user="${SERVICE_USER:-openrx}"
service_group="${SERVICE_GROUP:-$service_user}"

if [[ -z "$repo_url" ]]; then
  printf '%s\n' "Usage: sudo bash tools/researcher-vm/deploy/bootstrap/setup-openrx-scheduler-vm.sh <git_repo_url_or_local_repo_path>" >&2
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

apt-get update
apt-get install -y ca-certificates curl git python3 rsync

install -d -m 0755 /opt/openrx
install -d -m 0750 "$env_root"

if ! id -u "$service_user" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/$service_user" --shell /bin/bash "$service_user"
fi

chown -R "$service_user:$service_group" /opt/openrx
chown root:"$service_group" "$env_root"

sync_repo

install -m 0640 "$app_root/tools/researcher-vm/deploy/env/openrx-research.example.env" "$env_root/research.env.new"
if [[ ! -f "$env_root/research.env" ]]; then
  mv "$env_root/research.env.new" "$env_root/research.env"
else
  rm -f "$env_root/research.env.new"
fi

chown root:"$service_group" "$env_root/research.env"
chmod 0640 "$env_root/research.env"

install -m 0644 "$app_root/tools/researcher-vm/deploy/systemd/openrx-scheduler.service" /etc/systemd/system/openrx-scheduler.service
install -m 0644 "$app_root/tools/researcher-vm/deploy/systemd/openrx-scheduler.timer" /etc/systemd/system/openrx-scheduler.timer
install -m 0644 "$app_root/tools/researcher-vm/deploy/systemd/openrx-cron@.service" /etc/systemd/system/openrx-cron@.service

systemctl daemon-reload
systemctl enable openrx-scheduler.timer

cat <<EOF
OpenRx scheduler bootstrap complete.

Next:
1. Edit $env_root/research.env
2. Test one scheduler run:
   sudo -u $service_user OPENRX_BASE_URL=https://openrx.health $app_root/tools/researcher-vm/scripts/run-openrx-due-jobs.sh
3. Start the timer:
   systemctl start openrx-scheduler.timer
4. Inspect status:
   systemctl status openrx-scheduler.timer --no-pager
   journalctl -u openrx-scheduler.service -n 100 --no-pager
EOF
