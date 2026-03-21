# TAO Autoresearch Prompt

This folder is a TAO strategy-search adaptation of the idea in [karpathy/autoresearch](https://github.com/karpathy/autoresearch).

Rules:

- The human edits this `program.md`.
- The agent edits `train.py`.
- Do not sprawl into a framework. Keep the entire research core in `train.py`.
- Optimize for faster research progress, not for code prettiness.
- Preserve capital first. Strategies with ugly drawdowns or unstable results are worse than slightly lower returns.
- Do not claim guaranteed profits. Treat every improvement as provisional until validated.
- Prefer small changes that improve the reported `objective_score`.
- Keep each experiment cheap enough that an agent can run many in a weekend.

Loop:

1. Run `python3 prepare.py` once to fetch public TAO candles.
2. Run `python3 train.py --budget-seconds 300`.
3. Inspect `runs/best.json` and `runs/history.jsonl`.
4. Modify only `train.py`.
5. Re-run the search and keep only changes that improve the objective while respecting drawdown and trade quality.

Current objective:

- Maximize `objective_score`.
- Preserve capital first.
- Penalize max drawdown heavily.
- Avoid overtrading.
- Prefer settings that survive both the uptrend and chop segments of the dataset.
- Search across multiple long-only entry styles instead of assuming one TAO setup is always best.

Current constraints:

- TAO spot only.
- 15-minute and 1-hour candles only.
- Long-only.
- Simulated fees/slippage must stay in the model.
- Skip setups after blow-off candles.
- Trend filter above 1-hour EMA.

If you are the agent:

- Change only `train.py` unless the human explicitly changes scope.
- Keep the output schema stable so runs stay comparable.
- Improve the search algorithm or the backtest logic, but do not remove risk controls to game the metric.
