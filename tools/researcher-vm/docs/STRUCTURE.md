# Structure

This repo now has four logical layers:

1. `researcher/`
   The application code: scoring, agents, trading, exchange adapters, prompts.
2. `data/`
   Durable research and decision inputs: companies, weights, strategy configs, sentiment seed files.
3. `prompts/`
   Operator prompt pack for committee, sentiment refresh, post-trade review, and weekly style review.
4. `runtime/`
   Transient machine state, especially shared position state and other non-human runtime artifacts.
5. `output/` and `notes/`
   Generated reports and operator notes.

## Repo Tree

```text
researcher/
├── researcher/
│   ├── agents.py
│   ├── cli.py
│   ├── coinbase.py
│   ├── exchange.py
│   ├── kraken.py
│   ├── prompts.py
│   ├── reporting.py
│   ├── scoring.py
│   └── trading.py
├── data/
│   ├── companies.json
│   ├── weights.json
│   ├── trading_strategy*.json
│   ├── agent_watchlist*.json
│   └── sentiment_feed.json
├── runtime/
├── prompts/
│   ├── master_committee.md
│   ├── sentiment_refresh.md
│   ├── weekly_style_review.md
│   └── post_trade_review.md
├── tests/
├── notes/
├── output/
├── docs/
├── README.md
└── program.md
```

## Layering Rules

- `researcher/scoring.py` should stay pure and not know about exchanges.
- `researcher/exchange.py`, `researcher/coinbase.py`, and `researcher/kraken.py` should stay execution-focused and not know about research scoring.
- `researcher/agents.py` is the orchestration layer between research, sentiment, market state, and execution.
- `data/` is configuration and evidence, not code.
- `runtime/` is machine state and should be treated as ephemeral.
- `output/` is human-readable output, not source-of-truth logic.
- `notes/` is durable analyst context and can feed future `data/` updates.

## Current Strengths

- The repo is still small enough to reason about.
- The exchange interface is separated from the strategy logic.
- Multi-style strategies now share a single position state per venue and product.
- Prompt templates are first-class instead of living only in chat history.

## Current Structural Risks

- `researcher/agents.py` now carries most of the orchestration complexity and is the largest pressure point in the codebase.
- `data/sentiment_feed.json` is still a manual or seeded artifact, not a live pipeline output.
- `runtime/` is now separate from `output/`, but the repo still needs stronger run logging and reconciliation.
