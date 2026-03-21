# Gaps

This repo is materially better than the first version, but it is still not the finished machine.

## Highest-Value Missing Systems

1. Live ingestion
   Missing: fresh news, social, transcript, flow, and on-chain sentiment ingestion into `data/sentiment_feed.json`.

2. Performance memory
   Missing: realized PnL, expectancy, win rate, and regime-fit by style.

3. Backtesting
   Missing: historical replay and walk-forward validation for each strategy style.

4. Execution quality
   Missing: websocket market data, slippage tracking, partial exits, and stop logic.

5. Operations
   Missing: scheduled runs, run logs, reconciliation, and failure alerts.

## Medium Risks

- `researcher/agents.py` is becoming the monolith of the repo.
- sentiment is still operator-maintained, not machine-maintained
- there is no schema validation layer for `data/*.json`
- `runtime/` now exists, but there is still no separate artifact journal for fills, PnL, and reconciliation

## Best Next Refactors

1. Split `researcher/agents.py` into:
   - `committee.py`
   - `sentiment.py`
   - `state.py`
   - `selection.py`
2. Add `researcher/schemas.py` for config validation.
3. Add `researcher/journal.py` for trade history and realized outcomes.
4. Add `researcher/backtest.py` for replay and evaluation.
5. Add `artifacts/` or `journal/` for fills, PnL, and reconciliation output while leaving `runtime/` for machine state.
