# VM Deployment Pack

This repo now includes a concrete two-VM deployment layout for `tao-trader`.

Use it this way:

- `VM1` `executor`: runs `tao-autopilot`, holds exchange secrets, owns the SQLite runtime DB, and sends Telegram alerts.
- `VM2` `research`: runs `Hermes Agent`, `nanochat`, the TAO improvement search, prompt iteration, and dashboard review. It holds no exchange secrets.

The point of the split is simple: research can be messy, but execution has to stay narrow and boring.

## Directory layout

Recommended paths on both VMs:

- app checkout: `/opt/tao-trader/current`
- virtualenv: `/opt/tao-trader/venv`
- runtime state: `/var/lib/tao-trader/runtime`
- generated output: `/var/lib/tao-trader/output`
- research data: `/var/lib/tao-trader/research`
- external env files: `/etc/tao-trader`
- exchange and Telegram secret files: `/etc/tao-trader/secrets`

## Executor VM

Fast path:

```bash
gh repo clone raimp001/tao-trader /tmp/tao-trader-bootstrap
cd /tmp/tao-trader-bootstrap
sudo bash deploy/bootstrap/setup-executor-vm.sh /tmp/tao-trader-bootstrap
```

Manual path:

1. Copy the standalone app to `/opt/tao-trader/current`.
2. Create a venv:

```bash
python3 -m venv /opt/tao-trader/venv
/opt/tao-trader/venv/bin/pip install -e /opt/tao-trader/current
```

3. Copy [`env/executor.example.env`](env/executor.example.env) to `/etc/tao-trader/executor.env`.
4. Copy [`../config/local_secrets.example.env`](../config/local_secrets.example.env) to `/etc/tao-trader/live.env`.
5. Put the real exchange and Telegram secret files in `/etc/tao-trader/secrets`.
6. Install the systemd units from [`systemd/`](systemd/).

Suggested enablement:

```bash
sudo cp deploy/systemd/tao-trader-executor.service /etc/systemd/system/
sudo cp deploy/systemd/tao-trader-dashboard.service /etc/systemd/system/
sudo cp deploy/systemd/tao-trader-dashboard.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tao-trader-executor.service
sudo systemctl enable --now tao-trader-dashboard.timer
```

## Research VM

Fast path:

```bash
gh repo clone raimp001/tao-trader /tmp/tao-trader-bootstrap
cd /tmp/tao-trader-bootstrap
sudo bash deploy/bootstrap/setup-research-vm.sh /tmp/tao-trader-bootstrap
```

Manual path:

1. Copy the standalone app to `/opt/tao-trader/current`.
2. Create the same venv.
3. Copy [`env/research.example.env`](env/research.example.env) to `/etc/tao-trader/research.env`.
4. Install the research units:

```bash
sudo cp deploy/systemd/tao-trader-research.service /etc/systemd/system/
sudo cp deploy/systemd/tao-trader-research.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tao-trader-research.timer
```

Hermes and nanochat:

- the research bootstrap now installs Hermes for the `taoresearch` user
- it also clones `nanochat` under `/opt/nanochat/current`
- Hermes-specific notes live in [`hermes/README.md`](hermes/README.md)
- the optional systemd unit for a Hermes gateway is [`systemd/tao-trader-hermes-gateway.service`](systemd/tao-trader-hermes-gateway.service)
- the existing `tao-trader-research.timer` now runs the gated `tao-improve` cycle, not just raw parameter search

Paper promotion note:

- `tao-improve` writes its active paper candidate into `TAO_IMPROVEMENT_STATE`
- the paper autopilot reads that same state file on each cycle
- if you split executor and research across different VMs, you need to sync or share `TAO_IMPROVEMENT_STATE` before expecting paper-mode promotion to take effect on the executor
- `manual` and `live` mode ignore promoted paper candidates on purpose

## VM hardening

- Use `Tailscale` or another private mesh between the VMs.
- Keep SSH closed to the public internet if possible.
- Use exchange keys with `trade only` and `no withdrawals`.
- Never copy exchange keys onto the research VM.
- Keep the executor VM small and dedicated.
- Keep Hermes and nanochat on the research VM only.
- Start with `TAO_MODE=paper`, then `manual`, then `live`.

## What this pack does not do

- It does not provision cloud VMs for you.
- It does not make multi-tenant OpenClaw safe for exchange execution.
- It does not replace the need for native exchange-side protective orders.

For the reasoning behind this topology, read [`../docs/DEPLOYMENT_ARCHITECTURE.md`](../docs/DEPLOYMENT_ARCHITECTURE.md).
