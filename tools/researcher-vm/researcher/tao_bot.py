from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import ROUND_CEILING, ROUND_DOWN, Decimal
from pathlib import Path
from typing import Any, Callable, Mapping

from researcher.alerts import send_telegram_alert
from researcher.exchange import ExchangeAPIError, TradingClient, create_exchange_client, normalize_exchange_name
from researcher.runtime_store import append_log, is_sqlite_path, load_snapshot, save_snapshot
from researcher.trading import balances_by_currency, quantize_string, require_live_ack


DEFAULT_TAO_CONFIG = Path("data/tao_bot.json")
DEFAULT_TAO_OUTPUT_DIR = Path("output/tao_bot")


@dataclass(frozen=True)
class TAOBotConfig:
    name: str
    product_id: str
    base_currency: str
    quote_currency: str
    entry_style: str
    exchanges: tuple[str, ...]
    starting_capital: Decimal
    reserve_cash: Decimal
    risk_per_trade_min_pct: Decimal
    risk_per_trade_max_pct: Decimal
    max_position_notional: Decimal
    max_position_notional_pct: Decimal
    min_stop_loss_pct: Decimal
    max_stop_loss_pct: Decimal
    stop_atr_multiplier: Decimal
    take_profit_1_r: Decimal
    take_profit_2_r: Decimal
    trail_after_tp1: bool
    trail_stop_buffer_r: Decimal
    max_spread_bps_by_exchange: dict[str, Decimal]
    estimated_fee_bps_by_exchange: dict[str, Decimal]
    min_quote_order_by_exchange: dict[str, Decimal]
    min_volume_ratio: Decimal
    low_volume_factor: Decimal
    min_quote_volume_24h: Decimal
    sharp_volume_drop_24h_pct: Decimal
    max_single_candle_move_pct: Decimal
    min_net_reward_to_risk: Decimal
    max_losses_per_day: int
    max_daily_drawdown_pct: Decimal
    cooldown_after_loss_minutes: int
    trend_ema_period: int
    signal_ema_period: int
    rsi_period: int
    macd_fast: int
    macd_slow: int
    macd_signal: int
    atr_period: int
    support_lookback_15m: int
    resistance_lookback_15m: int
    recent_breakout_lookback: int
    retest_tolerance_pct: Decimal
    candles_15m: int
    candles_1h: int
    entry_limit_buffer_bps: Decimal
    emergency_exit_slippage_bps: Decimal
    post_only_entries: bool


def default_tao_state_path(mode: str) -> Path:
    return Path("runtime") / f"tao_bot_{mode.lower()}.db"


def default_tao_journal_path(mode: str) -> Path:
    return default_tao_state_path(mode)


def load_tao_bot_config(path: str | Path) -> TAOBotConfig:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    product_id = str(payload.get("product_id", "TAO-USD")).upper()
    base_currency, quote_currency = product_id.split("-", maxsplit=1)
    exchanges = tuple(normalize_exchange_name(exchange) for exchange in payload.get("exchanges", ["coinbase", "kraken"]))

    return TAOBotConfig(
        name=str(payload.get("name", "TAO Spot Swing Bot")),
        product_id=product_id,
        base_currency=str(payload.get("base_currency", base_currency)).upper(),
        quote_currency=str(payload.get("quote_currency", quote_currency)).upper(),
        entry_style=str(payload.get("entry_style", "hybrid")).lower(),
        exchanges=exchanges,
        starting_capital=Decimal(str(payload.get("starting_capital", "100"))),
        reserve_cash=Decimal(str(payload.get("reserve_cash", "5"))),
        risk_per_trade_min_pct=Decimal(str(payload.get("risk_per_trade_min_pct", "0.5"))),
        risk_per_trade_max_pct=Decimal(str(payload.get("risk_per_trade_max_pct", "1.0"))),
        max_position_notional=Decimal(str(payload.get("max_position_notional", "35"))),
        max_position_notional_pct=Decimal(str(payload.get("max_position_notional_pct", "35"))),
        min_stop_loss_pct=Decimal(str(payload.get("min_stop_loss_pct", "2.5"))),
        max_stop_loss_pct=Decimal(str(payload.get("max_stop_loss_pct", "4.0"))),
        stop_atr_multiplier=Decimal(str(payload.get("stop_atr_multiplier", "1.35"))),
        take_profit_1_r=Decimal(str(payload.get("take_profit_1_r", "1.5"))),
        take_profit_2_r=Decimal(str(payload.get("take_profit_2_r", "2.0"))),
        trail_after_tp1=_coerce_bool(payload.get("trail_after_tp1", True)),
        trail_stop_buffer_r=Decimal(str(payload.get("trail_stop_buffer_r", "0.5"))),
        max_spread_bps_by_exchange=_decimal_mapping(
            payload.get("max_spread_bps_by_exchange"),
            {
                "coinbase": Decimal("70"),
                "kraken": Decimal("55"),
            },
        ),
        estimated_fee_bps_by_exchange=_decimal_mapping(
            payload.get("estimated_fee_bps_by_exchange"),
            {
                "coinbase": Decimal("60"),
                "kraken": Decimal("40"),
            },
        ),
        min_quote_order_by_exchange=_decimal_mapping(
            payload.get("min_quote_order_by_exchange"),
            {
                "coinbase": Decimal("10"),
                "kraken": Decimal("5"),
            },
        ),
        min_volume_ratio=Decimal(str(payload.get("min_volume_ratio", "0.65"))),
        low_volume_factor=Decimal(str(payload.get("low_volume_factor", "0.55"))),
        min_quote_volume_24h=Decimal(str(payload.get("min_quote_volume_24h", "0"))),
        sharp_volume_drop_24h_pct=Decimal(str(payload.get("sharp_volume_drop_24h_pct", "-20"))),
        max_single_candle_move_pct=Decimal(str(payload.get("max_single_candle_move_pct", "6"))),
        min_net_reward_to_risk=Decimal(str(payload.get("min_net_reward_to_risk", "1.15"))),
        max_losses_per_day=int(payload.get("max_losses_per_day", 2)),
        max_daily_drawdown_pct=Decimal(str(payload.get("max_daily_drawdown_pct", "3.0"))),
        cooldown_after_loss_minutes=int(payload.get("cooldown_after_loss_minutes", 180)),
        trend_ema_period=int(payload.get("trend_ema_period", 50)),
        signal_ema_period=int(payload.get("signal_ema_period", 20)),
        rsi_period=int(payload.get("rsi_period", 14)),
        macd_fast=int(payload.get("macd_fast", 12)),
        macd_slow=int(payload.get("macd_slow", 26)),
        macd_signal=int(payload.get("macd_signal", 9)),
        atr_period=int(payload.get("atr_period", 14)),
        support_lookback_15m=int(payload.get("support_lookback_15m", 12)),
        resistance_lookback_15m=int(payload.get("resistance_lookback_15m", 20)),
        recent_breakout_lookback=int(payload.get("recent_breakout_lookback", 4)),
        retest_tolerance_pct=Decimal(str(payload.get("retest_tolerance_pct", "0.7"))),
        candles_15m=int(payload.get("candles_15m", 120)),
        candles_1h=int(payload.get("candles_1h", 160)),
        entry_limit_buffer_bps=Decimal(str(payload.get("entry_limit_buffer_bps", "10"))),
        emergency_exit_slippage_bps=Decimal(str(payload.get("emergency_exit_slippage_bps", "15"))),
        post_only_entries=_coerce_bool(payload.get("post_only_entries", False)),
    )


def tao_config_to_dict(config: TAOBotConfig) -> dict[str, Any]:
    return _stringify(
        {
            "name": config.name,
            "product_id": config.product_id,
            "base_currency": config.base_currency,
            "quote_currency": config.quote_currency,
            "entry_style": config.entry_style,
            "exchanges": list(config.exchanges),
            "starting_capital": config.starting_capital,
            "reserve_cash": config.reserve_cash,
            "risk_per_trade_min_pct": config.risk_per_trade_min_pct,
            "risk_per_trade_max_pct": config.risk_per_trade_max_pct,
            "max_position_notional": config.max_position_notional,
            "max_position_notional_pct": config.max_position_notional_pct,
            "min_stop_loss_pct": config.min_stop_loss_pct,
            "max_stop_loss_pct": config.max_stop_loss_pct,
            "stop_atr_multiplier": config.stop_atr_multiplier,
            "take_profit_1_r": config.take_profit_1_r,
            "take_profit_2_r": config.take_profit_2_r,
            "trail_after_tp1": config.trail_after_tp1,
            "trail_stop_buffer_r": config.trail_stop_buffer_r,
            "max_spread_bps_by_exchange": config.max_spread_bps_by_exchange,
            "estimated_fee_bps_by_exchange": config.estimated_fee_bps_by_exchange,
            "min_quote_order_by_exchange": config.min_quote_order_by_exchange,
            "min_volume_ratio": config.min_volume_ratio,
            "low_volume_factor": config.low_volume_factor,
            "min_quote_volume_24h": config.min_quote_volume_24h,
            "sharp_volume_drop_24h_pct": config.sharp_volume_drop_24h_pct,
            "max_single_candle_move_pct": config.max_single_candle_move_pct,
            "min_net_reward_to_risk": config.min_net_reward_to_risk,
            "max_losses_per_day": config.max_losses_per_day,
            "max_daily_drawdown_pct": config.max_daily_drawdown_pct,
            "cooldown_after_loss_minutes": config.cooldown_after_loss_minutes,
            "trend_ema_period": config.trend_ema_period,
            "signal_ema_period": config.signal_ema_period,
            "rsi_period": config.rsi_period,
            "macd_fast": config.macd_fast,
            "macd_slow": config.macd_slow,
            "macd_signal": config.macd_signal,
            "atr_period": config.atr_period,
            "support_lookback_15m": config.support_lookback_15m,
            "resistance_lookback_15m": config.resistance_lookback_15m,
            "recent_breakout_lookback": config.recent_breakout_lookback,
            "retest_tolerance_pct": config.retest_tolerance_pct,
            "candles_15m": config.candles_15m,
            "candles_1h": config.candles_1h,
            "entry_limit_buffer_bps": config.entry_limit_buffer_bps,
            "emergency_exit_slippage_bps": config.emergency_exit_slippage_bps,
            "post_only_entries": config.post_only_entries,
        }
    )


def load_tao_state(path: str | Path | None, config: TAOBotConfig, *, now: datetime | None = None) -> dict[str, Any]:
    active_now = now or datetime.now(timezone.utc)
    if path is None:
        return _initial_state(config, active_now)
    payload = load_snapshot(path, "tao_state")
    if payload is None:
        return _initial_state(config, active_now)
    return _merge_state_defaults(payload, config, active_now)


def save_tao_state(path: str | Path, state: Mapping[str, Any]) -> Path:
    return save_snapshot(path, "tao_state", state)


def scan_tao_markets(
    config: TAOBotConfig,
    *,
    exchange: str = "auto",
    state_path: str | Path | None = None,
    client_factory: Callable[[str], TradingClient] = create_exchange_client,
    now: datetime | None = None,
) -> dict[str, Any]:
    active_now = now or datetime.now(timezone.utc)
    state = load_tao_state(state_path, config, now=active_now)
    position = state.get("position")
    if position:
        exchanges = [str(position["exchange"])]
    elif exchange == "auto":
        exchanges = list(config.exchanges)
    else:
        exchanges = [normalize_exchange_name(exchange)]

    venues = []
    errors = []
    for venue in exchanges:
        client = client_factory(venue)
        try:
            snapshot = _build_market_snapshot(client, config, venue, active_now)
            venues.append(_evaluate_entry_candidate(config, snapshot, state))
        except ExchangeAPIError as exc:
            errors.append({"exchange": venue, "error": str(exc)})
            venues.append(
                {
                    "exchange": venue,
                    "action": "HOLD",
                    "setup": "none",
                    "reason": f"API failure: {exc}",
                    "selection_score": "0",
                    "market": {},
                    "order": {},
                    "risk": {},
                    "guards": {
                        "api_failure": True,
                    },
                }
            )

    selected = _select_best_venue(venues)
    return {
        "timestamp_utc": _timestamp(active_now),
        "config": tao_config_to_dict(config),
        "position": state.get("position"),
        "daily": state.get("daily"),
        "manual_kill_switch": state.get("manual_kill_switch", False),
        "manual_kill_reason": state.get("manual_kill_reason"),
        "venues": venues,
        "selected_exchange": selected.get("exchange") if selected else None,
        "selected_action": selected.get("action") if selected else "HOLD",
        "errors": errors,
    }


def run_tao_bot(
    config: TAOBotConfig,
    *,
    mode: str,
    output_dir: str | Path = DEFAULT_TAO_OUTPUT_DIR,
    state_path: str | Path | None = None,
    journal_path: str | Path | None = None,
    exchange: str = "auto",
    live_ack: str | None = None,
    client_factory: Callable[[str], TradingClient] = create_exchange_client,
    now: datetime | None = None,
) -> tuple[dict[str, Any], Path]:
    mode_lower = mode.lower()
    if mode_lower not in {"paper", "manual", "live"}:
        raise ValueError("mode must be paper, manual, or live.")

    active_now = now or datetime.now(timezone.utc)
    active_state_path = Path(state_path) if state_path is not None else default_tao_state_path(mode_lower)
    active_journal_path = Path(journal_path) if journal_path is not None else default_tao_journal_path(mode_lower)
    state = load_tao_state(active_state_path, config, now=active_now)

    report: dict[str, Any] = {
        "timestamp_utc": _timestamp(active_now),
        "mode": mode_lower,
        "config": tao_config_to_dict(config),
        "state_path": str(active_state_path),
        "journal_path": str(active_journal_path),
    }

    if state.get("pending_order"):
        pending_order = dict(state["pending_order"])
        exchange_name = str(pending_order.get("exchange", ""))
        if pending_order.get("submission_mode") == "live" and exchange_name:
            sync_client = client_factory(exchange_name)
            sync_report = _sync_pending_live_order(
                config,
                state,
                pending_order,
                client=sync_client,
                journal_path=active_journal_path,
                timestamp_utc=report["timestamp_utc"],
            )
            if sync_report is not None:
                report.update(sync_report)
                save_tao_state(active_state_path, state)
                return report, _write_tao_report(output_dir, exchange_name, mode_lower, report)
        report.update(
            {
                "exchange": pending_order.get("exchange"),
                "decision": {
                    "phase": "pending_order",
                    "action": "HOLD",
                    "reason": "A pending TAO order must be reconciled before the bot can act again.",
                },
                "pending_order": pending_order,
                "daily": state["daily"],
                "capital": _capital_snapshot(state, Decimal("0")),
            }
        )
        save_tao_state(active_state_path, state)
        return report, _write_tao_report(output_dir, str(pending_order.get("exchange", "pending")), mode_lower, report)

    if state.get("position"):
        exchange_name = str(state["position"]["exchange"])
        client = client_factory(exchange_name)
        snapshot = _build_market_snapshot(client, config, exchange_name, active_now)
        equity = _mark_equity(state, Decimal(str(snapshot["market"]["mid_price"])))
        _roll_daily_window(state, equity, active_now)
        lifecycle = _manage_open_position(config, state, snapshot, mode_lower)
        lifecycle["decision"]["phase"] = "manage_position"
        report.update(
            {
                "exchange": exchange_name,
                "position_before": lifecycle["position_before"],
                "market": lifecycle["market"],
                "decision": lifecycle["decision"],
                "daily": state["daily"],
                "capital": _capital_snapshot(state, Decimal(str(snapshot["market"]["mid_price"]))),
            }
        )
        _append_journal(
            active_journal_path,
            {
                "type": "signal",
                "phase": "manage_position",
                "exchange": exchange_name,
                "action": lifecycle["decision"]["action"],
                "reason": lifecycle["decision"]["reason"],
                "timestamp_utc": report["timestamp_utc"],
            },
        )
        if lifecycle["decision"]["action"] != "HOLD":
            if mode_lower == "paper":
                fill_summary = _apply_exit_fill(config, state, lifecycle["decision"], report["timestamp_utc"])
                report["position_after"] = state.get("position")
                report["daily"] = state["daily"]
                report["capital"] = _capital_snapshot(
                    state,
                    Decimal(str(snapshot["market"]["mid_price"])),
                )
                report["fill_summary"] = fill_summary
                _append_journal(
                    active_journal_path,
                    {
                        "type": "fill",
                        "phase": "exit",
                        "exchange": exchange_name,
                        "decision": lifecycle["decision"],
                        "fill_summary": fill_summary,
                        "timestamp_utc": report["timestamp_utc"],
                    },
                )
                _send_alert_for_event(config, lifecycle["decision"], report["timestamp_utc"])
            else:
                preview = None
                live_order = None
                if mode_lower == "live":
                    require_live_ack(live_ack, exchange_name)
                    _guard_live_balances(client, lifecycle["decision"], config)
                    live_payload = _execute_live_exit(client, config, lifecycle["decision"])
                    preview = live_payload.get("preview")
                    live_order = live_payload.get("order")
                    report["preview"] = preview
                    report["live_order"] = live_order
                pending_order = _register_pending_order(
                    state,
                    phase="exit",
                    submission_mode=mode_lower,
                    decision=lifecycle["decision"],
                    timestamp_utc=report["timestamp_utc"],
                    preview=preview,
                    live_order=live_order,
                )
                report["pending_order"] = pending_order
                _append_journal(
                    active_journal_path,
                    {
                        "type": "pending_order",
                        "phase": "exit",
                        "exchange": exchange_name,
                        "submission_mode": mode_lower,
                        "decision": lifecycle["decision"],
                        "timestamp_utc": report["timestamp_utc"],
                    },
                )
                _send_alert_for_pending_order(config, pending_order, report["timestamp_utc"])
        save_tao_state(active_state_path, state)
        return report, _write_tao_report(output_dir, exchange_name, mode_lower, report)

    scan_report = scan_tao_markets(
        config,
        exchange=exchange,
        state_path=active_state_path,
        client_factory=client_factory,
        now=active_now,
    )
    selected = _select_best_venue(scan_report["venues"])
    exchange_name = selected["exchange"] if selected else None
    mid_price = Decimal("0")
    if selected and selected.get("market", {}).get("mid_price"):
        mid_price = Decimal(str(selected["market"]["mid_price"]))
    equity = _mark_equity(state, mid_price)
    _roll_daily_window(state, equity, active_now)
    report.update(
        {
            "exchange": exchange_name,
            "scan": scan_report,
            "daily": state["daily"],
            "capital": _capital_snapshot(state, mid_price),
        }
    )

    entry_block_reason = _entry_block_reason(config, state, active_now, _mark_equity(state, mid_price or Decimal(str(config.starting_capital))))
    if not selected:
        decision = {"phase": "scan", "action": "HOLD", "reason": "No exchange snapshot was available."}
    elif entry_block_reason:
        decision = {
            "phase": "scan",
            "exchange": selected["exchange"],
            "action": "HOLD",
            "setup": selected.get("setup", "none"),
            "reason": entry_block_reason,
        }
    else:
        decision = dict(selected)
        decision["phase"] = "scan"

    report["decision"] = decision
    _append_journal(
        active_journal_path,
        {
            "type": "signal",
            "phase": "entry_scan",
            "exchange": exchange_name,
            "action": decision["action"],
            "reason": decision["reason"],
            "setup": decision.get("setup"),
            "timestamp_utc": report["timestamp_utc"],
        },
    )

    if decision["action"] != "BUY":
        save_tao_state(active_state_path, state)
        return report, _write_tao_report(output_dir, exchange_name or "auto", mode_lower, report)

    if mode_lower == "paper":
        fill_summary = _apply_entry_fill(config, state, decision, report["timestamp_utc"])
        report["position_after"] = state.get("position")
        report["daily"] = state["daily"]
        report["capital"] = _capital_snapshot(
            state,
            Decimal(str(decision["market"]["mid_price"])),
        )
        report["fill_summary"] = fill_summary
        _append_journal(
            active_journal_path,
            {
                "type": "fill",
                "phase": "entry",
                "exchange": decision["exchange"],
                "decision": decision,
                "fill_summary": fill_summary,
                "timestamp_utc": report["timestamp_utc"],
            },
        )
        _send_alert_for_event(config, decision, report["timestamp_utc"])
    else:
        preview = None
        live_order = None
        if mode_lower == "live":
            require_live_ack(live_ack, decision["exchange"])
            client = client_factory(decision["exchange"])
            _guard_live_balances(client, decision, config)
            live_payload = _execute_live_entry(client, config, decision)
            preview = live_payload.get("preview")
            live_order = live_payload.get("order")
            report["preview"] = preview
            report["live_order"] = live_order
        pending_order = _register_pending_order(
            state,
            phase="entry",
            submission_mode=mode_lower,
            decision=decision,
            timestamp_utc=report["timestamp_utc"],
            preview=preview,
            live_order=live_order,
        )
        report["pending_order"] = pending_order
        _append_journal(
            active_journal_path,
            {
                "type": "pending_order",
                "phase": "entry",
                "exchange": decision["exchange"],
                "submission_mode": mode_lower,
                "decision": decision,
                "timestamp_utc": report["timestamp_utc"],
            },
        )
        _send_alert_for_pending_order(config, pending_order, report["timestamp_utc"])
    save_tao_state(active_state_path, state)
    return report, _write_tao_report(output_dir, decision["exchange"], mode_lower, report)


def set_tao_kill_switch(
    path: str | Path,
    config: TAOBotConfig,
    *,
    enabled: bool,
    reason: str,
    journal_path: str | Path | None = None,
    now: datetime | None = None,
) -> tuple[dict[str, Any], Path]:
    active_now = now or datetime.now(timezone.utc)
    state = load_tao_state(path, config, now=active_now)
    active_journal_path = Path(journal_path) if journal_path is not None else _derived_journal_path(path)
    state["manual_kill_switch"] = bool(enabled)
    state["manual_kill_reason"] = reason.strip() or ("Manual kill switch enabled." if enabled else "Manual kill switch disabled.")
    state["updated_at"] = _timestamp(active_now)
    save_path = save_tao_state(path, state)
    _append_journal(
        active_journal_path,
        {
            "type": "kill_switch",
            "enabled": bool(enabled),
            "reason": state["manual_kill_reason"],
            "timestamp_utc": _timestamp(active_now),
        },
    )
    send_telegram_alert(
        f"[TAO] Kill switch {'enabled' if enabled else 'disabled'} at {_timestamp(active_now)}. {state['manual_kill_reason']}"
    )
    return state, save_path


def reconcile_tao_pending_order(
    path: str | Path,
    config: TAOBotConfig,
    *,
    status: str,
    fill_price: str | None = None,
    filled_base_size: str | None = None,
    journal_path: str | Path | None = None,
    output_dir: str | Path = DEFAULT_TAO_OUTPUT_DIR,
    note: str = "",
    now: datetime | None = None,
) -> tuple[dict[str, Any], Path]:
    active_now = now or datetime.now(timezone.utc)
    active_journal_path = Path(journal_path) if journal_path is not None else _derived_journal_path(path)
    state = load_tao_state(path, config, now=active_now)
    pending_order = state.get("pending_order")
    if not pending_order:
        raise ValueError("No pending TAO order is recorded in state.")

    normalized_status = status.strip().lower()
    if normalized_status not in {"filled", "canceled"}:
        raise ValueError("status must be filled or canceled.")

    report: dict[str, Any] = {
        "timestamp_utc": _timestamp(active_now),
        "config": tao_config_to_dict(config),
        "state_path": str(path),
        "journal_path": str(active_journal_path),
        "pending_order_before": pending_order,
        "note": note.strip(),
    }

    if normalized_status == "canceled":
        state["pending_order"] = None
        state["updated_at"] = report["timestamp_utc"]
        report["decision"] = {
            "phase": "reconcile",
            "action": "HOLD",
            "reason": "Pending TAO order was canceled.",
            "status": "canceled",
        }
        _append_journal(
            active_journal_path,
            {
                "type": "reconcile",
                "status": "canceled",
                "pending_order": pending_order,
                "timestamp_utc": report["timestamp_utc"],
                "note": note.strip(),
            },
        )
        save_tao_state(path, state)
        return report, _write_tao_report(output_dir, str(pending_order.get("exchange", "pending")), "reconcile", report)

    filled_decision = _decision_for_reconciliation(
        config,
        pending_order,
        fill_price=fill_price,
        filled_base_size=filled_base_size,
    )
    if pending_order["phase"] == "entry":
        fill_summary = _apply_entry_fill(config, state, filled_decision, report["timestamp_utc"])
    else:
        fill_summary = _apply_exit_fill(config, state, filled_decision, report["timestamp_utc"])
    state["pending_order"] = None
    state["updated_at"] = report["timestamp_utc"]

    report["decision"] = {
        "phase": "reconcile",
        "action": filled_decision["action"],
        "reason": "Pending TAO order was reconciled as filled.",
        "status": "filled",
    }
    report["filled_decision"] = filled_decision
    report["fill_summary"] = fill_summary
    report["position_after"] = state.get("position")
    report["daily"] = state["daily"]
    _append_journal(
        active_journal_path,
        {
            "type": "reconcile",
            "status": "filled",
            "filled_decision": filled_decision,
            "fill_summary": fill_summary,
            "timestamp_utc": report["timestamp_utc"],
            "note": note.strip(),
        },
    )
    _send_alert_for_event(config, filled_decision, report["timestamp_utc"])
    save_tao_state(path, state)
    return report, _write_tao_report(output_dir, str(pending_order.get("exchange", "pending")), "reconcile", report)


def _build_market_snapshot(
    client: TradingClient,
    config: TAOBotConfig,
    exchange: str,
    now: datetime,
) -> dict[str, Any]:
    product = client.get_product(config.product_id)
    ticker = client.get_ticker(config.product_id, limit=30)
    candles_15m = _completed_candles(client.get_candles(config.product_id, "15m", limit=config.candles_15m), 900, now)
    candles_1h = _completed_candles(client.get_candles(config.product_id, "1h", limit=config.candles_1h), 3600, now)

    if len(candles_15m) < max(config.signal_ema_period + 5, config.atr_period + 2, config.rsi_period + 3):
        raise ExchangeAPIError(f"{exchange} returned too few completed 15m candles for TAO.")
    if len(candles_1h) < config.trend_ema_period + 2:
        raise ExchangeAPIError(f"{exchange} returned too few completed 1h candles for TAO.")

    best_bid = Decimal(str(ticker.get("best_bid") or product.get("best_bid") or "0"))
    best_ask = Decimal(str(ticker.get("best_ask") or product.get("best_ask") or "0"))
    if best_bid <= 0 or best_ask <= 0:
        raise ExchangeAPIError(f"{exchange} returned an invalid TAO bid/ask.")
    mid_price = (best_bid + best_ask) / Decimal("2")
    spread_bps = ((best_ask - best_bid) / mid_price) * Decimal("10000") if mid_price > 0 else Decimal("0")

    last_price = Decimal(str(ticker.get("last_price") or product.get("price") or product.get("last_price") or mid_price))
    volume_24h = Decimal(str(product.get("volume_24h") or ticker.get("volume_24h") or "0"))
    quote_volume_24h = volume_24h * last_price
    volume_change_24h = _optional_decimal(product.get("volume_percentage_change_24h"))

    return {
        "exchange": exchange,
        "product": {
            "status": str(product.get("status", "unknown")).lower(),
            "base_increment": str(product.get("base_increment") or "0.00000001"),
            "quote_increment": str(product.get("quote_increment") or "0.01"),
            "base_min_size": str(product.get("base_min_size") or "0"),
            "quote_min_size": str(product.get("quote_min_size") or "0"),
            "volume_change_24h": str(volume_change_24h) if volume_change_24h is not None else None,
        },
        "market": {
            "best_bid": str(best_bid),
            "best_ask": str(best_ask),
            "mid_price": str(mid_price),
            "last_price": str(last_price),
            "spread_bps": str(spread_bps),
            "volume_24h": str(volume_24h),
            "quote_volume_24h": str(quote_volume_24h),
        },
        "candles_15m": candles_15m,
        "candles_1h": candles_1h,
    }


def _evaluate_entry_candidate(config: TAOBotConfig, snapshot: Mapping[str, Any], state: Mapping[str, Any]) -> dict[str, Any]:
    exchange = str(snapshot["exchange"])
    product = snapshot["product"]
    market = snapshot["market"]
    candles_15m = snapshot["candles_15m"]
    candles_1h = snapshot["candles_1h"]

    closes_15m = [float(candle["close"]) for candle in candles_15m]
    highs_15m = [float(candle["high"]) for candle in candles_15m]
    lows_15m = [float(candle["low"]) for candle in candles_15m]
    opens_15m = [float(candle["open"]) for candle in candles_15m]
    volumes_15m = [float(candle["volume"]) for candle in candles_15m]
    closes_1h = [float(candle["close"]) for candle in candles_1h]
    volumes_1h = [float(candle["volume"]) for candle in candles_1h]

    ema_50_1h = _ema_series(closes_1h, config.trend_ema_period)
    ema_20_15m = _ema_series(closes_15m, config.signal_ema_period)
    rsi_values = _rsi_series(closes_15m, config.rsi_period)
    macd_line, macd_signal = _macd_series(
        closes_15m,
        config.macd_fast,
        config.macd_slow,
        config.macd_signal,
    )
    atr_values = _atr_series(highs_15m, lows_15m, closes_15m, config.atr_period)

    latest_close = Decimal(str(closes_15m[-1]))
    previous_close = Decimal(str(closes_15m[-2]))
    latest_open = Decimal(str(opens_15m[-1]))
    latest_high = Decimal(str(highs_15m[-1]))
    latest_low = Decimal(str(lows_15m[-1]))
    ema_50_value = Decimal(str(ema_50_1h[-1]))
    ema_20_value = Decimal(str(ema_20_15m[-1]))
    last_rsi = Decimal(str(rsi_values[-1]))
    prev_rsi = Decimal(str(rsi_values[-2]))
    macd_latest = Decimal(str(macd_line[-1]))
    macd_previous = Decimal(str(macd_line[-2]))
    macd_signal_latest = Decimal(str(macd_signal[-1]))
    macd_signal_previous = Decimal(str(macd_signal[-2]))
    atr_pct = (Decimal(str(atr_values[-1])) / latest_close) * Decimal("100")

    support_window = lows_15m[-max(config.support_lookback_15m, 3) :]
    resistance_window = highs_15m[-max(config.resistance_lookback_15m, 4) - 2 : -2] or highs_15m[:-2]
    support_level = Decimal(str(min(support_window)))
    resistance_level = Decimal(str(max(resistance_window)))
    tolerance_multiplier = Decimal("1") + (config.retest_tolerance_pct / Decimal("100"))

    uptrend = latest_close > ema_50_value
    bullish_confirmation = latest_close > latest_open
    rsi_turning_up = Decimal("40") <= last_rsi <= Decimal("60") and last_rsi > prev_rsi
    macd_bullish_cross = macd_previous <= macd_signal_previous and macd_latest > macd_signal_latest
    reclaim_signal = previous_close <= support_level and latest_close > support_level and bullish_confirmation
    pullback_high = Decimal(str(max(closes_15m[-10:])))
    pullback_pct = ((pullback_high - latest_close) / pullback_high) * Decimal("100") if pullback_high > 0 else Decimal("0")

    breakout_window = highs_15m[-(config.resistance_lookback_15m + config.recent_breakout_lookback + 2) : -config.recent_breakout_lookback - 1]
    if not breakout_window:
        breakout_window = highs_15m[:-2] or highs_15m
    recent_breakout_high = Decimal(str(max(breakout_window)))
    recent_breakout = previous_close > recent_breakout_high
    retest_hold = latest_low <= (recent_breakout_high * tolerance_multiplier) and latest_close > recent_breakout_high and bullish_confirmation
    breakout_retest = recent_breakout and retest_hold
    dip_buy = (
        uptrend
        and bullish_confirmation
        and latest_close >= ema_20_value * Decimal("0.995")
        and Decimal("0.3") <= pullback_pct <= config.max_single_candle_move_pct
    )
    last_candle_move_pct = ((latest_close - latest_open).copy_abs() / latest_open) * Decimal("100") if latest_open > 0 else Decimal("0")
    momentum_continuation = (
        uptrend
        and bullish_confirmation
        and previous_close <= resistance_level
        and latest_close > resistance_level
        and latest_close >= ema_20_value
        and macd_bullish_cross
        and last_candle_move_pct <= (config.max_single_candle_move_pct * Decimal("0.7"))
    )
    reclaim_trend = uptrend and reclaim_signal

    recent_1h_volume = Decimal(str(sum(volumes_1h[-6:])))
    prior_1h_volume = Decimal(str(sum(volumes_1h[-12:-6] or [0.0])))
    volume_ratio = recent_1h_volume / prior_1h_volume if prior_1h_volume > 0 else Decimal("0")
    recent_15m_volume = Decimal(str(sum(volumes_15m[-4:]) / 4))
    prior_15m_volume = Decimal(str(sum(volumes_15m[-20:-4] or [0.0]) / max(len(volumes_15m[-20:-4]), 1)))
    low_volume = prior_15m_volume > 0 and recent_15m_volume < (prior_15m_volume * config.low_volume_factor)

    market_spread_bps = Decimal(str(market["spread_bps"]))
    max_spread_bps = config.max_spread_bps_by_exchange.get(exchange, Decimal("75"))
    quote_volume_24h = Decimal(str(market["quote_volume_24h"]))
    volume_change_24h = _optional_decimal(product.get("volume_change_24h"))

    guard_failures = []
    if str(product.get("status", "unknown")) not in {"online", "active"}:
        guard_failures.append("TAO is not marked online on this exchange.")
    if not uptrend:
        guard_failures.append("Price is below the 50 EMA on the 1h chart.")
    if market_spread_bps > max_spread_bps:
        guard_failures.append(
            f"Spread is {quantize_string(market_spread_bps, places='0.01')} bps, above the venue limit."
        )
    if volume_ratio < config.min_volume_ratio:
        guard_failures.append("Recent 1h volume is dropping sharply versus the prior session.")
    if low_volume:
        guard_failures.append("Recent 15m volume is abnormally low.")
    if quote_volume_24h < config.min_quote_volume_24h:
        guard_failures.append("24h quote volume is below the minimum liquidity floor.")
    if volume_change_24h is not None and volume_change_24h <= config.sharp_volume_drop_24h_pct:
        guard_failures.append("24h exchange-reported volume is dropping sharply.")
    if last_candle_move_pct > config.max_single_candle_move_pct and not breakout_retest:
        guard_failures.append("The latest 15m candle moved more than 6% without a retest-and-hold.")
    if not bullish_confirmation:
        guard_failures.append("The latest 15m candle did not confirm with a bullish close.")

    confirmations = {
        "rsi_turning_up": rsi_turning_up,
        "macd_bullish_cross": macd_bullish_cross,
        "reclaim_signal": reclaim_signal,
        "breakout_retest": breakout_retest,
    }
    confirmation_count = sum(1 for value in confirmations.values() if value)
    if confirmation_count == 0:
        guard_failures.append("No RSI, MACD, or reclaim confirmation is active.")
    setup_flags = {
        "dip_buy": dip_buy and confirmation_count > 0,
        "breakout_retest": breakout_retest,
        "reclaim_trend": reclaim_trend and confirmation_count > 0,
        "momentum_continuation": momentum_continuation,
    }
    preferred_order = (
        "breakout_retest",
        "momentum_continuation",
        "dip_buy",
        "reclaim_trend",
    )
    if config.entry_style == "hybrid":
        setup = next((name for name in preferred_order if setup_flags[name]), "none")
    else:
        setup = config.entry_style if setup_flags.get(config.entry_style, False) else "none"

    equity = _mark_equity(state, Decimal(str(market["mid_price"])))
    available_quote = max(Decimal(str(state.get("cash", quantize_string(config.starting_capital)))) - config.reserve_cash, Decimal("0"))
    risk_score = Decimal(str(min(confirmation_count, 3))) / Decimal("3")
    if setup == "breakout_retest":
        risk_score += Decimal("0.2")
    if volume_ratio > Decimal("1"):
        risk_score += Decimal("0.1")
    risk_score = min(risk_score, Decimal("1"))
    risk_pct = config.risk_per_trade_min_pct + (
        (config.risk_per_trade_max_pct - config.risk_per_trade_min_pct) * risk_score
    )
    stop_loss_pct = _clamp(atr_pct * config.stop_atr_multiplier, config.min_stop_loss_pct, config.max_stop_loss_pct)
    entry_price = _ceil_to_increment(
        latest_close * (Decimal("1") + (config.entry_limit_buffer_bps / Decimal("10000"))),
        Decimal(str(product["quote_increment"])),
    )
    entry_price = max(entry_price, Decimal(str(market["best_ask"])))
    risk_per_unit = entry_price * (stop_loss_pct / Decimal("100"))
    risk_amount = equity * (risk_pct / Decimal("100"))

    max_notional_from_risk = risk_amount / (stop_loss_pct / Decimal("100")) if stop_loss_pct > 0 else Decimal("0")
    max_notional_from_pct = equity * (config.max_position_notional_pct / Decimal("100"))
    desired_notional = min(config.max_position_notional, max_notional_from_risk, max_notional_from_pct, available_quote)
    base_increment = Decimal(str(product["base_increment"]))
    quote_increment = Decimal(str(product["quote_increment"]))
    base_size = _floor_to_increment(desired_notional / entry_price, base_increment) if entry_price > 0 else Decimal("0")
    quote_size = base_size * entry_price

    min_quote_order = max(
        Decimal(str(product["quote_min_size"])),
        config.min_quote_order_by_exchange.get(exchange, Decimal("0")),
    )
    min_base_order = Decimal(str(product["base_min_size"]))
    if quote_size < min_quote_order:
        guard_failures.append("The TAO order would be below the exchange or bot minimum notional.")
    if base_size < min_base_order:
        guard_failures.append("The TAO order would be below the exchange minimum size.")
    if available_quote <= 0:
        guard_failures.append("The bot's $100 capital envelope does not have enough free cash.")

    stop_price = _floor_to_increment(entry_price - risk_per_unit, quote_increment)
    take_profit_1 = _floor_to_increment(entry_price + (risk_per_unit * config.take_profit_1_r), quote_increment)
    take_profit_2 = _floor_to_increment(entry_price + (risk_per_unit * config.take_profit_2_r), quote_increment)
    estimated_fee_bps = config.estimated_fee_bps_by_exchange.get(exchange, Decimal("50"))
    total_cost_bps = (estimated_fee_bps * Decimal("2")) + market_spread_bps
    gross_reward_pct = ((take_profit_1 - entry_price) / entry_price) * Decimal("100") if entry_price > 0 else Decimal("0")
    net_reward_pct = gross_reward_pct - (total_cost_bps / Decimal("100"))
    net_reward_to_risk = net_reward_pct / stop_loss_pct if stop_loss_pct > 0 else Decimal("0")
    if net_reward_to_risk < config.min_net_reward_to_risk:
        guard_failures.append("Round-trip fees plus spread leave too little reward relative to risk.")

    quality_score = Decimal(str(confirmation_count * 20))
    if setup == "breakout_retest":
        quality_score += Decimal("15")
    if setup == "momentum_continuation":
        quality_score += Decimal("12")
    if setup == "dip_buy":
        quality_score += Decimal("10")
    if setup == "reclaim_trend":
        quality_score += Decimal("8")
    quality_score += min(volume_ratio * Decimal("10"), Decimal("15"))
    selection_score = quality_score - (total_cost_bps / Decimal("2"))

    action = "BUY" if setup != "none" and not guard_failures else "HOLD"
    reason = (
        f"{setup.replace('_', ' ')} cleared the TAO entry rules."
        if action == "BUY"
        else "; ".join(guard_failures[:3]) or "No TAO setup is active."
    )

    return _stringify(
        {
            "exchange": exchange,
            "action": action,
            "setup": setup,
            "reason": reason,
            "selection_score": selection_score,
            "guards": {
                "uptrend": uptrend,
                "bullish_confirmation": bullish_confirmation,
                "confirmation_count": confirmation_count,
                "guard_failures": guard_failures,
                "low_volume": low_volume,
            },
            "market": {
                **market,
                "ema_50_1h": ema_50_value,
                "ema_20_15m": ema_20_value,
                "rsi_15m": last_rsi,
                "macd_15m": macd_latest,
                "macd_signal_15m": macd_signal_latest,
                "atr_pct_15m": atr_pct,
                "support_level": support_level,
                "resistance_level": resistance_level,
                "recent_breakout_high": recent_breakout_high,
                "pullback_pct": pullback_pct,
                "last_candle_move_pct": last_candle_move_pct,
                "volume_ratio_1h": volume_ratio,
                "recent_15m_volume": recent_15m_volume,
                "prior_15m_volume": prior_15m_volume,
            },
            "confirmations": confirmations,
            "order": {
                "entry_price": entry_price,
                "base_size": base_size,
                "quote_size": quote_size,
                "stop_price": stop_price,
                "take_profit_1": take_profit_1,
                "take_profit_2": take_profit_2,
                "post_only": config.post_only_entries,
            },
            "risk": {
                "equity": equity,
                "risk_pct": risk_pct,
                "risk_amount": risk_amount,
                "stop_loss_pct": stop_loss_pct,
                "net_reward_to_risk": net_reward_to_risk,
                "estimated_fee_bps": estimated_fee_bps,
                "estimated_total_cost_bps": total_cost_bps,
            },
            "product": product,
        }
    )


def _manage_open_position(
    config: TAOBotConfig,
    state: dict[str, Any],
    snapshot: Mapping[str, Any],
    mode: str,
) -> dict[str, Any]:
    del mode
    position_before = dict(state["position"])
    position = state["position"]
    exchange = str(position["exchange"])
    market = snapshot["market"]
    product = snapshot["product"]
    candles_15m = snapshot["candles_15m"]
    best_bid = Decimal(str(market["best_bid"]))
    mid_price = Decimal(str(market["mid_price"]))
    latest_high = Decimal(str(candles_15m[-1]["high"]))
    latest_low = Decimal(str(candles_15m[-1]["low"]))
    quote_increment = Decimal(str(product["quote_increment"]))
    base_increment = Decimal(str(product["base_increment"]))

    current_high = max(Decimal(str(position["highest_price"])), latest_high)
    position["highest_price"] = quantize_string(current_high)
    if _coerce_bool(position.get("tp1_hit")) and config.trail_after_tp1:
        trailing_stop = _floor_to_increment(
            current_high - (Decimal(str(position["risk_per_unit"])) * config.trail_stop_buffer_r),
            quote_increment,
        )
        position["stop_price"] = quantize_string(max(Decimal(str(position["stop_price"])), Decimal(str(position["entry_price"])), trailing_stop))

    stop_price = Decimal(str(position["stop_price"]))
    take_profit_1 = Decimal(str(position["take_profit_1"]))
    take_profit_2 = Decimal(str(position["take_profit_2"]))
    remaining_base = Decimal(str(position["base_size"]))
    estimated_fee_bps = Decimal(str(position["fee_bps"]))

    if latest_low <= stop_price or best_bid <= stop_price:
        exit_price = min(
            stop_price,
            best_bid * (Decimal("1") - (config.emergency_exit_slippage_bps / Decimal("10000"))),
        )
        decision = {
            "exchange": exchange,
            "action": "SELL",
            "setup": "stop_loss",
            "reason": "TAO hit the hard stop-loss.",
            "sell_mode": "market",
            "base_size": quantize_string(remaining_base, places="0.00000001"),
            "exit_price": quantize_string(exit_price),
            "estimated_fee_bps": quantize_string(estimated_fee_bps, places="0.01"),
            "market": _stringify(market),
        }
        return {
            "position_before": position_before,
            "market": _stringify(market),
            "decision": decision,
        }

    if latest_high >= take_profit_2 or best_bid >= take_profit_2:
        decision = {
            "exchange": exchange,
            "action": "SELL",
            "setup": "take_profit_2",
            "reason": "TAO reached the second take-profit target.",
            "sell_mode": "limit",
            "base_size": quantize_string(remaining_base, places="0.00000001"),
            "exit_price": quantize_string(take_profit_2),
            "estimated_fee_bps": quantize_string(estimated_fee_bps, places="0.01"),
            "market": _stringify(market),
        }
        return {
            "position_before": position_before,
            "market": _stringify(market),
            "decision": decision,
        }

    if not _coerce_bool(position.get("tp1_hit")) and (latest_high >= take_profit_1 or best_bid >= take_profit_1):
        half_size = _floor_to_increment(remaining_base / Decimal("2"), base_increment)
        min_base_order = Decimal(str(product["base_min_size"]))
        if half_size < min_base_order:
            half_size = remaining_base
        decision = {
            "exchange": exchange,
            "action": "SELL",
            "setup": "take_profit_1",
            "reason": "TAO reached the first take-profit target.",
            "sell_mode": "limit",
            "base_size": quantize_string(half_size, places="0.00000001"),
            "exit_price": quantize_string(take_profit_1),
            "estimated_fee_bps": quantize_string(estimated_fee_bps, places="0.01"),
            "market": _stringify(market),
        }
        return {
            "position_before": position_before,
            "market": _stringify(market),
            "decision": decision,
        }

    decision = {
        "exchange": exchange,
        "action": "HOLD",
        "setup": position.get("setup", "position"),
        "reason": "TAO remains between stop-loss and take-profit levels.",
        "market": _stringify(market),
    }
    return {
        "position_before": position_before,
        "market": _stringify(market),
        "decision": decision,
    }


def _execute_live_entry(client: TradingClient, config: TAOBotConfig, decision: Mapping[str, Any]) -> dict[str, Any]:
    preview = client.preview_limit_order(
        config.product_id,
        "BUY",
        base_size=str(decision["order"]["base_size"]),
        limit_price=str(decision["order"]["entry_price"]),
        post_only=_coerce_bool(decision["order"]["post_only"]),
    )
    preview_errors = preview.get("errs") or []
    if preview_errors:
        raise ExchangeAPIError("Preview returned exchange-side errors: " + ", ".join(str(error) for error in preview_errors))
    order = client.create_limit_order(
        config.product_id,
        "BUY",
        base_size=str(decision["order"]["base_size"]),
        limit_price=str(decision["order"]["entry_price"]),
        post_only=_coerce_bool(decision["order"]["post_only"]),
        preview_id=preview.get("preview_id"),
    )
    return {"preview": preview, "order": order}


def _execute_live_exit(client: TradingClient, config: TAOBotConfig, decision: Mapping[str, Any]) -> dict[str, Any]:
    if decision["sell_mode"] == "market":
        preview = client.preview_market_order(
            config.product_id,
            "SELL",
            base_size=str(decision["base_size"]),
        )
        preview_errors = preview.get("errs") or []
        if preview_errors:
            raise ExchangeAPIError("Preview returned exchange-side errors: " + ", ".join(str(error) for error in preview_errors))
        order = client.create_market_order(
            config.product_id,
            "SELL",
            base_size=str(decision["base_size"]),
            preview_id=preview.get("preview_id"),
        )
        return {"preview": preview, "order": order}

    preview = client.preview_limit_order(
        config.product_id,
        "SELL",
        base_size=str(decision["base_size"]),
        limit_price=str(decision["exit_price"]),
        post_only=False,
    )
    preview_errors = preview.get("errs") or []
    if preview_errors:
        raise ExchangeAPIError("Preview returned exchange-side errors: " + ", ".join(str(error) for error in preview_errors))
    order = client.create_limit_order(
        config.product_id,
        "SELL",
        base_size=str(decision["base_size"]),
        limit_price=str(decision["exit_price"]),
        post_only=False,
        preview_id=preview.get("preview_id"),
    )
    return {"preview": preview, "order": order}


def _guard_live_balances(client: TradingClient, decision: Mapping[str, Any], config: TAOBotConfig) -> None:
    accounts = client.list_accounts()
    balances = balances_by_currency(accounts)
    if decision["action"] == "BUY":
        required_quote = Decimal(str(decision["order"]["quote_size"]))
        available_quote = balances.get(config.quote_currency, Decimal("0"))
        if available_quote < required_quote:
            raise ExchangeAPIError(
                f"Live balance guard blocked the TAO buy. Need {required_quote} {config.quote_currency}, have {available_quote}."
            )
        return

    required_base = Decimal(str(decision["base_size"]))
    available_base = balances.get(config.base_currency, Decimal("0"))
    if available_base < required_base:
        raise ExchangeAPIError(
            f"Live balance guard blocked the TAO sell. Need {required_base} {config.base_currency}, have {available_base}."
        )


def _apply_entry_fill(config: TAOBotConfig, state: dict[str, Any], decision: Mapping[str, Any], timestamp_utc: str) -> dict[str, Any]:
    quote_size = Decimal(str(decision["order"]["quote_size"]))
    fee_bps = Decimal(str(decision["risk"]["estimated_fee_bps"]))
    entry_fee = quote_size * (fee_bps / Decimal("10000"))
    total_cost = quote_size + entry_fee
    cash_before = Decimal(str(state["cash"]))
    state["cash"] = quantize_string(cash_before - total_cost)
    state["position"] = _stringify(
        {
            "exchange": decision["exchange"],
            "opened_at": timestamp_utc,
            "entry_price": Decimal(str(decision["order"]["entry_price"])),
            "base_size": Decimal(str(decision["order"]["base_size"])),
            "initial_base_size": Decimal(str(decision["order"]["base_size"])),
            "cost_basis": total_cost,
            "entry_fee": entry_fee,
            "fee_bps": fee_bps,
            "stop_price": Decimal(str(decision["order"]["stop_price"])),
            "take_profit_1": Decimal(str(decision["order"]["take_profit_1"])),
            "take_profit_2": Decimal(str(decision["order"]["take_profit_2"])),
            "risk_per_unit": Decimal(str(decision["order"]["entry_price"])) - Decimal(str(decision["order"]["stop_price"])),
            "risk_amount": Decimal(str(decision["risk"]["risk_amount"])),
            "setup": decision["setup"],
            "highest_price": Decimal(str(decision["order"]["entry_price"])),
            "tp1_hit": False,
            "realized_pnl": Decimal("0"),
        }
    )
    state["updated_at"] = timestamp_utc
    return _stringify(
        {
            "side": "BUY",
            "base_size": Decimal(str(decision["order"]["base_size"])),
            "quote_size": quote_size,
            "entry_price": Decimal(str(decision["order"]["entry_price"])),
            "entry_fee": entry_fee,
            "total_cost": total_cost,
            "cash_before": cash_before,
            "cash_after": Decimal(str(state["cash"])),
            "position_closed": False,
            "realized_pnl": Decimal("0"),
            "total_trade_pnl": None,
        }
    )


def _apply_exit_fill(config: TAOBotConfig, state: dict[str, Any], decision: Mapping[str, Any], timestamp_utc: str) -> dict[str, Any] | None:
    position = state.get("position")
    if not position:
        return None

    base_before = Decimal(str(position["base_size"]))
    sold_size = Decimal(str(decision["base_size"]))
    sold_ratio = sold_size / base_before if base_before > 0 else Decimal("0")
    exit_price = Decimal(str(decision["exit_price"]))
    fee_bps = Decimal(str(position["fee_bps"]))
    proceeds = sold_size * exit_price
    exit_fee = proceeds * (fee_bps / Decimal("10000"))
    allocated_cost = Decimal(str(position["cost_basis"])) * sold_ratio
    realized_pnl = proceeds - exit_fee - allocated_cost

    cash_before = Decimal(str(state["cash"]))
    state["cash"] = quantize_string(cash_before + proceeds - exit_fee)
    position["cost_basis"] = quantize_string(Decimal(str(position["cost_basis"])) - allocated_cost)
    position["base_size"] = quantize_string(base_before - sold_size, places="0.00000001")
    position["realized_pnl"] = quantize_string(Decimal(str(position["realized_pnl"])) + realized_pnl)
    position["updated_at"] = timestamp_utc

    if decision["setup"] == "take_profit_1" and Decimal(str(position["base_size"])) > 0:
        position["tp1_hit"] = True
        position["stop_price"] = quantize_string(
            max(Decimal(str(position["stop_price"])), Decimal(str(position["entry_price"])))
        )

    total_trade_pnl: Decimal | None = None
    position_closed = Decimal(str(position["base_size"])) <= Decimal("0")
    if Decimal(str(position["base_size"])) <= Decimal("0"):
        total_trade_pnl = Decimal(str(position["realized_pnl"]))
        state["position"] = None
        state["daily"]["realized_pnl"] = quantize_string(Decimal(str(state["daily"]["realized_pnl"])) + total_trade_pnl)
        if total_trade_pnl < 0:
            state["daily"]["losses"] = int(state["daily"]["losses"]) + 1
            cooldown_until = _timestamp(
                datetime.fromisoformat(timestamp_utc.replace("Z", "+00:00")) + timedelta(minutes=config.cooldown_after_loss_minutes)
            )
            state["daily"]["cooldown_until"] = cooldown_until
        state["updated_at"] = timestamp_utc
        return _stringify(
            {
                "side": "SELL",
                "base_size": sold_size,
                "exit_price": exit_price,
                "proceeds": proceeds,
                "exit_fee": exit_fee,
                "allocated_cost": allocated_cost,
                "realized_pnl": realized_pnl,
                "cash_before": cash_before,
                "cash_after": Decimal(str(state["cash"])),
                "position_closed": position_closed,
                "remaining_base_size": Decimal("0"),
                "cumulative_position_realized_pnl": total_trade_pnl,
                "total_trade_pnl": total_trade_pnl,
                "setup": decision["setup"],
            }
        )

    state["position"] = position
    state["updated_at"] = timestamp_utc
    return _stringify(
        {
            "side": "SELL",
            "base_size": sold_size,
            "exit_price": exit_price,
            "proceeds": proceeds,
            "exit_fee": exit_fee,
            "allocated_cost": allocated_cost,
            "realized_pnl": realized_pnl,
            "cash_before": cash_before,
            "cash_after": Decimal(str(state["cash"])),
            "position_closed": position_closed,
            "remaining_base_size": Decimal(str(position["base_size"])),
            "cumulative_position_realized_pnl": Decimal(str(position["realized_pnl"])),
            "total_trade_pnl": None,
            "setup": decision["setup"],
        }
    )


def _register_pending_order(
    state: dict[str, Any],
    *,
    phase: str,
    submission_mode: str,
    decision: Mapping[str, Any],
    timestamp_utc: str,
    preview: Mapping[str, Any] | None = None,
    live_order: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    pending_order = _stringify(
        {
            "phase": phase,
            "submission_mode": submission_mode,
            "exchange": decision["exchange"],
            "action": decision["action"],
            "status": "pending",
            "submitted_at": timestamp_utc,
            "exchange_order_id": _extract_exchange_order_id(decision["exchange"], live_order),
            "decision": dict(decision),
            "preview": preview,
            "live_order": live_order,
        }
    )
    state["pending_order"] = pending_order
    state["updated_at"] = timestamp_utc
    return pending_order


def _sync_pending_live_order(
    config: TAOBotConfig,
    state: dict[str, Any],
    pending_order: Mapping[str, Any],
    *,
    client: TradingClient,
    journal_path: str | Path,
    timestamp_utc: str,
) -> dict[str, Any] | None:
    order_id = pending_order.get("exchange_order_id")
    if not order_id:
        return {
            "exchange": pending_order.get("exchange"),
            "decision": {
                "phase": "pending_order",
                "action": "HOLD",
                "reason": "Live order is pending but no exchange order ID was recorded for auto-sync.",
            },
            "pending_order": dict(pending_order),
            "daily": state["daily"],
            "capital": _capital_snapshot(state, Decimal("0")),
        }

    try:
        order_status = client.get_order(order_id=str(order_id))
    except ExchangeAPIError as exc:
        return {
            "exchange": pending_order.get("exchange"),
            "decision": {
                "phase": "pending_order",
                "action": "HOLD",
                "reason": f"Pending live order sync failed: {exc}",
            },
            "pending_order": dict(pending_order),
            "daily": state["daily"],
            "capital": _capital_snapshot(state, Decimal("0")),
        }

    normalized_status = str(order_status.get("status", "unknown"))
    if normalized_status == "pending":
        updated_pending = dict(pending_order)
        updated_pending["last_sync_at"] = timestamp_utc
        updated_pending["exchange_status"] = order_status
        state["pending_order"] = _stringify(updated_pending)
        _append_journal(
            journal_path,
            {
                "type": "sync",
                "status": "pending",
                "exchange_order_id": order_id,
                "exchange_status": order_status,
                "timestamp_utc": timestamp_utc,
            },
        )
        return {
            "exchange": pending_order.get("exchange"),
            "decision": {
                "phase": "pending_order",
                "action": "HOLD",
                "reason": "Live TAO order is still open on the exchange.",
            },
            "pending_order": state["pending_order"],
            "daily": state["daily"],
            "capital": _capital_snapshot(state, Decimal("0")),
        }

    if normalized_status == "canceled":
        state["pending_order"] = None
        state["updated_at"] = timestamp_utc
        _append_journal(
            journal_path,
            {
                "type": "sync",
                "status": "canceled",
                "exchange_order_id": order_id,
                "exchange_status": order_status,
                "timestamp_utc": timestamp_utc,
            },
        )
        return {
            "exchange": pending_order.get("exchange"),
            "decision": {
                "phase": "pending_order",
                "action": "HOLD",
                "reason": "Live TAO order was canceled on the exchange.",
            },
            "exchange_status": order_status,
            "daily": state["daily"],
            "capital": _capital_snapshot(state, Decimal("0")),
        }

    if normalized_status == "filled":
        filled_decision = _decision_for_reconciliation(
            config,
            pending_order,
            fill_price=str(order_status.get("average_filled_price") or ""),
            filled_base_size=str(order_status.get("filled_base_size") or ""),
        )
        if pending_order["phase"] == "entry":
            fill_summary = _apply_entry_fill(config, state, filled_decision, timestamp_utc)
        else:
            fill_summary = _apply_exit_fill(config, state, filled_decision, timestamp_utc)
        state["pending_order"] = None
        state["updated_at"] = timestamp_utc
        _append_journal(
            journal_path,
            {
                "type": "sync",
                "status": "filled",
                "exchange_order_id": order_id,
                "exchange_status": order_status,
                "filled_decision": filled_decision,
                "fill_summary": fill_summary,
                "timestamp_utc": timestamp_utc,
            },
        )
        _send_alert_for_event(config, filled_decision, timestamp_utc)
        capital_price = Decimal("0")
        if state.get("position"):
            capital_price = Decimal(str(state["position"]["entry_price"]))
        return {
            "exchange": pending_order.get("exchange"),
            "decision": {
                "phase": "pending_order",
                "action": filled_decision["action"],
                "reason": "Live TAO order was auto-reconciled from exchange status.",
            },
            "exchange_status": order_status,
            "filled_decision": filled_decision,
            "fill_summary": fill_summary,
            "position_after": state.get("position"),
            "daily": state["daily"],
            "capital": _capital_snapshot(state, capital_price),
        }

    return {
        "exchange": pending_order.get("exchange"),
        "decision": {
            "phase": "pending_order",
            "action": "HOLD",
            "reason": "Live TAO order status is unknown, so the bot will not mutate state.",
        },
        "exchange_status": order_status,
        "pending_order": dict(pending_order),
        "daily": state["daily"],
        "capital": _capital_snapshot(state, Decimal("0")),
    }


def _decision_for_reconciliation(
    config: TAOBotConfig,
    pending_order: Mapping[str, Any],
    *,
    fill_price: str | None,
    filled_base_size: str | None,
) -> dict[str, Any]:
    decision = json.loads(json.dumps(dict(pending_order["decision"])))
    quote_increment = Decimal("0.01")
    base_increment = Decimal("0.00000001")
    if decision.get("product"):
        quote_increment = Decimal(str(decision["product"].get("quote_increment", "0.01")))
        base_increment = Decimal(str(decision["product"].get("base_increment", "0.00000001")))

    if pending_order["phase"] == "entry":
        resolved_fill_price = fill_price if fill_price not in {None, "", "0"} else decision["order"]["entry_price"]
        resolved_base_size = filled_base_size if filled_base_size not in {None, "", "0"} else decision["order"]["base_size"]
        entry_price = Decimal(str(resolved_fill_price))
        base_size = Decimal(str(resolved_base_size))
        stop_loss_pct = Decimal(str(decision["risk"]["stop_loss_pct"]))
        stop_price = _floor_to_increment(entry_price * (Decimal("1") - (stop_loss_pct / Decimal("100"))), quote_increment)
        risk_per_unit = entry_price - stop_price
        take_profit_1 = _floor_to_increment(entry_price + (risk_per_unit * config.take_profit_1_r), quote_increment)
        take_profit_2 = _floor_to_increment(entry_price + (risk_per_unit * config.take_profit_2_r), quote_increment)
        decision["order"]["entry_price"] = quantize_string(entry_price)
        decision["order"]["base_size"] = quantize_string(_floor_to_increment(base_size, base_increment), places="0.00000001")
        decision["order"]["quote_size"] = quantize_string(base_size * entry_price)
        decision["order"]["stop_price"] = quantize_string(stop_price)
        decision["order"]["take_profit_1"] = quantize_string(take_profit_1)
        decision["order"]["take_profit_2"] = quantize_string(take_profit_2)
        return decision

    resolved_fill_price = fill_price if fill_price not in {None, "", "0"} else decision["exit_price"]
    resolved_base_size = filled_base_size if filled_base_size not in {None, "", "0"} else decision["base_size"]
    exit_price = Decimal(str(resolved_fill_price))
    base_size = Decimal(str(resolved_base_size))
    decision["exit_price"] = quantize_string(exit_price)
    decision["base_size"] = quantize_string(_floor_to_increment(base_size, base_increment), places="0.00000001")
    return decision


def _entry_block_reason(config: TAOBotConfig, state: Mapping[str, Any], now: datetime, equity: Decimal) -> str | None:
    if _coerce_bool(state.get("manual_kill_switch")):
        return str(state.get("manual_kill_reason") or "Manual kill switch is enabled.")

    daily = state["daily"]
    if int(daily["losses"]) >= config.max_losses_per_day:
        return f"Daily stop is active after {daily['losses']} losses."

    start_equity = Decimal(str(daily["starting_equity"]))
    if start_equity > 0:
        drawdown_pct = ((start_equity - equity) / start_equity) * Decimal("100")
        if drawdown_pct >= config.max_daily_drawdown_pct:
            return f"Daily drawdown is {quantize_string(drawdown_pct, places='0.01')}%, above the configured limit."

    cooldown_until = daily.get("cooldown_until")
    if cooldown_until:
        cooldown_dt = datetime.fromisoformat(str(cooldown_until).replace("Z", "+00:00"))
        if now < cooldown_dt:
            return f"Cooldown is active until {cooldown_until}."
    return None


def _roll_daily_window(state: dict[str, Any], equity: Decimal, now: datetime) -> None:
    current_date = now.strftime("%Y-%m-%d")
    daily = state.setdefault(
        "daily",
        {
            "date": current_date,
            "starting_equity": quantize_string(equity),
            "realized_pnl": "0",
            "losses": 0,
            "cooldown_until": None,
        },
    )
    if daily.get("date") == current_date:
        return
    state["daily"] = {
        "date": current_date,
        "starting_equity": quantize_string(equity),
        "realized_pnl": "0",
        "losses": 0,
        "cooldown_until": None,
    }


def _capital_snapshot(state: Mapping[str, Any], price: Decimal) -> dict[str, str]:
    equity = _mark_equity(state, price)
    payload = {
        "cash": Decimal(str(state.get("cash", "0"))),
        "equity": equity,
        "position_notional": Decimal("0"),
    }
    if state.get("position"):
        mark_price = price or Decimal(str(state["position"]["entry_price"]))
        payload["position_notional"] = Decimal(str(state["position"]["base_size"])) * mark_price
    return _stringify(payload)


def _mark_equity(state: Mapping[str, Any], price: Decimal) -> Decimal:
    cash = Decimal(str(state.get("cash", "0")))
    if not state.get("position"):
        return cash
    base_size = Decimal(str(state["position"]["base_size"]))
    mark_price = price or Decimal(str(state["position"]["entry_price"]))
    return cash + (base_size * mark_price)


def _write_tao_report(output_dir: str | Path, exchange: str, mode: str, report: Mapping[str, Any]) -> Path:
    report_dir = Path(output_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}_{exchange}_TAO-USD_{mode}.json"
    path = report_dir / filename
    path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    return path


def _append_journal(path: str | Path, payload: Mapping[str, Any]) -> Path:
    return append_log(path, "tao_journal", _stringify(dict(payload)))


def _send_alert_for_event(config: TAOBotConfig, decision: Mapping[str, Any], timestamp_utc: str) -> None:
    action = decision.get("action")
    if action == "BUY":
        message = (
            f"[TAO] BUY {decision['exchange']} {decision['order']['base_size']} {config.base_currency} "
            f"at {decision['order']['entry_price']} with stop {decision['order']['stop_price']} "
            f"and TP1 {decision['order']['take_profit_1']} / TP2 {decision['order']['take_profit_2']} ({timestamp_utc})"
        )
    elif action == "SELL":
        message = (
            f"[TAO] SELL {decision['exchange']} {decision['base_size']} {config.base_currency} "
            f"at {decision['exit_price']} because {decision['reason']} ({timestamp_utc})"
        )
    else:
        return
    send_telegram_alert(message)


def _send_alert_for_pending_order(config: TAOBotConfig, pending_order: Mapping[str, Any], timestamp_utc: str) -> None:
    decision = pending_order["decision"]
    if pending_order["phase"] == "entry":
        message = (
            f"[TAO] {pending_order['submission_mode'].upper()} entry pending on {pending_order['exchange']}: "
            f"buy {decision['order']['base_size']} {config.base_currency} at {decision['order']['entry_price']} "
            f"with stop {decision['order']['stop_price']} ({timestamp_utc})"
        )
    else:
        target_price = decision.get("exit_price", "-")
        message = (
            f"[TAO] {pending_order['submission_mode'].upper()} exit pending on {pending_order['exchange']}: "
            f"sell {decision['base_size']} {config.base_currency} at {target_price} "
            f"because {decision['reason']} ({timestamp_utc})"
        )
    send_telegram_alert(message)


def _completed_candles(payload: Mapping[str, Any], granularity_seconds: int, now: datetime) -> list[dict[str, str]]:
    cutoff = int(now.timestamp()) - (int(now.timestamp()) % granularity_seconds)
    candles = sorted(payload.get("candles", []), key=lambda candle: int(candle["start"]))
    return [
        {
            "start": str(candle["start"]),
            "open": str(candle["open"]),
            "high": str(candle["high"]),
            "low": str(candle["low"]),
            "close": str(candle["close"]),
            "volume": str(candle["volume"]),
        }
        for candle in candles
        if int(candle["start"]) + granularity_seconds <= cutoff
    ]


def _select_best_venue(venues: list[Mapping[str, Any]]) -> dict[str, Any] | None:
    actionable = [dict(venue) for venue in venues if venue.get("action") == "BUY"]
    if actionable:
        actionable.sort(
            key=lambda venue: (
                Decimal(str(venue["selection_score"])),
                Decimal(str(venue["risk"]["net_reward_to_risk"])),
            ),
            reverse=True,
        )
        return actionable[0]

    if not venues:
        return None
    return dict(
        sorted(
            venues,
            key=lambda venue: Decimal(str(venue.get("selection_score", "0"))),
            reverse=True,
        )[0]
    )


def _ema_series(values: list[float], period: int) -> list[float]:
    if period <= 0 or len(values) < period:
        return values[:]
    multiplier = 2 / (period + 1)
    ema = sum(values[:period]) / period
    output = [ema]
    for value in values[period:]:
        ema = ((value - ema) * multiplier) + ema
        output.append(ema)
    prefix = [output[0]] * (period - 1)
    return prefix + output


def _rsi_series(values: list[float], period: int) -> list[float]:
    if len(values) < period + 1:
        return [50.0 for _ in values]
    gains = []
    losses = []
    for index in range(1, period + 1):
        delta = values[index] - values[index - 1]
        gains.append(max(delta, 0.0))
        losses.append(max(-delta, 0.0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    rsi = [50.0] * period
    rs = avg_gain / avg_loss if avg_loss else float("inf")
    rsi.append(100 - (100 / (1 + rs)))
    for index in range(period + 1, len(values)):
        delta = values[index] - values[index - 1]
        gain = max(delta, 0.0)
        loss = max(-delta, 0.0)
        avg_gain = ((avg_gain * (period - 1)) + gain) / period
        avg_loss = ((avg_loss * (period - 1)) + loss) / period
        rs = avg_gain / avg_loss if avg_loss else float("inf")
        rsi.append(100 - (100 / (1 + rs)))
    while len(rsi) < len(values):
        rsi.insert(0, 50.0)
    return rsi


def _macd_series(values: list[float], fast_period: int, slow_period: int, signal_period: int) -> tuple[list[float], list[float]]:
    fast = _ema_series(values, fast_period)
    slow = _ema_series(values, slow_period)
    macd = [fast_value - slow_value for fast_value, slow_value in zip(fast, slow)]
    signal = _ema_series(macd, signal_period)
    return macd, signal


def _atr_series(highs: list[float], lows: list[float], closes: list[float], period: int) -> list[float]:
    if len(highs) < 2:
        return [0.0 for _ in highs]
    true_ranges = [highs[0] - lows[0]]
    for index in range(1, len(highs)):
        true_ranges.append(
            max(
                highs[index] - lows[index],
                abs(highs[index] - closes[index - 1]),
                abs(lows[index] - closes[index - 1]),
            )
        )
    if len(true_ranges) < period:
        return true_ranges
    atr = sum(true_ranges[:period]) / period
    output = [atr]
    for value in true_ranges[period:]:
        atr = ((atr * (period - 1)) + value) / period
        output.append(atr)
    prefix = [output[0]] * (period - 1)
    return prefix + output


def _floor_to_increment(value: Decimal, increment: Decimal) -> Decimal:
    if increment <= 0:
        return value
    steps = (value / increment).to_integral_value(rounding=ROUND_DOWN)
    return steps * increment


def _ceil_to_increment(value: Decimal, increment: Decimal) -> Decimal:
    if increment <= 0:
        return value
    steps = (value / increment).to_integral_value(rounding=ROUND_CEILING)
    return steps * increment


def _clamp(value: Decimal, low: Decimal, high: Decimal) -> Decimal:
    return max(low, min(high, value))


def _optional_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value))


def _decimal_mapping(payload: Mapping[str, Any] | None, defaults: Mapping[str, Decimal]) -> dict[str, Decimal]:
    output = dict(defaults)
    if not payload:
        return output
    for key, value in payload.items():
        output[normalize_exchange_name(str(key))] = Decimal(str(value))
    return output


def _initial_state(config: TAOBotConfig, now: datetime) -> dict[str, Any]:
    timestamp = _timestamp(now)
    return {
        "cash": quantize_string(config.starting_capital),
        "position": None,
        "pending_order": None,
        "manual_kill_switch": False,
        "manual_kill_reason": "",
        "daily": {
            "date": now.strftime("%Y-%m-%d"),
            "starting_equity": quantize_string(config.starting_capital),
            "realized_pnl": "0",
            "losses": 0,
            "cooldown_until": None,
        },
        "updated_at": timestamp,
    }


def _merge_state_defaults(state: Mapping[str, Any], config: TAOBotConfig, now: datetime) -> dict[str, Any]:
    merged = _initial_state(config, now)
    merged.update(state)
    daily = dict(merged["daily"])
    daily.setdefault("date", now.strftime("%Y-%m-%d"))
    daily.setdefault("starting_equity", quantize_string(config.starting_capital))
    daily.setdefault("realized_pnl", "0")
    daily.setdefault("losses", 0)
    daily.setdefault("cooldown_until", None)
    merged["daily"] = daily
    return merged


def _timestamp(now: datetime | None = None) -> str:
    active_now = now or datetime.now(timezone.utc)
    return active_now.strftime("%Y-%m-%dT%H:%M:%SZ")


def _derived_journal_path(state_path: str | Path) -> Path:
    state_file = Path(state_path)
    if is_sqlite_path(state_file):
        return state_file
    if "state" in state_file.stem:
        return state_file.with_name(state_file.name.replace("state", "journal").replace(".json", ".jsonl"))
    return state_file.with_name(f"{state_file.stem}_journal.jsonl")


def _extract_exchange_order_id(exchange: str, payload: Mapping[str, Any] | None) -> str | None:
    if not payload:
        return None
    normalized_exchange = normalize_exchange_name(exchange)
    if normalized_exchange == "coinbase":
        from researcher.coinbase import extract_coinbase_order_id

        return extract_coinbase_order_id(dict(payload))

    from researcher.kraken import extract_kraken_order_id

    return extract_kraken_order_id(dict(payload))


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _stringify(value: Any) -> Any:
    if isinstance(value, Decimal):
        return quantize_string(value)
    if isinstance(value, dict):
        return {key: _stringify(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_stringify(item) for item in value]
    return value
