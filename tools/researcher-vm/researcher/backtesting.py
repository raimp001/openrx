from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from researcher.tao_bot import TAOBotConfig
from tao_autoresearch.train import STARTING_EQUITY, BacktestResult, Candidate, backtest, load_dataset


DEFAULT_TAO_BACKTEST_DATASET = Path("tao_autoresearch/data/kraken_tao_usd.json")
DEFAULT_TAO_BACKTEST_OUTPUT = Path("output/tao_backtest/tao_backtest.json")


def run_tao_backtest(
    config: TAOBotConfig,
    *,
    dataset_path: str | Path = DEFAULT_TAO_BACKTEST_DATASET,
    output_path: str | Path = DEFAULT_TAO_BACKTEST_OUTPUT,
    candidate_path: str | Path | None = None,
) -> tuple[dict[str, Any], Path]:
    dataset = load_dataset(dataset_path)
    dataset_exchange = str(dataset.get("exchange") or config.exchanges[0]).lower()
    baseline = baseline_candidate(config, exchange=dataset_exchange)
    baseline_result = backtest(dataset, baseline)

    selected_source = "baseline"
    selected_candidate = baseline
    if candidate_path is not None:
        selected_candidate = load_candidate_definition(candidate_path)
        selected_source = str(candidate_path)

    selected_result = backtest(dataset, selected_candidate)
    report = {
        "timestamp_utc": _timestamp(),
        "product_id": str(dataset.get("product_id") or config.product_id),
        "dataset_exchange": dataset_exchange,
        "dataset_path": str(dataset_path),
        "starting_equity": STARTING_EQUITY,
        "baseline_candidate": asdict(baseline),
        "baseline_result": asdict(baseline_result),
        "selected_candidate_source": selected_source,
        "selected_candidate": asdict(selected_candidate),
        "selected_result": asdict(selected_result),
        "delta_vs_baseline": build_delta_report(selected_result, baseline_result),
    }

    active_output = Path(output_path)
    active_output.parent.mkdir(parents=True, exist_ok=True)
    active_output.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    return report, active_output


def baseline_candidate(config: TAOBotConfig, *, exchange: str) -> Candidate:
    fee_bps = float(config.estimated_fee_bps_by_exchange.get(exchange, next(iter(config.estimated_fee_bps_by_exchange.values()))))
    return Candidate(
        entry_style=str(getattr(config, "entry_style", "hybrid")),
        trend_ema_period=config.trend_ema_period,
        signal_ema_period=config.signal_ema_period,
        rsi_period=config.rsi_period,
        rsi_lower=40.0,
        rsi_upper=60.0,
        breakout_lookback=config.resistance_lookback_15m,
        support_lookback=config.support_lookback_15m,
        retest_tolerance_pct=float(config.retest_tolerance_pct),
        min_volume_ratio=float(config.min_volume_ratio),
        max_single_candle_move_pct=float(config.max_single_candle_move_pct),
        stop_atr_multiplier=1.35,
        min_stop_loss_pct=float(config.min_stop_loss_pct),
        max_stop_loss_pct=float(config.max_stop_loss_pct),
        take_profit_1_r=float(config.take_profit_1_r),
        take_profit_2_r=float(config.take_profit_2_r),
        trail_after_tp1=bool(config.trail_after_tp1),
        trail_buffer_r=float(config.trail_stop_buffer_r),
        risk_per_trade_pct=float((config.risk_per_trade_min_pct + config.risk_per_trade_max_pct) / 2),
        max_position_notional_pct=float(config.max_position_notional_pct),
        fee_bps=fee_bps,
        slippage_bps=float(config.entry_limit_buffer_bps),
    )


def load_candidate_definition(path: str | Path) -> Candidate:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    candidate_payload = payload.get("best_candidate", payload)
    return candidate_from_payload(candidate_payload)


def candidate_from_payload(candidate_payload: Mapping[str, Any]) -> Candidate:
    fields = Candidate.__dataclass_fields__
    payload = dict(candidate_payload)
    if "entry_style" not in payload:
        payload["entry_style"] = "hybrid"
    missing = [field_name for field_name in fields if field_name not in payload]
    if missing:
        raise ValueError(f"Candidate payload is missing required fields: {', '.join(sorted(missing))}.")
    coerced: dict[str, Any] = {}
    for field_name, field in fields.items():
        value = payload[field_name]
        if field.type is int:
            coerced[field_name] = int(value)
        elif field.type is float:
            coerced[field_name] = float(value)
        elif field.type is bool:
            coerced[field_name] = bool(value)
        else:
            coerced[field_name] = value
    return Candidate(**coerced)


def build_delta_report(selected: BacktestResult, baseline: BacktestResult) -> dict[str, float]:
    return {
        "objective_score": round(selected.objective_score - baseline.objective_score, 6),
        "ending_equity": round(selected.ending_equity - baseline.ending_equity, 6),
        "return_pct": round(selected.return_pct - baseline.return_pct, 6),
        "max_drawdown_pct": round(selected.max_drawdown_pct - baseline.max_drawdown_pct, 6),
        "trades": round(selected.trades - baseline.trades, 6),
        "win_rate_pct": round(selected.win_rate_pct - baseline.win_rate_pct, 6),
        "fees_paid": round(selected.fees_paid - baseline.fees_paid, 6),
    }


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
