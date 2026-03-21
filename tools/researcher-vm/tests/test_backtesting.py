from __future__ import annotations

import json
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from researcher.backtesting import baseline_candidate, load_candidate_definition, run_tao_backtest
from researcher.tao_bot import load_tao_bot_config


class TAOBacktestingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = replace(
            load_tao_bot_config(Path("data/tao_bot.json")),
            estimated_fee_bps_by_exchange={"coinbase": 40, "kraken": 20},
        )

    def test_run_tao_backtest_writes_baseline_report(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dataset_path = Path(temp_dir) / "dataset.json"
            output_path = Path(temp_dir) / "backtest.json"
            dataset_path.write_text(json.dumps(_synthetic_dataset()), encoding="utf-8")

            report, path = run_tao_backtest(
                self.config,
                dataset_path=dataset_path,
                output_path=output_path,
            )

            self.assertEqual(path, output_path)
            self.assertTrue(output_path.exists())
            self.assertEqual(report["selected_candidate_source"], "baseline")
            self.assertIn("baseline_result", report)
            self.assertIn("selected_result", report)
            self.assertEqual(report["selected_result"], report["baseline_result"])

    def test_load_candidate_definition_accepts_best_json_payload(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            candidate_path = Path(temp_dir) / "best.json"
            baseline = baseline_candidate(self.config, exchange="kraken")
            candidate_path.write_text(
                json.dumps(
                    {
                        "best_candidate": {
                            **baseline.__dict__,
                            "risk_per_trade_pct": 0.55,
                            "fee_bps": 14.0,
                        }
                    }
                ),
                encoding="utf-8",
            )

            candidate = load_candidate_definition(candidate_path)

            self.assertEqual(candidate.risk_per_trade_pct, 0.55)
            self.assertEqual(candidate.fee_bps, 14.0)
            self.assertTrue(candidate.trail_after_tp1)

    def test_load_candidate_definition_backfills_missing_entry_style(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            candidate_path = Path(temp_dir) / "best.json"
            baseline = baseline_candidate(self.config, exchange="kraken")
            legacy_payload = dict(baseline.__dict__)
            legacy_payload.pop("entry_style")
            candidate_path.write_text(
                json.dumps({"best_candidate": legacy_payload}),
                encoding="utf-8",
            )

            candidate = load_candidate_definition(candidate_path)

            self.assertEqual(candidate.entry_style, "hybrid")

    def test_run_tao_backtest_compares_candidate_against_baseline(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dataset_path = Path(temp_dir) / "dataset.json"
            candidate_path = Path(temp_dir) / "candidate.json"
            output_path = Path(temp_dir) / "backtest.json"
            dataset_path.write_text(json.dumps(_synthetic_dataset()), encoding="utf-8")

            baseline = baseline_candidate(self.config, exchange="kraken")
            candidate_path.write_text(
                json.dumps(
                    {
                        "best_candidate": {
                            **baseline.__dict__,
                            "fee_bps": 10.0,
                            "slippage_bps": 5.0,
                        }
                    }
                ),
                encoding="utf-8",
            )

            report, _ = run_tao_backtest(
                self.config,
                dataset_path=dataset_path,
                output_path=output_path,
                candidate_path=candidate_path,
            )

            self.assertEqual(report["selected_candidate_source"], str(candidate_path))
            self.assertIn("delta_vs_baseline", report)
            self.assertEqual(report["selected_candidate"]["fee_bps"], 10.0)
            self.assertEqual(report["selected_candidate"]["slippage_bps"], 5.0)


def _synthetic_dataset() -> dict:
    candles_15m = []
    candles_1h = []
    start_15m = 1_700_000_000
    start_1h = 1_700_000_000
    price = 100.0
    for index in range(160):
        drift = 0.12 if index < 90 else (-0.08 if index < 120 else 0.18)
        open_price = price
        close_price = price + drift
        candles_15m.append(
            {
                "start": start_15m + (index * 900),
                "open": f"{open_price:.4f}",
                "high": f"{close_price + 0.25:.4f}",
                "low": f"{open_price - 0.25:.4f}",
                "close": f"{close_price:.4f}",
                "volume": "150.0",
            }
        )
        price = close_price

    price = 100.0
    for index in range(80):
        drift = 0.4 if index < 45 else (-0.15 if index < 60 else 0.5)
        open_price = price
        close_price = price + drift
        candles_1h.append(
            {
                "start": start_1h + (index * 3600),
                "open": f"{open_price:.4f}",
                "high": f"{close_price + 0.35:.4f}",
                "low": f"{open_price - 0.35:.4f}",
                "close": f"{close_price:.4f}",
                "volume": "500.0",
            }
        )
        price = close_price

    return {
        "exchange": "kraken",
        "product_id": "TAO-USD",
        "candles_15m": candles_15m,
        "candles_1h": candles_1h,
    }


if __name__ == "__main__":
    unittest.main()
