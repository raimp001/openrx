from __future__ import annotations

import json
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from researcher.improvement import PromotionPolicy, resolve_promoted_paper_config, run_tao_improvement_cycle
from researcher.runtime_store import load_snapshot
from researcher.tao_bot import load_tao_bot_config
from tao_autoresearch.train import BacktestResult, Candidate


class TAOImprovementTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = replace(
            load_tao_bot_config(Path("data/tao_bot.json")),
            estimated_fee_bps_by_exchange={"coinbase": 40, "kraken": 20},
        )

    def test_improvement_cycle_promotes_candidate_and_updates_paper_config(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dataset_path = Path(temp_dir) / "dataset.json"
            output_dir = Path(temp_dir) / "improvement"
            report_path = output_dir / "latest.json"
            state_path = Path(temp_dir) / "improvement.db"
            dataset = _synthetic_dataset()
            dataset_path.write_text(json.dumps(dataset), encoding="utf-8")

            best_candidate = _candidate(
                fee_bps=10.0,
                slippage_bps=4.0,
                stop_atr_multiplier=1.2,
                risk_per_trade_pct=0.55,
            )
            best_result = BacktestResult(
                objective_score=25.0,
                ending_equity=130.0,
                return_pct=30.0,
                max_drawdown_pct=3.5,
                trades=14,
                wins=8,
                losses=6,
                win_rate_pct=57.14,
                fees_paid=2.1,
            )

            report, path = run_tao_improvement_cycle(
                self.config,
                dataset_path=dataset_path,
                output_dir=output_dir,
                report_path=report_path,
                state_path=state_path,
                policy=PromotionPolicy(
                    min_objective_delta=0.0,
                    min_return_pct=0.0,
                    min_trades=1,
                    max_drawdown_regression_pct=10.0,
                ),
                search_runner=lambda *_args, **_kwargs: (best_candidate, best_result, [{"candidate_index": 1}]),
            )

            self.assertEqual(path, report_path)
            self.assertEqual(report["status"], "completed")
            self.assertTrue(report["promotion"]["applied"])
            self.assertEqual(report["active_paper_candidate"]["source"], "search_candidate")

            resolved_config, metadata = resolve_promoted_paper_config(self.config, state_path=state_path)
            self.assertIsNotNone(metadata)
            self.assertEqual(str(resolved_config.stop_atr_multiplier), "1.2")
            self.assertEqual(str(resolved_config.risk_per_trade_min_pct), "0.55")
            self.assertEqual(str(resolved_config.risk_per_trade_max_pct), "0.55")
            self.assertEqual(str(resolved_config.entry_limit_buffer_bps), "4.0")

            snapshot = load_snapshot(state_path, "tao_improvement")
            self.assertIsNotNone(snapshot)
            self.assertEqual(snapshot["active_paper_candidate"]["exchange"], "kraken")

    def test_improvement_cycle_rejects_candidate_and_keeps_existing_active_candidate(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dataset_path = Path(temp_dir) / "dataset.json"
            output_dir = Path(temp_dir) / "improvement"
            report_path = output_dir / "latest.json"
            state_path = Path(temp_dir) / "improvement.db"
            dataset_path.write_text(json.dumps(_synthetic_dataset()), encoding="utf-8")

            winner = _candidate(fee_bps=10.0, slippage_bps=4.0, risk_per_trade_pct=0.55)
            winning_result = BacktestResult(
                objective_score=25.0,
                ending_equity=130.0,
                return_pct=30.0,
                max_drawdown_pct=3.5,
                trades=14,
                wins=8,
                losses=6,
                win_rate_pct=57.14,
                fees_paid=2.1,
            )
            run_tao_improvement_cycle(
                self.config,
                dataset_path=dataset_path,
                output_dir=output_dir,
                report_path=report_path,
                state_path=state_path,
                policy=PromotionPolicy(
                    min_objective_delta=0.0,
                    min_return_pct=0.0,
                    min_trades=1,
                    max_drawdown_regression_pct=10.0,
                ),
                search_runner=lambda *_args, **_kwargs: (winner, winning_result, [{"candidate_index": 1}]),
            )

            loser = _candidate(fee_bps=30.0, slippage_bps=18.0, risk_per_trade_pct=0.9)
            losing_result = BacktestResult(
                objective_score=-2.0,
                ending_equity=95.0,
                return_pct=-5.0,
                max_drawdown_pct=9.5,
                trades=4,
                wins=1,
                losses=3,
                win_rate_pct=25.0,
                fees_paid=6.5,
            )
            report, _ = run_tao_improvement_cycle(
                self.config,
                dataset_path=dataset_path,
                output_dir=output_dir,
                report_path=report_path,
                state_path=state_path,
                search_runner=lambda *_args, **_kwargs: (loser, losing_result, [{"candidate_index": 1}]),
            )

            self.assertFalse(report["promotion"]["applied"])
            self.assertEqual(
                report["active_paper_candidate"]["candidate"]["risk_per_trade_pct"],
                0.55,
            )

    def test_promoted_config_resolution_returns_base_when_no_state_exists(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config, metadata = resolve_promoted_paper_config(
                self.config,
                state_path=Path(temp_dir) / "missing.db",
            )
            self.assertIsNone(metadata)
            self.assertEqual(config.name, self.config.name)


def _candidate(**overrides: float | int | bool) -> Candidate:
    payload = {
        "entry_style": "hybrid",
        "trend_ema_period": 50,
        "signal_ema_period": 20,
        "rsi_period": 14,
        "rsi_lower": 40.0,
        "rsi_upper": 60.0,
        "breakout_lookback": 20,
        "support_lookback": 12,
        "retest_tolerance_pct": 0.7,
        "min_volume_ratio": 0.65,
        "max_single_candle_move_pct": 6.0,
        "stop_atr_multiplier": 1.35,
        "min_stop_loss_pct": 2.5,
        "max_stop_loss_pct": 4.0,
        "take_profit_1_r": 1.5,
        "take_profit_2_r": 2.0,
        "trail_after_tp1": True,
        "trail_buffer_r": 0.5,
        "risk_per_trade_pct": 0.5,
        "max_position_notional_pct": 35.0,
        "fee_bps": 20.0,
        "slippage_bps": 10.0,
    }
    payload.update(overrides)
    return Candidate(**payload)


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
