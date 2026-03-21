from __future__ import annotations

import json
import tempfile
import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path

from researcher.autopilot import run_tao_autopilot
from researcher.runtime_store import load_logs, load_snapshot
from researcher.tao_bot import load_tao_bot_config


class TAOAutopilotTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 3, 8, 18, 0, tzinfo=timezone.utc)
        self.config = replace(
            load_tao_bot_config(Path("data/tao_bot.json")),
            candles_15m=120,
            candles_1h=120,
        )

    def test_autopilot_runs_fixed_iterations_and_uses_pending_poll_interval(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "output"
            heartbeat_path = Path(temp_dir) / "heartbeat.json"
            loop_journal_path = Path(temp_dir) / "loop.jsonl"
            sleep_calls: list[float] = []
            now_provider = _clock(self.now)
            calls = {"count": 0}

            def fake_bot_runner(config, **kwargs):
                del config
                calls["count"] += 1
                report_path = output_dir / f"cycle_{calls['count']}.json"
                report_path.parent.mkdir(parents=True, exist_ok=True)
                report_path.write_text("{}", encoding="utf-8")
                if calls["count"] == 1:
                    return (
                        {
                            "mode": kwargs["mode"],
                            "exchange": "kraken",
                            "decision": {
                                "action": "BUY",
                                "reason": "Entry submitted and waiting on exchange fill.",
                            },
                            "pending_order": {
                                "phase": "entry",
                                "submission_mode": kwargs["mode"],
                                "exchange": "kraken",
                            },
                        },
                        report_path,
                    )
                return (
                    {
                        "mode": kwargs["mode"],
                        "exchange": "kraken",
                        "decision": {
                            "action": "HOLD",
                            "reason": "No new TAO setup is active.",
                        },
                    },
                    report_path,
                )

            summary, saved_path = run_tao_autopilot(
                self.config,
                mode="paper",
                output_dir=output_dir,
                heartbeat_path=heartbeat_path,
                loop_journal_path=loop_journal_path,
                interval_seconds=900.0,
                pending_interval_seconds=60.0,
                iterations=2,
                sleep_fn=sleep_calls.append,
                now_provider=now_provider,
                bot_runner=fake_bot_runner,
            )

            self.assertEqual(saved_path, heartbeat_path)
            self.assertEqual(summary["status"], "completed")
            self.assertEqual(summary["iterations_completed"], 2)
            self.assertEqual(summary["last_trade_action"], "HOLD")
            self.assertEqual(summary["last_trade_exchange"], "kraken")
            self.assertEqual(sleep_calls, [60.0])

            heartbeat = json.loads(heartbeat_path.read_text(encoding="utf-8"))
            self.assertEqual(heartbeat["iterations_completed"], 2)
            self.assertEqual(heartbeat["last_trade_reason"], "No new TAO setup is active.")

            loop_rows = [json.loads(line) for line in loop_journal_path.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(len(loop_rows), 2)
            self.assertEqual(loop_rows[0]["trade"]["action"], "BUY")
            self.assertEqual(loop_rows[0]["next_sleep_seconds"], 60.0)
            self.assertEqual(loop_rows[1]["trade"]["action"], "HOLD")

    def test_autopilot_runs_autoresearch_and_records_best_result(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "output"
            heartbeat_path = Path(temp_dir) / "heartbeat.json"
            loop_journal_path = Path(temp_dir) / "loop.jsonl"
            research_dataset = Path(temp_dir) / "dataset.json"
            research_dataset.write_text("{}", encoding="utf-8")
            research_output_dir = Path(temp_dir) / "research"

            def fake_bot_runner(config, **kwargs):
                del config, kwargs
                report_path = output_dir / "cycle.json"
                report_path.parent.mkdir(parents=True, exist_ok=True)
                report_path.write_text("{}", encoding="utf-8")
                return (
                    {
                        "mode": "paper",
                        "exchange": "coinbase",
                        "decision": {
                            "action": "HOLD",
                            "reason": "No signal this cycle.",
                        },
                    },
                    report_path,
                )

            def fake_dataset_loader(path):
                self.assertEqual(Path(path), research_dataset)
                return {
                    "exchange": "kraken",
                    "product_id": "TAO-USD",
                    "candles_15m": [],
                    "candles_1h": [],
                }

            def fake_search_runner(dataset, **kwargs):
                self.assertEqual(dataset["product_id"], "TAO-USD")
                self.assertEqual(kwargs["budget_seconds"], 30.0)
                return (
                    {"risk_per_trade_pct": 0.6, "trail_after_tp1": True},
                    {"objective_score": 1.42, "ending_equity": 103.2},
                    [{"candidate_index": 1}],
                )

            def fake_research_writer(output_dir_arg, **kwargs):
                self.assertEqual(Path(output_dir_arg), research_output_dir)
                Path(output_dir_arg).mkdir(parents=True, exist_ok=True)
                best_path = Path(output_dir_arg) / "best.json"
                history_path = Path(output_dir_arg) / "history.jsonl"
                best_path.write_text(json.dumps(kwargs["best_result"]), encoding="utf-8")
                history_path.write_text("", encoding="utf-8")
                return best_path, history_path

            summary, _ = run_tao_autopilot(
                self.config,
                mode="paper",
                output_dir=output_dir,
                heartbeat_path=heartbeat_path,
                loop_journal_path=loop_journal_path,
                iterations=1,
                enable_research=True,
                research_dataset=research_dataset,
                research_output_dir=research_output_dir,
                research_budget_seconds=30.0,
                research_max_candidates=8,
                research_seed=7,
                research_every=5,
                sleep_fn=lambda _: None,
                now_provider=_clock(self.now),
                bot_runner=fake_bot_runner,
                dataset_loader=fake_dataset_loader,
                search_runner=fake_search_runner,
                research_writer=fake_research_writer,
            )

            research = summary["last_research"]
            self.assertIsNotNone(research)
            self.assertEqual(research["status"], "completed")
            self.assertEqual(research["evaluated_candidates"], 1)
            self.assertEqual(research["best_result"]["objective_score"], 1.42)

            heartbeat = json.loads(heartbeat_path.read_text(encoding="utf-8"))
            self.assertEqual(heartbeat["last_research"]["best_candidate"]["risk_per_trade_pct"], 0.6)
            loop_row = json.loads(loop_journal_path.read_text(encoding="utf-8").strip())
            self.assertEqual(loop_row["research"]["status"], "completed")

    def test_autopilot_writes_heartbeat_and_loop_events_to_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "output"
            runtime_db = Path(temp_dir) / "autopilot.db"

            def fake_bot_runner(config, **kwargs):
                del config, kwargs
                report_path = output_dir / "cycle.json"
                report_path.parent.mkdir(parents=True, exist_ok=True)
                report_path.write_text("{}", encoding="utf-8")
                return (
                    {
                        "mode": "paper",
                        "exchange": "kraken",
                        "decision": {
                            "action": "HOLD",
                            "reason": "Waiting for the next candle close.",
                        },
                    },
                    report_path,
                )

            summary, path = run_tao_autopilot(
                self.config,
                mode="paper",
                output_dir=output_dir,
                heartbeat_path=runtime_db,
                loop_journal_path=runtime_db,
                iterations=1,
                sleep_fn=lambda _: None,
                now_provider=_clock(self.now),
                bot_runner=fake_bot_runner,
            )

            self.assertEqual(path, runtime_db)
            snapshot = load_snapshot(runtime_db, "tao_autopilot_heartbeat:paper")
            self.assertIsNotNone(snapshot)
            self.assertEqual(snapshot["last_trade_action"], "HOLD")

            loop_rows = load_logs(runtime_db, "tao_autopilot_journal:paper")
            self.assertEqual(len(loop_rows), 1)
            self.assertEqual(loop_rows[0]["trade"]["reason"], "Waiting for the next candle close.")
            self.assertEqual(summary["status"], "completed")

    def test_autopilot_uses_promoted_paper_candidate_when_available(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "output"
            heartbeat_path = Path(temp_dir) / "heartbeat.json"
            loop_journal_path = Path(temp_dir) / "loop.jsonl"

            def fake_config_resolver(config):
                promoted = replace(
                    config,
                    trend_ema_period=63,
                    signal_ema_period=17,
                )
                return promoted, {
                    "source": "search_candidate",
                    "exchange": "kraken",
                    "promoted_at_utc": "2026-03-08T18:00:00Z",
                }

            def fake_bot_runner(config, **kwargs):
                self.assertEqual(config.trend_ema_period, 63)
                self.assertEqual(config.signal_ema_period, 17)
                report_path = output_dir / "cycle.json"
                report_path.parent.mkdir(parents=True, exist_ok=True)
                report_path.write_text("{}", encoding="utf-8")
                return (
                    {
                        "mode": kwargs["mode"],
                        "exchange": "kraken",
                        "decision": {
                            "action": "HOLD",
                            "reason": "Promoted paper config is active.",
                        },
                    },
                    report_path,
                )

            summary, _ = run_tao_autopilot(
                self.config,
                mode="paper",
                output_dir=output_dir,
                heartbeat_path=heartbeat_path,
                loop_journal_path=loop_journal_path,
                iterations=1,
                sleep_fn=lambda _: None,
                now_provider=_clock(self.now),
                bot_runner=fake_bot_runner,
                config_resolver=fake_config_resolver,
            )

            self.assertEqual(summary["paper_candidate_source"], "search_candidate")
            loop_row = json.loads(loop_journal_path.read_text(encoding="utf-8").strip())
            self.assertEqual(loop_row["paper_candidate"]["exchange"], "kraken")


def _clock(start: datetime):
    current = {"value": start}

    def provider() -> datetime:
        active = current["value"]
        current["value"] = active + timedelta(minutes=15)
        return active

    return provider
