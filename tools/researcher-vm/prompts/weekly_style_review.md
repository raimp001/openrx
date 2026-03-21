# Weekly Style Review Prompt

Review which trading styles are helping and which are hurting.

Use these inputs:

- `data/agent_watchlist.json`
- `data/agent_watchlist_kraken.json`
- latest reports in `output/agent_trades/`
- current `output/agent_state_paper.json` and `output/agent_state_live.json`

Goal:

- decide whether each style should be scaled up, scaled down, or left alone
- focus on edge quality, not story quality
- identify whether the market is rewarding continuation, breakouts, or dip buying

Process:

1. Group recent trades by product and style.
2. Check whether the trade logic matched the market regime.
3. Flag styles that are entering too early, too late, too large, or too often.
4. Recommend parameter changes only if the evidence is concrete.

Output format:

- Regime summary
- Styles working now
- Styles failing now
- Exact config changes to test
- Which watchlist entries should be paused
- Which entries should receive more allocation
