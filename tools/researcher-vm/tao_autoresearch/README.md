# TAO Autoresearch

Minimal TAO strategy-search playground inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch).

This is not a copy of the upstream LLM training code. It keeps the same spirit:

- the human iterates on `program.md`
- the agent iterates on `train.py`
- every run is cheap and comparable
- the loop is meant to keep making research progress without framework bloat

Here the search target is not validation loss on an LLM. It is a fee-aware TAO spot backtest score that prefers capital preservation, lower drawdown, and cleaner trade selection.

Files:

- `program.md`: human-edited operator prompt
- `prepare.py`: fetch public TAO candles from Coinbase and Kraken
- `train.py`: single-file research core that samples strategy candidates and scores them
- `data/`: fetched candle datasets
- `runs/`: best run plus run history

## Quick start

```bash
cd tao_autoresearch
python3 prepare.py
python3 train.py --budget-seconds 300
```

Outputs:

- `runs/best.json`
- `runs/history.jsonl`

## Workflow

1. Fetch TAO candles with `prepare.py`.
2. Run `train.py`.
3. Let the agent modify only `train.py`.
4. Keep changes only when `objective_score` improves without wrecking drawdown discipline.

## Caveats

- This is a research harness, not a profit guarantee.
- It uses public candle data, so it cannot model true historical spread or order book depth.
- It is long-only and TAO-only by design.
- It is intentionally small so an agent can iterate quickly over a weekend.
