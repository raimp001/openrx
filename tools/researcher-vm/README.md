# Founder Researcher

This workspace now lives under `tools/researcher-vm` inside the OpenRx repo.

For OpenRx, treat it as an auxiliary VM or worker foundation for Hermes/OpenClaw/autoresearch experiments and scheduled background jobs. It is not part of the patient-facing Next.js runtime.

OpenRx-specific integration notes live in:

- `../../docs/researcher-vm-integration.md`
- `../../docs/BACKGROUND_AGENTS_AWS.md`

Local founder and company research workflow inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch).

This repo is opinionated toward:

- founder-led companies that can survive ugly cycles
- crypto, fintech, AI, and hard-tech names with asymmetric upside
- evidence-based ranking instead of hot takes

The seeded universe includes your current interests: Bitcoin, Coinbase, Bittensor, Zcash, NEAR, Robinhood, and Tesla.

Trading is narrower than research:

- `BTC-USD` is treated as the core liquid position
- `TAO-USD` and `NEAR-USD` are smaller venture buckets
- `ZEC-USD` is tracked as optionality with tighter buy gates
- `COIN`, `HOOD`, and `TSLA` remain research-only because the live trading layer is crypto-only

## Quick start

Use Python 3.9+.

```bash
python -m researcher rank
python -m researcher brief coinbase
python -m researcher init-note coinbase
python -m researcher prompt --list
python -m researcher accounts
python -m researcher accounts --exchange kraken
python -m researcher trade --mode paper
python -m researcher agent-scan
python -m researcher agent-trade --mode paper
python -m researcher tao-scan
python -m researcher tao-trade --mode paper
python -m researcher tao-trade --mode manual
python -m researcher tao-backtest --dataset tao_autoresearch/data/kraken_tao_usd.json
python -m researcher tao-improve --dataset tao_autoresearch/data/kraken_tao_usd.json
python -m researcher tao-dashboard --mode paper
python -m researcher tao-autopilot --mode paper --iterations 4 --interval-seconds 900
./scripts/install-hooks.sh
```

The commands write:

- `output/ranked_watchlist.md`
- `output/<slug>_brief.md`
- `notes/<slug>.md`
- `output/trades/<timestamp>_<exchange>_<product>_<mode>.json`
- `output/agent_scan.json`
- `output/agent_trades/<timestamp>_<exchange>_<product>_agents_<mode>.json`
- `output/tao_bot/<timestamp>_<exchange>_TAO-USD_<mode>.json`
- `output/tao_backtest/tao_backtest.json`
- `output/tao_dashboard/index.html`
- `output/tao_improvement/latest.json`
- `runtime/agent_state_<mode>.json`
- `runtime/tao_bot_<mode>.db`
- `runtime/tao_autopilot.db`
- `runtime/tao_improvement.db`

## How it works

`data/companies.json` stores the research universe. Each company or protocol has:

- founders
- tags
- one-line thesis
- timing note
- catalysts
- red flags
- diligence questions
- a scorecard across leadership, moat, distribution, market, regulation, and optionality

`data/weights.json` controls the ranking weights. The default rubric intentionally overweights `leadership_resilience` because you asked for founders who can weather storms.

`program.md` is the agent instruction file. Open it in Codex or another agentic setup when you want the system to operate like a persistent analyst rather than a one-off script.

## System docs

The repo now has explicit system maps:

- `docs/STRUCTURE.md`: source tree and layering rules
- `docs/WORK_TREE.md`: operator workflow tree
- `docs/MACHINE_TREE.md`: runtime decision tree and state machine
- `docs/GAPS.md`: what is still missing and what should be built next
- `docs/DEPLOYMENT_ARCHITECTURE.md`: the chosen two-VM production shape

There is also a deployment pack in `deploy/`:

- `deploy/README.md`: VM runbook
- `deploy/hermes/README.md`: Hermes + nanochat research VM notes
- `deploy/env/*.example.env`: external service env templates
- `deploy/bootstrap/*.sh`: one-shot VM bootstrap scripts
- `deploy/systemd/`: example services and timers
- `scripts/install-hermes.sh`: official Hermes installer wrapper for the research VM
- `scripts/setup-nanochat.sh`: clone or update nanochat on the research VM
- `scripts/run-hermes.sh`: launch Hermes from the repo root so it picks up `AGENTS.md`
- `scripts/run-autopilot.sh`: generic paper/manual/live launcher for VM services
- `scripts/render-dashboard.sh`: one-shot dashboard refresh
- `scripts/run-research-cycle.sh`: one TAO autoresearch cycle for the research VM
  - this now runs the gated `tao-improve` flow by default, so winners can auto-promote to `paper`

## Prompt pack

There is now a reusable operator prompt pack in `prompts/` plus a CLI helper:

```bash
python -m researcher prompt --list
python -m researcher prompt master-committee
python -m researcher prompt tao-max-stack
python -m researcher prompt sentiment-refresh --output output/prompts/sentiment_refresh.md
```

Available prompts:

- `master-committee`: choose the best style and exact next trade
- `tao-max-stack`: maximize net TAO accumulation while staying spot-only and capital-first
- `sentiment-refresh`: update `data/sentiment_feed.json`
- `weekly-style-review`: review which styles are working
- `post-trade-review`: review the last executed style and size

## Exchange trading bot

The repo now includes live exchange adapters for:

- Coinbase Advanced Trade
- Kraken Spot REST

The default configs stay on Coinbase so existing commands keep working, but the strategy format now supports an `exchange` field and the CLI can route to either venue.

Environment variables:

Coinbase:

- `COINBASE_API_KEY_NAME`: your CDP key name, for example `organizations/{org_id}/apiKeys/{key_id}`
- `COINBASE_API_PRIVATE_KEY`: your ECDSA private key with preserved newlines, or with `\n` escapes
- `COINBASE_API_PRIVATE_KEY_FILE`: optional alternative to the inline private key
- `COINBASE_API_BASE_URL`: defaults to `https://api.coinbase.com`
- `COINBASE_TIMEOUT_SECONDS`: optional HTTP timeout override

Kraken:

- `KRAKEN_API_KEY`
- `KRAKEN_API_SECRET`
- `KRAKEN_API_SECRET_FILE`: optional alternative to the inline secret
- `KRAKEN_API_OTP`: optional OTP if your key requires it
- `KRAKEN_API_BASE_URL`: defaults to `https://api.kraken.com`
- `KRAKEN_TIMEOUT_SECONDS`: optional HTTP timeout override

Local secret-path config:

- `.env.example` documents the supported environment variables
- `config/local_secrets.example.env` shows the recommended file-backed layout
- `RESEARCHER_SECRET_CONFIG` can point to a local `.env` file that is never committed
- `researcher` will read that file automatically when env vars are otherwise unset

Commands:

```bash
python -m researcher accounts
python -m researcher accounts --exchange kraken
python -m researcher preview-order --product BTC-USD --side BUY --quote-size 25
python -m researcher preview-order --exchange kraken --product BTC-USD --side BUY --quote-size 25
python -m researcher trade --mode paper
python -m researcher trade --config data/trading_strategy_kraken.json --mode paper
```

The default strategy file is `data/trading_strategy.json`. A Kraken sample lives at `data/trading_strategy_kraken.json`. Both use a transparent momentum-plus-spread filter and preview orders before any execution.

## Repo hardening

The repo now includes a basic local-security workflow for live trading:

- stricter `.gitignore` rules for secrets, local env files, and key material
- `.env.example` plus `config/local_secrets.example.env`
- file-backed secret loading for Coinbase, Kraken, and Telegram
- `.githooks/pre-commit` with `gitleaks`
- `scripts/install-hooks.sh` to activate repo hooks
- `scripts/run-live.sh` to launch live mode only from an external secret config

Recommended setup:

```bash
mkdir -p "$HOME/.config/researcher"
cp config/local_secrets.example.env "$HOME/.config/researcher/live.env"
chmod 700 "$HOME/.config/researcher"
chmod 600 "$HOME/.config/researcher/live.env"
./scripts/install-hooks.sh
export RESEARCHER_SECRET_CONFIG="$HOME/.config/researcher/live.env"
```

The safer live launcher refuses to use inline secrets or secret files stored inside the repo:

```bash
export RESEARCHER_SECRET_CONFIG="$HOME/.config/researcher/live.env"
export LIVE_ACK=I_ACCEPT_REAL_TRADES
./scripts/run-live.sh --exchange kraken --interval-seconds 900
```

## TAO swing bot

There is now a dedicated TAO spot bot for a small account.

The first version is intentionally strict:

- capital envelope starts at `$100`
- TAO spot only
- paper mode by default
- scans Coinbase and Kraken and chooses the cleaner venue
- uses only `15m` and `1h` candles
- supports multiple long-only TAO entry styles: `hybrid`, `dip_buy`, `breakout_retest`, `reclaim_trend`, and `momentum_continuation`
- only buys when TAO is above the `1h 50 EMA`
- entries must be a dip-buy in an uptrend or a breakout-retest with a bullish confirmation close
- skips wide spreads, weak liquidity, sharp volume drops, and bad fee-to-reward setups
- risks only `0.5%` to `1%` of equity per trade
- one TAO position max
- hard stop logic, TP1 at `1.5R`, TP2 at `2R`, daily loss cap, cooldown, and a manual kill switch
- `manual` mode for human confirmation before any real exchange fill is recorded
- pending-order state so live/manual orders are not treated as filled immediately

Config lives in `data/tao_bot.json`.

Commands:

```bash
python -m researcher tao-scan
python -m researcher tao-trade --mode paper
python -m researcher tao-trade --mode manual
python -m researcher tao-trade --exchange kraken --mode paper
python -m researcher tao-trade --runtime-db runtime/tao_bot_live.db --mode manual
python -m researcher tao-backtest --dataset tao_autoresearch/data/kraken_tao_usd.json
python -m researcher tao-backtest --dataset tao_autoresearch/data/kraken_tao_usd.json --candidate tao_autoresearch/runs/best.json
python -m researcher tao-improve --dataset tao_autoresearch/data/kraken_tao_usd.json
python -m researcher tao-dashboard --runtime-db runtime/tao_live.db
python -m researcher tao-reconcile --mode manual --status filled --fill-price 119.10
python -m researcher tao-autopilot --mode paper --iterations 8 --interval-seconds 900
python -m researcher tao-autopilot --runtime-db runtime/tao_live.db --mode paper
python -m researcher tao-autopilot --mode paper --enable-research --research-every 12
python -m researcher tao-kill-switch --reason "Manual risk stop."
python -m researcher tao-kill-switch --disable --reason "Resume trading."
```

The TAO bot writes:

- `output/tao_bot/<timestamp>_<exchange>_TAO-USD_<mode>.json`
- `output/tao_backtest/tao_backtest.json`
- `output/tao_improvement/latest.json`
- `output/tao_dashboard/index.html`
- `runtime/tao_bot_<mode>.db`
- `runtime/tao_autopilot.db`
- `runtime/tao_improvement.db`

The new improvement loop is supervised, not live-self-modifying:

- `tao-improve` searches fresh TAO candidates, backtests them, and writes a promotion report
- the search now spans multiple long-only TAO entry styles instead of only one fixed setup
- only candidates that beat the incumbent paper strategy and stay inside the drawdown/trade gates are promoted
- `tao-trade --mode paper` and `tao-autopilot --mode paper` automatically read the promoted paper candidate from `runtime/tao_improvement.db`
- `manual` and `live` mode ignore the promoted candidate and keep using the base config
- if you split research and execution across two VMs, the executor only sees promotions if `TAO_IMPROVEMENT_STATE` is synced or shared between them

Telegram alerts are optional. If set, the bot will alert on entries, exits, stop-losses, and kill-switch events:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Live mode stays guarded the same way as the other trading commands:

```bash
export COINBASE_ENABLE_LIVE_TRADING=1
python -m researcher tao-trade --mode live --live-ack I_ACCEPT_REAL_TRADES
```

For Kraken, set `KRAKEN_ENABLE_LIVE_TRADING=1` instead.

Important operator note:

- `paper` mode simulates fills immediately.
- `manual` mode generates the order plan, writes a pending order into state, and waits for you to confirm the real fill or cancel.
- `live` mode can submit the order to the exchange, records that order as `pending`, and then auto-syncs later against the exchange order status before mutating state.
- `tao-autopilot` wraps the same bot in a loop, polls faster while orders are pending, and can optionally run the TAO autoresearch search on a slower cadence.
- `tao-backtest` evaluates the TAO baseline strategy against a candle dataset and can compare it to a tuned candidate from `tao_autoresearch/runs/best.json`.
- `tao-dashboard` renders a local HTML view of TAO runtime state, autopilot heartbeat, and backtest output without needing a web server.
- TAO runtime state now defaults to SQLite, not flat JSON files. You can still pass `.json` or `.jsonl` paths explicitly if you want the old file behavior.

Example manual flow:

```bash
python -m researcher tao-trade --mode manual
python -m researcher tao-reconcile --mode manual --status filled --fill-price 119.10
python -m researcher tao-reconcile --mode manual --status canceled
```

Example live flow:

```bash
python -m researcher tao-trade --mode live --live-ack I_ACCEPT_REAL_TRADES
python -m researcher tao-trade --mode live --live-ack I_ACCEPT_REAL_TRADES
```

If a live order is still open, the second run will keep it pending. If the exchange reports it filled or canceled, the bot will auto-reconcile that state.

Example autonomous flow:

```bash
python -m researcher tao-autopilot --mode paper --interval-seconds 900
python -m researcher tao-autopilot --mode manual --interval-seconds 900 --pending-interval-seconds 60
python -m researcher tao-autopilot --runtime-db runtime/tao_live.db --mode manual
python -m researcher tao-autopilot --mode paper --enable-research --research-every 12
```

Autopilot defaults to the same SQLite runtime store as the one-shot bot. If you pass `--runtime-db`, the TAO state, TAO journal, autopilot heartbeat, and autopilot loop log can all live in one database file. If a TAO order is pending, the loop drops to the faster pending interval instead of waiting a full 15 minutes.

Backtest flow:

```bash
python -m researcher tao-backtest --dataset tao_autoresearch/data/kraken_tao_usd.json
python -m researcher tao-backtest --dataset tao_autoresearch/data/kraken_tao_usd.json --candidate tao_autoresearch/runs/best.json
```

If you do not have local candle data yet, fetch it first:

```bash
cd tao_autoresearch
python3 prepare.py
```

Dashboard flow:

```bash
python -m researcher tao-dashboard --mode paper
python -m researcher tao-dashboard --runtime-db runtime/tao_live.db
```

## TAO Autoresearch

There is now also a self-contained `tao_autoresearch/` mini-repo inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch).

It keeps the same basic split:

- the human iterates on `tao_autoresearch/program.md`
- the agent iterates on `tao_autoresearch/train.py`

Files:

- `tao_autoresearch/prepare.py`: fetch public TAO candles from Coinbase and Kraken
- `tao_autoresearch/train.py`: one-file TAO strategy search core
- `tao_autoresearch/program.md`: operator prompt
- `tao_autoresearch/runs/best.json`: best candidate from the latest search

Quick start:

```bash
cd tao_autoresearch
python3 prepare.py
python3 train.py --budget-seconds 300
```

This is a strategy research harness, not a guaranteed money printer.

## Agent orchestration

There is now a committee layer on top of the raw trading bot:

- `research` agent: converts the thesis score in `data/companies.json` into a buy, hold, or sell vote
- `sentiment` agent: reads `data/sentiment_feed.json` and scores product, thesis, and macro regime
- `market` agent: checks momentum and spread
- `allocator` agent: checks whether your current base allocation is underweight or overweight
- `state` agent: enforces hold periods and re-entry cooldowns
- `risk` agent: blocks trades that would violate the buffer, size cap, or allocation caps
- `orchestrator`: only acts when enough agents agree

The committee config lives in `data/agent_watchlist.json`.
A Kraken-specific sample watchlist lives in `data/agent_watchlist_kraken.json`.
The default sentiment input lives in `data/sentiment_feed.json`.

The default watchlist is now multi-style instead of one rigid playbook:

- `trend`: stay with established continuation
- `breakout`: lean into expansion when momentum and sentiment agree
- `mean_reversion`: buy sharp dislocations instead of only chasing strength
- `sentiment`: let narrative and regime lead, with the tape acting as confirmation

The seeded mix is tilted toward making money from several kinds of market behavior:

- three separate `BTC-USD` styles share the same underlying position state
- `TAO-USD` has a breakout and sentiment scout profile
- `NEAR-USD` stays mostly trend-following
- `ZEC-USD` is handled as contrarian mean reversion instead of broad trend chasing

The position state is shared per `exchange:product`, while reports and strategy selection stay unique per named style. That means `Bitcoin Trend Core` and `Bitcoin Breakout` can coexist without stomping on each other's identity, while still respecting the same live BTC position and cooldowns.

Commands:

```bash
python -m researcher agent-scan
python -m researcher agent-trade --mode paper
python -m researcher agent-trade --strategy "Bitcoin Breakout" --mode paper
python -m researcher agent-scan --sentiment data/sentiment_feed.json
python -m researcher agent-scan --config data/agent_watchlist_kraken.json
python -m researcher agent-trade --config data/agent_watchlist_kraken.json --mode paper
```

If you omit `--strategy`, `agent-trade` scans the full style roster and picks the strongest actionable setup by edge score.

The default `data/sentiment_feed.json` is a seeded snapshot, not live news or social ingestion. Update it as your current read on the market changes. The sentiment agent will ignore stale sentiment after each strategy's `max_sentiment_age_hours` window.

This will not guarantee higher returns. It is meant to let the bot switch between continuation, breakout, and dip-buying behavior instead of forcing every market into one template.

Live trading is intentionally hard to enable:

```bash
export COINBASE_ENABLE_LIVE_TRADING=1
python -m researcher trade --mode live --live-ack I_ACCEPT_REAL_TRADES
python -m researcher agent-trade --mode live --live-ack I_ACCEPT_REAL_TRADES
```

For Kraken, set `KRAKEN_ENABLE_LIVE_TRADING=1` instead. You can also set `RESEARCHER_ENABLE_LIVE_TRADING=1` to unlock live mode across both exchanges. If you do not provide both an env var and the ack string, the bot will refuse to submit real orders.

Notes from the current exchange docs:

- Coinbase App API keys for Advanced Trade need `ECDSA` / `ES256`, not `Ed25519`.
- JWTs expire after 2 minutes and Coinbase says you must generate a different JWT for each unique API request.
- `Preview Order` is separate from `Create Order`, so the bot previews first and only then places a live order.
- The Advanced Trade sandbox is static and only covers accounts and orders, so the default paper path still uses live market data logic but does not submit orders.
- Advanced Trade also supports a WebSocket protocol for real-time market data, which is the next logical upgrade if you want lower-latency agents.
- Kraken Spot REST signs private requests with `API-Key`, `API-Sign`, and a monotonically increasing `nonce`.
- Kraken uses `validate=true` on `AddOrder` for preview-style checks, so the adapter validates before live submission.
- Kraken balance and pair symbols can differ from common tickers, for example `XBT` on Kraken versus `BTC` elsewhere, so the adapter normalizes those symbols for the shared strategy layer.

## Suggested workflow

1. Run `python -m researcher rank` to refresh the scoreboard.
2. Generate a brief for the most interesting name.
3. Pull primary sources and record what changed in `notes/<slug>.md`.
4. Update the evidence in `data/companies.json`.
5. Re-rank and compare what moved.

## Safety note

This repo does not guarantee profits. It is an execution and research tool, not financial advice. Keep sizes small, review the generated JSON reports, and verify your exchange key permissions before enabling live orders.
