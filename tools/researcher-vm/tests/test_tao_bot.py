from __future__ import annotations

import json
import os
import tempfile
import unittest
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from researcher.runtime_store import load_logs
from researcher.tao_bot import (
    load_tao_bot_config,
    load_tao_state,
    reconcile_tao_pending_order,
    run_tao_bot,
    scan_tao_markets,
    set_tao_kill_switch,
)


class TAOBotTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 3, 8, 18, 0, tzinfo=timezone.utc)
        self.config = replace(
            load_tao_bot_config(Path("data/tao_bot.json")),
            candles_15m=120,
            candles_1h=120,
            estimated_fee_bps_by_exchange={"coinbase": 40, "kraken": 20},
        )

    def test_scan_prefers_kraken_when_both_venues_are_valid(self) -> None:
        report = scan_tao_markets(
            self.config,
            client_factory=_factory_for_market(self.now),
            now=self.now,
        )

        self.assertEqual(report["selected_action"], "BUY")
        self.assertEqual(report["selected_exchange"], "kraken")

    def test_entry_style_can_force_dip_buy_instead_of_hybrid_breakout(self) -> None:
        hybrid_report = scan_tao_markets(
            self.config,
            client_factory=_factory_for_market(self.now),
            now=self.now,
        )
        dip_buy_report = scan_tao_markets(
            replace(self.config, entry_style="dip_buy"),
            client_factory=_factory_for_market(self.now),
            now=self.now,
        )

        hybrid_kraken = next(venue for venue in hybrid_report["venues"] if venue["exchange"] == "kraken")
        dip_buy_kraken = next(venue for venue in dip_buy_report["venues"] if venue["exchange"] == "kraken")
        self.assertEqual(hybrid_kraken["setup"], "breakout_retest")
        self.assertEqual(dip_buy_kraken["setup"], "dip_buy")

    def test_run_tao_bot_enters_paper_position_and_writes_journal(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_path = Path(temp_dir) / "state.json"
            journal_path = Path(temp_dir) / "journal.jsonl"
            output_dir = Path(temp_dir) / "output"

            report, output_path = run_tao_bot(
                self.config,
                mode="paper",
                output_dir=output_dir,
                state_path=state_path,
                journal_path=journal_path,
                client_factory=_factory_for_market(self.now),
                now=self.now,
            )

            self.assertEqual(report["decision"]["action"], "BUY")
            self.assertEqual(report["decision"]["exchange"], "kraken")
            self.assertTrue(output_path.exists())

            state = load_tao_state(state_path, self.config, now=self.now)
            self.assertIsNotNone(state["position"])
            self.assertEqual(state["position"]["exchange"], "kraken")

            journal_lines = journal_path.read_text(encoding="utf-8").strip().splitlines()
            self.assertGreaterEqual(len(journal_lines), 2)
            first_event = json.loads(journal_lines[0])
            self.assertEqual(first_event["type"], "signal")

    def test_run_tao_bot_persists_state_and_journal_to_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime_db = Path(temp_dir) / "tao_runtime.db"
            output_dir = Path(temp_dir) / "output"

            report, output_path = run_tao_bot(
                self.config,
                mode="paper",
                output_dir=output_dir,
                state_path=runtime_db,
                journal_path=runtime_db,
                client_factory=_factory_for_market(self.now),
                now=self.now,
            )

            self.assertEqual(report["decision"]["action"], "BUY")
            self.assertTrue(output_path.exists())

            state = load_tao_state(runtime_db, self.config, now=self.now)
            self.assertIsNotNone(state["position"])

            journal_rows = load_logs(runtime_db, "tao_journal")
            self.assertGreaterEqual(len(journal_rows), 2)
            self.assertEqual(journal_rows[0]["type"], "signal")

    def test_run_tao_bot_stops_after_loss_and_sets_cooldown(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_path = Path(temp_dir) / "state.json"
            journal_path = Path(temp_dir) / "journal.jsonl"
            output_dir = Path(temp_dir) / "output"

            run_tao_bot(
                self.config,
                mode="paper",
                output_dir=output_dir,
                state_path=state_path,
                journal_path=journal_path,
                client_factory=_factory_for_market(self.now),
                now=self.now,
            )

            exit_now = self.now.replace(minute=15)
            report, _ = run_tao_bot(
                self.config,
                mode="paper",
                output_dir=output_dir,
                state_path=state_path,
                journal_path=journal_path,
                client_factory=_factory_for_stop(exit_now),
                now=exit_now,
            )

            self.assertEqual(report["decision"]["action"], "SELL")
            self.assertEqual(report["decision"]["setup"], "stop_loss")

            state = load_tao_state(state_path, self.config, now=exit_now)
            self.assertIsNone(state["position"])
            self.assertEqual(state["daily"]["losses"], 1)
            self.assertIsNotNone(state["daily"]["cooldown_until"])

    def test_kill_switch_blocks_new_entries(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_path = Path(temp_dir) / "state.json"
            journal_path = Path(temp_dir) / "journal.jsonl"
            output_dir = Path(temp_dir) / "output"

            set_tao_kill_switch(
                state_path,
                self.config,
                enabled=True,
                reason="Operator override.",
                now=self.now,
            )

            report, _ = run_tao_bot(
                self.config,
                mode="paper",
                output_dir=output_dir,
                state_path=state_path,
                journal_path=journal_path,
                client_factory=_factory_for_market(self.now),
                now=self.now,
            )

            self.assertEqual(report["decision"]["action"], "HOLD")
            self.assertIn("Operator override.", report["decision"]["reason"])

    def test_manual_mode_creates_pending_entry_without_position(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_path = Path(temp_dir) / "state.json"
            journal_path = Path(temp_dir) / "journal.jsonl"
            output_dir = Path(temp_dir) / "output"

            report, _ = run_tao_bot(
                self.config,
                mode="manual",
                output_dir=output_dir,
                state_path=state_path,
                journal_path=journal_path,
                client_factory=_factory_for_market(self.now),
                now=self.now,
            )

            self.assertEqual(report["decision"]["action"], "BUY")
            self.assertIn("pending_order", report)
            state = load_tao_state(state_path, self.config, now=self.now)
            self.assertIsNone(state["position"])
            self.assertIsNotNone(state["pending_order"])
            self.assertEqual(state["pending_order"]["submission_mode"], "manual")

    def test_pending_order_blocks_followup_runs_until_reconciled(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_path = Path(temp_dir) / "state.json"
            journal_path = Path(temp_dir) / "journal.jsonl"
            output_dir = Path(temp_dir) / "output"

            run_tao_bot(
                self.config,
                mode="manual",
                output_dir=output_dir,
                state_path=state_path,
                journal_path=journal_path,
                client_factory=_factory_for_market(self.now),
                now=self.now,
            )

            blocked_report, _ = run_tao_bot(
                self.config,
                mode="manual",
                output_dir=output_dir,
                state_path=state_path,
                journal_path=journal_path,
                client_factory=_factory_for_market(self.now),
                now=self.now,
            )

            self.assertEqual(blocked_report["decision"]["action"], "HOLD")
            self.assertIn("pending", blocked_report["decision"]["reason"].lower())

    def test_reconcile_manual_entry_fill_creates_position(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_path = Path(temp_dir) / "state.json"
            journal_path = Path(temp_dir) / "journal.jsonl"
            output_dir = Path(temp_dir) / "output"

            run_tao_bot(
                self.config,
                mode="manual",
                output_dir=output_dir,
                state_path=state_path,
                journal_path=journal_path,
                client_factory=_factory_for_market(self.now),
                now=self.now,
            )

            reconcile_report, _ = reconcile_tao_pending_order(
                state_path,
                self.config,
                status="filled",
                fill_price="119.10",
                journal_path=journal_path,
                output_dir=output_dir,
                now=self.now,
            )

            self.assertEqual(reconcile_report["decision"]["status"], "filled")
            state = load_tao_state(state_path, self.config, now=self.now)
            self.assertIsNone(state["pending_order"])
            self.assertIsNotNone(state["position"])
            self.assertEqual(state["position"]["entry_price"], "119.1")

    def test_reconcile_manual_cancel_clears_pending_order(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_path = Path(temp_dir) / "state.json"
            journal_path = Path(temp_dir) / "journal.jsonl"
            output_dir = Path(temp_dir) / "output"

            run_tao_bot(
                self.config,
                mode="manual",
                output_dir=output_dir,
                state_path=state_path,
                journal_path=journal_path,
                client_factory=_factory_for_market(self.now),
                now=self.now,
            )

            reconcile_report, _ = reconcile_tao_pending_order(
                state_path,
                self.config,
                status="canceled",
                journal_path=journal_path,
                output_dir=output_dir,
                now=self.now,
            )

            self.assertEqual(reconcile_report["decision"]["status"], "canceled")
            state = load_tao_state(state_path, self.config, now=self.now)
            self.assertIsNone(state["pending_order"])
            self.assertIsNone(state["position"])

    def test_live_mode_auto_reconciles_filled_exchange_order(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_path = Path(temp_dir) / "state.json"
            journal_path = Path(temp_dir) / "journal.jsonl"
            output_dir = Path(temp_dir) / "output"
            live_factory = _factory_for_live_fill(self.now)

            with patch.dict(os.environ, {"KRAKEN_ENABLE_LIVE_TRADING": "1"}, clear=False):
                first_report, _ = run_tao_bot(
                    self.config,
                    mode="live",
                    output_dir=output_dir,
                    state_path=state_path,
                    journal_path=journal_path,
                    client_factory=live_factory,
                    now=self.now,
                    live_ack="I_ACCEPT_REAL_TRADES",
                )

                self.assertIn("pending_order", first_report)
                state = load_tao_state(state_path, self.config, now=self.now)
                self.assertIsNone(state["position"])
                self.assertIsNotNone(state["pending_order"])
                self.assertEqual(state["pending_order"]["submission_mode"], "live")

                second_report, _ = run_tao_bot(
                    self.config,
                    mode="live",
                    output_dir=output_dir,
                    state_path=state_path,
                    journal_path=journal_path,
                    client_factory=live_factory,
                    now=self.now.replace(minute=15),
                    live_ack="I_ACCEPT_REAL_TRADES",
                )

            self.assertEqual(second_report["decision"]["reason"], "Live TAO order was auto-reconciled from exchange status.")
            state = load_tao_state(state_path, self.config, now=self.now)
            self.assertIsNone(state["pending_order"])
            self.assertIsNotNone(state["position"])
            self.assertEqual(state["position"]["exchange"], "kraken")


class FakeTAOClient:
    def __init__(
        self,
        *,
        exchange_name: str,
        product: dict,
        ticker: dict,
        candles_15m: list[dict],
        candles_1h: list[dict],
        accounts: dict | None = None,
        live_order_payload: dict | None = None,
        order_status_sequence: list[dict] | None = None,
    ) -> None:
        self.exchange_name = exchange_name
        self.product = product
        self.ticker = ticker
        self.accounts = accounts or {"accounts": []}
        self.candles = {
            "15m": candles_15m,
            "1h": candles_1h,
        }
        self.live_order_payload = live_order_payload or {"success": True}
        self.order_status_sequence = list(order_status_sequence or [])

    def list_accounts(self, limit: int = 100) -> dict:
        del limit
        return json.loads(json.dumps(self.accounts))

    def get_product(self, product_id: str) -> dict:
        self._assert_product(product_id)
        return dict(self.product)

    def get_ticker(self, product_id: str, limit: int = 50) -> dict:
        del limit
        self._assert_product(product_id)
        return dict(self.ticker)

    def get_candles(self, product_id: str, granularity: str, limit: int = 100) -> dict:
        self._assert_product(product_id)
        return {"candles": list(self.candles[granularity])[-limit:]}

    def preview_market_order(self, product_id: str, side: str, *, quote_size=None, base_size=None, retail_portfolio_id=None) -> dict:
        del product_id, side, quote_size, base_size, retail_portfolio_id
        return {"errs": [], "preview_id": "preview-market"}

    def create_market_order(
        self,
        product_id: str,
        side: str,
        *,
        quote_size=None,
        base_size=None,
        retail_portfolio_id=None,
        preview_id=None,
        client_order_id=None,
    ) -> dict:
        del product_id, side, quote_size, base_size, retail_portfolio_id, preview_id, client_order_id
        return json.loads(json.dumps(self.live_order_payload))

    def preview_limit_order(
        self,
        product_id: str,
        side: str,
        *,
        base_size: str,
        limit_price: str,
        retail_portfolio_id=None,
        post_only: bool = False,
    ) -> dict:
        del product_id, side, base_size, limit_price, retail_portfolio_id, post_only
        return {"errs": [], "preview_id": "preview-limit"}

    def create_limit_order(
        self,
        product_id: str,
        side: str,
        *,
        base_size: str,
        limit_price: str,
        retail_portfolio_id=None,
        post_only: bool = False,
        preview_id=None,
        client_order_id=None,
    ) -> dict:
        del product_id, side, base_size, limit_price, retail_portfolio_id, post_only, preview_id, client_order_id
        return json.loads(json.dumps(self.live_order_payload))

    def get_order(self, *, order_id: str | None = None, client_order_id: str | None = None) -> dict:
        del client_order_id
        if not order_id:
            raise AssertionError("order_id is required")
        if not self.order_status_sequence:
            raise AssertionError("No order status queued")
        return json.loads(json.dumps(self.order_status_sequence.pop(0)))

    def _assert_product(self, product_id: str) -> None:
        if product_id != "TAO-USD":
            raise AssertionError(f"Unexpected product: {product_id}")


def _factory_for_market(now: datetime):
    market = {
        "coinbase": FakeTAOClient(
            exchange_name="coinbase",
            product=_product_payload("online"),
            ticker=_ticker_payload(best_bid="118.90", best_ask="119.60"),
            candles_15m=_bullish_15m_candles(now),
            candles_1h=_bullish_1h_candles(now),
        ),
        "kraken": FakeTAOClient(
            exchange_name="kraken",
            product=_product_payload("online", quote_min_size="5"),
            ticker=_ticker_payload(best_bid="119.05", best_ask="119.25"),
            candles_15m=_bullish_15m_candles(now),
            candles_1h=_bullish_1h_candles(now),
        ),
    }
    return lambda exchange: market[exchange]


def _factory_for_stop(now: datetime):
    market = {
        "kraken": FakeTAOClient(
            exchange_name="kraken",
            product=_product_payload("online", quote_min_size="5"),
            ticker=_ticker_payload(best_bid="114.40", best_ask="114.60"),
            candles_15m=_stop_15m_candles(now),
            candles_1h=_bullish_1h_candles(now),
        )
    }
    return lambda exchange: market[exchange]


def _factory_for_live_fill(now: datetime):
    live_accounts = {
        "accounts": [
            {"currency": "USD", "available_balance": {"value": "100"}, "hold": {"value": "0"}, "type": "spot"},
            {"currency": "TAO", "available_balance": {"value": "0"}, "hold": {"value": "0"}, "type": "spot"},
        ]
    }
    market = {
        "coinbase": FakeTAOClient(
            exchange_name="coinbase",
            product=_product_payload("online"),
            ticker=_ticker_payload(best_bid="118.90", best_ask="119.60"),
            candles_15m=_bullish_15m_candles(now),
            candles_1h=_bullish_1h_candles(now),
            accounts=live_accounts,
        ),
        "kraken": FakeTAOClient(
            exchange_name="kraken",
            product=_product_payload("online", quote_min_size="5"),
            ticker=_ticker_payload(best_bid="119.05", best_ask="119.25"),
            candles_15m=_bullish_15m_candles(now),
            candles_1h=_bullish_1h_candles(now),
            accounts=live_accounts,
            live_order_payload={"result": {"txid": ["KRKN-ORDER-1"]}},
            order_status_sequence=[
                {
                    "exchange": "kraken",
                    "order_id": "KRKN-ORDER-1",
                    "client_order_id": None,
                    "status": "filled",
                    "raw_status": "closed",
                    "side": "BUY",
                    "product_id": "TAO-USD",
                    "average_filled_price": "119.15",
                    "filled_base_size": "0.257",
                    "filled_quote_size": "30.62155",
                }
            ],
        ),
    }
    return lambda exchange: market[exchange]


def _product_payload(status: str, *, quote_min_size: str = "10") -> dict:
    return {
        "status": status,
        "base_increment": "0.001",
        "quote_increment": "0.01",
        "base_min_size": "0.001",
        "quote_min_size": quote_min_size,
        "volume_24h": "5000",
        "volume_percentage_change_24h": "5",
    }


def _ticker_payload(*, best_bid: str, best_ask: str) -> dict:
    return {
        "best_bid": best_bid,
        "best_ask": best_ask,
        "last_price": best_ask,
        "volume_24h": "5000",
        "trades": [
            {"price": best_bid, "size": "1", "time": "1"},
            {"price": best_ask, "size": "1", "time": "2"},
        ],
    }


def _bullish_1h_candles(now: datetime) -> list[dict]:
    cutoff = int(now.timestamp()) - (int(now.timestamp()) % 3600)
    candles = []
    start = cutoff - (120 * 3600)
    price = 86.0
    for index in range(120):
        open_price = price
        close_price = price + 0.25
        candles.append(
            {
                "start": start + (index * 3600),
                "open": f"{open_price:.2f}",
                "high": f"{close_price + 0.2:.2f}",
                "low": f"{open_price - 0.2:.2f}",
                "close": f"{close_price:.2f}",
                "volume": "120",
            }
        )
        price = close_price
    return candles


def _bullish_15m_candles(now: datetime) -> list[dict]:
    cutoff = int(now.timestamp()) - (int(now.timestamp()) % 900)
    candles = []
    start = cutoff - (120 * 900)
    price = 96.0
    for index in range(118):
        open_price = price
        close_price = price + 0.17
        candles.append(
            {
                "start": start + (index * 900),
                "open": f"{open_price:.2f}",
                "high": f"{close_price + 0.25:.2f}",
                "low": f"{open_price - 0.20:.2f}",
                "close": f"{close_price:.2f}",
                "volume": "220",
            }
        )
        price = close_price

    candles.append(
        {
            "start": start + (118 * 900),
            "open": "116.30",
            "high": "119.70",
            "low": "116.00",
            "close": "119.20",
            "volume": "340",
        }
    )
    candles.append(
        {
            "start": start + (119 * 900),
            "open": "117.40",
            "high": "119.40",
            "low": "116.60",
            "close": "118.20",
            "volume": "360",
        }
    )
    return candles


def _stop_15m_candles(now: datetime) -> list[dict]:
    candles = _bullish_15m_candles(now)
    candles[-1] = {
        "start": candles[-1]["start"],
        "open": "118.10",
        "high": "118.30",
        "low": "113.80",
        "close": "114.20",
        "volume": "380",
    }
    return candles


if __name__ == "__main__":
    unittest.main()
