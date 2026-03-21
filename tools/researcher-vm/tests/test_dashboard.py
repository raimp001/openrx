from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from researcher.dashboard import build_tao_dashboard
from researcher.runtime_store import append_log, save_snapshot


class TAODashboardTests(unittest.TestCase):
    def test_dashboard_renders_runtime_backtest_and_autopilot_sections(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            runtime_db = root / "runtime.db"
            backtest_report = root / "tao_backtest.json"
            output_path = root / "dashboard.html"

            save_snapshot(
                runtime_db,
                "tao_state",
                {
                    "cash": "71.25",
                    "position": {
                        "exchange": "kraken",
                        "entry_price": "119.15",
                        "base_size": "0.241",
                        "stop_price": "114.98",
                        "take_profit_1": "125.40",
                        "take_profit_2": "127.65",
                    },
                    "pending_order": {
                        "phase": "entry",
                        "submission_mode": "manual",
                    },
                    "manual_kill_switch": False,
                    "manual_kill_reason": "",
                    "daily": {
                        "realized_pnl": "1.42",
                        "losses": 1,
                        "cooldown_until": "2026-03-08T21:00:00Z",
                    },
                },
            )
            append_log(
                runtime_db,
                "tao_journal",
                {
                    "timestamp_utc": "2026-03-08T18:15:00Z",
                    "type": "signal",
                    "exchange": "kraken",
                    "action": "BUY",
                    "reason": "Breakout retest cleared the entry rules.",
                },
            )
            append_log(
                runtime_db,
                "tao_journal",
                {
                    "timestamp_utc": "2026-03-08T18:16:00Z",
                    "type": "fill",
                    "phase": "entry",
                    "exchange": "kraken",
                    "decision": {
                        "action": "BUY",
                        "setup": "breakout_retest",
                        "reason": "Breakout retest cleared the entry rules.",
                    },
                    "fill_summary": {
                        "side": "BUY",
                        "base_size": "0.241",
                        "quote_size": "28.72",
                        "entry_price": "119.15",
                        "entry_fee": "0.08",
                        "total_cost": "28.80",
                        "cash_before": "100.00",
                        "cash_after": "71.20",
                        "position_closed": False,
                        "realized_pnl": "0",
                        "total_trade_pnl": None,
                    },
                },
            )
            append_log(
                runtime_db,
                "tao_journal",
                {
                    "timestamp_utc": "2026-03-08T18:30:00Z",
                    "type": "fill",
                    "exchange": "kraken",
                    "decision": {
                        "action": "SELL",
                        "setup": "take_profit_1",
                        "reason": "TAO reached the first take-profit target.",
                    },
                    "fill_summary": {
                        "side": "SELL",
                        "base_size": "0.241",
                        "exit_price": "125.40",
                        "proceeds": "30.22",
                        "exit_fee": "0.09",
                        "allocated_cost": "28.80",
                        "realized_pnl": "1.33",
                        "cash_before": "71.20",
                        "cash_after": "101.33",
                        "position_closed": True,
                        "remaining_base_size": "0",
                        "cumulative_position_realized_pnl": "1.33",
                        "total_trade_pnl": "1.33",
                        "setup": "take_profit_1",
                    },
                },
            )
            save_snapshot(
                runtime_db,
                "tao_autopilot_heartbeat:paper",
                {
                    "status": "running",
                    "iterations_completed": 4,
                    "last_trade_action": "HOLD",
                    "last_trade_reason": "No new TAO setup is active.",
                    "last_trade_exchange": "kraken",
                    "updated_at_utc": "2026-03-08T19:00:00Z",
                },
            )
            backtest_report.write_text(
                json.dumps(
                    {
                        "dataset_exchange": "kraken",
                        "product_id": "TAO-USD",
                        "selected_candidate_source": "baseline",
                        "selected_result": {
                            "ending_equity": 103.5,
                            "return_pct": 3.5,
                            "max_drawdown_pct": 1.2,
                            "trades": 5,
                            "win_rate_pct": 60.0,
                        },
                        "delta_vs_baseline": {
                            "ending_equity": 0.0,
                            "objective_score": 0.0,
                        },
                    }
                ),
                encoding="utf-8",
            )

            summary, path = build_tao_dashboard(
                mode="paper",
                runtime_db=runtime_db,
                autopilot_db=runtime_db,
                backtest_report=backtest_report,
                output_path=output_path,
            )

            self.assertEqual(path, output_path)
            self.assertTrue(output_path.exists())
            self.assertEqual(summary["metrics"]["journal_events"], "3")
            self.assertEqual(summary["performance"]["closed_trades"], "1")
            self.assertEqual(summary["performance"]["win_rate_pct"], "100.00")
            self.assertEqual(summary["performance"]["realized_pnl"], "1.33")
            self.assertEqual(summary["performance"]["fees_paid"], "0.17")
            rendered = output_path.read_text(encoding="utf-8")
            self.assertIn("TAO Trader / Local Dashboard", rendered)
            self.assertIn("Breakout retest cleared the entry rules.", rendered)
            self.assertIn("No new TAO setup is active.", rendered)
            self.assertIn("TAO reached the first take-profit target.", rendered)
            self.assertIn("Win rate", rendered)
            self.assertIn("100.00%", rendered)
            self.assertIn("Fees paid", rendered)
            self.assertIn("0.17", rendered)

    def test_dashboard_handles_missing_sources_gracefully(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            output_path = root / "dashboard.html"

            summary, path = build_tao_dashboard(
                mode="paper",
                runtime_db=root / "missing.db",
                autopilot_db=root / "missing.db",
                backtest_report=root / "missing.json",
                output_path=output_path,
            )

            self.assertEqual(path, output_path)
            self.assertEqual(summary["metrics"]["journal_events"], "0")
            rendered = output_path.read_text(encoding="utf-8")
            self.assertIn("No autopilot heartbeat found yet.", rendered)
            self.assertIn("No backtest report found yet.", rendered)
            self.assertIn("No TAO journal events recorded yet.", rendered)


if __name__ == "__main__":
    unittest.main()
