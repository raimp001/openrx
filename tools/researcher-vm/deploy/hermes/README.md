# Hermes + nanochat Research VM

This stack is for the `research VM`, not the executor.

What belongs here:

- `Hermes Agent` for interactive research, memory, scheduling, and optional gateways
- `nanochat` for model and training experimentation
- `tao_autoresearch` for lightweight TAO-specific parameter search

What does not belong here:

- Coinbase private keys
- Kraken private keys
- any process that can place real trades

## First boot

After the research VM bootstrap finishes:

```bash
sudo -u taoresearch /opt/tao-trader/current/scripts/run-hermes.sh
sudo -u taoresearch /opt/tao-trader/current/scripts/setup-nanochat.sh
```

If you want Hermes messaging or remote control, configure it interactively first:

```bash
sudo -u taoresearch /opt/tao-trader/current/scripts/run-hermes.sh
```

If you want the Hermes gateway to run as a service after configuration:

```bash
sudo cp /opt/tao-trader/current/deploy/systemd/tao-trader-hermes-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tao-trader-hermes-gateway.service
```

## nanochat note

`nanochat` can be cloned on this VM, but the larger official speedrun targets multi-GPU systems. Keep the cheap research VM focused on orchestration, prompting, and lighter experiments unless you intentionally provision a GPU node.

Also keep Hermes constrained to the repo rules in [`../../AGENTS.md`](../../AGENTS.md): this repo is `spot only`, `no leverage`, `no margin`, and `no futures`.
