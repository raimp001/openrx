# TAO Trader Research Agent

This repository has two different trust zones:

- `executor VM`: places trades, holds exchange secrets, and enforces risk
- `research VM`: does research only and must never hold exchange secrets

If you are an agent running in this repo on the research VM:

- do not request, store, or use Coinbase or Kraken private credentials
- do not place real trades or modify the executor runtime state
- keep all outputs under `notes/`, `output/`, or `/var/lib/tao-trader/research`
- treat `tao_autoresearch/` and `nanochat/` as research sandboxes, not execution paths
- respect the TAO bot's hard strategy constraints:
  - spot only
  - no leverage
  - no margin
  - no futures
  - capital preservation first
  - prefer no trade over bad trade
- prefer producing:
  - TAO market notes
  - sentiment summaries
  - candidate hyperparameter results
  - backtest comparisons
  - prompts or operator recommendations

Research priorities:

1. Improve TAO backtest quality after fees and spread.
2. Compare Kraken and Coinbase market quality for TAO.
3. Track regime changes that should tighten or loosen risk.
4. Keep a written log of what changed and why.

Operational rules:

- `paper` mode evidence beats intuition.
- No live-trading recommendations without citing evidence from recent results.
- Never recommend leverage, liquidation-based sizing, or futures-style exposure for TAO in this repo.
- Prefer no trade over bad trade.
