from __future__ import annotations

import json
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable

from researcher.backtesting import baseline_candidate, build_delta_report, candidate_from_payload
from researcher.runtime_store import append_log, load_snapshot, save_snapshot
from researcher.tao_bot import TAOBotConfig
from tao_autoresearch.train import BacktestResult, Candidate, backtest, load_dataset, search, write_outputs


DEFAULT_TAO_IMPROVEMENT_STATE = Path("runtime/tao_improvement.db")
DEFAULT_TAO_IMPROVEMENT_OUTPUT_DIR = Path("output/tao_improvement")
DEFAULT_TAO_IMPROVEMENT_REPORT = DEFAULT_TAO_IMPROVEMENT_OUTPUT_DIR / "latest.json"
TAO_IMPROVEMENT_SCOPE = "tao_improvement"
TAO_IMPROVEMENT_HISTORY_SCOPE = "tao_improvement_history"


@dataclass(frozen=True)
class PromotionPolicy:
    min_objective_delta: float = 0.75
    min_return_pct: float = 0.5
    min_trades: int = 10
    max_drawdown_pct: float = 8.0
    max_drawdown_regression_pct: float = 1.0
    require_equity_improvement: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "min_objective_delta": self.min_objective_delta,
            "min_return_pct": self.min_return_pct,
            "min_trades": self.min_trades,
            "max_drawdown_pct": self.max_drawdown_pct,
            "max_drawdown_regression_pct": self.max_drawdown_regression_pct,
            "require_equity_improvement": self.require_equity_improvement,
        }


def resolve_promoted_paper_config(
    config: TAOBotConfig,
    *,
    state_path: str | Path = DEFAULT_TAO_IMPROVEMENT_STATE,
) -> tuple[TAOBotConfig, dict[str, Any] | None]:
    snapshot = load_snapshot(state_path, TAO_IMPROVEMENT_SCOPE)
    if not snapshot:
        return config, None
    active_record = snapshot.get("active_paper_candidate")
    if not isinstance(active_record, dict):
        return config, None
    candidate_payload = active_record.get("candidate")
    if not isinstance(candidate_payload, dict):
        return config, None

    candidate = candidate_from_payload(candidate_payload)
    exchange = active_record.get("exchange")
    effective_config = apply_candidate_to_tao_config(config, candidate, exchange=str(exchange) if exchange else None)
    metadata = {
        "source": active_record.get("source", "promoted_paper_candidate"),
        "exchange": exchange,
        "promoted_at_utc": active_record.get("promoted_at_utc"),
        "report_path": active_record.get("report_path"),
    }
    return effective_config, metadata


def apply_candidate_to_tao_config(
    config: TAOBotConfig,
    candidate: Candidate,
    *,
    exchange: str | None = None,
) -> TAOBotConfig:
    fee_map = dict(config.estimated_fee_bps_by_exchange)
    if exchange:
        fee_map[str(exchange).lower()] = Decimal(str(candidate.fee_bps))
    else:
        fee_map = {
            venue: Decimal(str(candidate.fee_bps))
            for venue in fee_map
        }

    max_position_notional_pct = Decimal(str(candidate.max_position_notional_pct))
    max_position_notional = (
        config.starting_capital * max_position_notional_pct / Decimal("100")
    ).quantize(Decimal("0.01"))
    risk_pct = Decimal(str(candidate.risk_per_trade_pct))
    return replace(
        config,
        name=f"{config.name} [paper-promoted]",
        entry_style=str(candidate.entry_style),
        risk_per_trade_min_pct=risk_pct,
        risk_per_trade_max_pct=risk_pct,
        max_position_notional=max_position_notional,
        max_position_notional_pct=max_position_notional_pct,
        min_stop_loss_pct=Decimal(str(candidate.min_stop_loss_pct)),
        max_stop_loss_pct=Decimal(str(candidate.max_stop_loss_pct)),
        stop_atr_multiplier=Decimal(str(candidate.stop_atr_multiplier)),
        take_profit_1_r=Decimal(str(candidate.take_profit_1_r)),
        take_profit_2_r=Decimal(str(candidate.take_profit_2_r)),
        trail_after_tp1=bool(candidate.trail_after_tp1),
        trail_stop_buffer_r=Decimal(str(candidate.trail_buffer_r)),
        estimated_fee_bps_by_exchange=fee_map,
        min_volume_ratio=Decimal(str(candidate.min_volume_ratio)),
        max_single_candle_move_pct=Decimal(str(candidate.max_single_candle_move_pct)),
        trend_ema_period=int(candidate.trend_ema_period),
        signal_ema_period=int(candidate.signal_ema_period),
        rsi_period=int(candidate.rsi_period),
        support_lookback_15m=int(candidate.support_lookback),
        resistance_lookback_15m=int(candidate.breakout_lookback),
        retest_tolerance_pct=Decimal(str(candidate.retest_tolerance_pct)),
        entry_limit_buffer_bps=Decimal(str(candidate.slippage_bps)),
    )


def run_tao_improvement_cycle(
    config: TAOBotConfig,
    *,
    dataset_path: str | Path,
    output_dir: str | Path = DEFAULT_TAO_IMPROVEMENT_OUTPUT_DIR,
    report_path: str | Path = DEFAULT_TAO_IMPROVEMENT_REPORT,
    state_path: str | Path = DEFAULT_TAO_IMPROVEMENT_STATE,
    budget_seconds: float = 300.0,
    max_candidates: int = 128,
    seed: int = 1337,
    policy: PromotionPolicy | None = None,
    now_provider: Callable[[], datetime] | None = None,
    dataset_loader: Callable[[str | Path], dict[str, Any]] = load_dataset,
    search_runner: Callable[..., tuple[Candidate, BacktestResult, list[dict[str, Any]]]] = search,
    research_writer: Callable[..., tuple[Path, Path]] = write_outputs,
) -> tuple[dict[str, Any], Path]:
    active_policy = policy or PromotionPolicy()
    active_now = (now_provider or _utc_now)()
    timestamp_utc = _timestamp(active_now)
    cycle_slug = active_now.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    active_output_dir = Path(output_dir)
    active_report_path = Path(report_path)
    active_state_path = Path(state_path)
    cycle_output_dir = active_output_dir / "cycles" / cycle_slug
    cycle_output_dir.mkdir(parents=True, exist_ok=True)

    previous_state = load_snapshot(active_state_path, TAO_IMPROVEMENT_SCOPE) or {}
    previous_active_record = previous_state.get("active_paper_candidate")
    active_record = previous_active_record if isinstance(previous_active_record, dict) else None

    try:
        dataset = dataset_loader(dataset_path)
        dataset_exchange = str(dataset.get("exchange") or config.exchanges[0]).lower()
        baseline = baseline_candidate(config, exchange=dataset_exchange)
        baseline_result = backtest(dataset, baseline)

        incumbent_source = "baseline"
        incumbent_candidate = baseline
        incumbent_result = baseline_result
        if active_record and isinstance(active_record.get("candidate"), dict):
            incumbent_candidate = candidate_from_payload(active_record["candidate"])
            incumbent_result = backtest(dataset, incumbent_candidate)
            incumbent_source = str(active_record.get("source") or "promoted_paper_candidate")

        best_candidate, best_result, history = search_runner(
            dataset,
            budget_seconds=budget_seconds,
            max_candidates=max_candidates,
            seed=seed,
        )
        best_path, history_path = research_writer(
            cycle_output_dir,
            best_candidate=best_candidate,
            best_result=best_result,
            history=history,
            dataset=dataset,
        )

        promotion = evaluate_candidate_for_paper_promotion(
            best_result=best_result,
            baseline_result=baseline_result,
            incumbent_result=incumbent_result,
            policy=active_policy,
        )

        if promotion["applied"]:
            active_record = {
                "candidate": asdict(best_candidate),
                "exchange": dataset_exchange,
                "source": "search_candidate",
                "promoted_at_utc": timestamp_utc,
                "report_path": str(active_report_path),
                "search_output_dir": str(cycle_output_dir),
            }

        report = {
            "timestamp_utc": timestamp_utc,
            "status": "completed",
            "product_id": str(dataset.get("product_id") or config.product_id),
            "dataset_exchange": dataset_exchange,
            "dataset_path": str(dataset_path),
            "output_dir": str(cycle_output_dir),
            "report_path": str(active_report_path),
            "state_path": str(active_state_path),
            "policy": active_policy.to_dict(),
            "baseline_candidate": asdict(baseline),
            "baseline_result": asdict(baseline_result),
            "incumbent_source": incumbent_source,
            "incumbent_candidate": asdict(incumbent_candidate),
            "incumbent_result": asdict(incumbent_result),
            "search_best_candidate": asdict(best_candidate),
            "search_best_result": asdict(best_result),
            "search_best_path": str(best_path),
            "search_history_path": str(history_path),
            "evaluated_candidates": len(history),
            "delta_vs_baseline": build_delta_report(best_result, baseline_result),
            "delta_vs_incumbent": build_delta_report(best_result, incumbent_result),
            "promotion": promotion,
            "active_paper_candidate": active_record,
        }
    except Exception as exc:
        report = {
            "timestamp_utc": timestamp_utc,
            "status": "error",
            "dataset_path": str(dataset_path),
            "report_path": str(active_report_path),
            "state_path": str(active_state_path),
            "policy": active_policy.to_dict(),
            "error": str(exc),
            "active_paper_candidate": active_record,
        }

    active_report_path.parent.mkdir(parents=True, exist_ok=True)
    active_report_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    save_snapshot(active_state_path, TAO_IMPROVEMENT_SCOPE, report)
    append_log(
        active_state_path,
        TAO_IMPROVEMENT_HISTORY_SCOPE,
        {
            "timestamp_utc": timestamp_utc,
            "status": report["status"],
            "promotion_applied": bool(report.get("promotion", {}).get("applied")),
            "report_path": str(active_report_path),
            "active_source": (report.get("active_paper_candidate") or {}).get("source"),
        },
    )
    return report, active_report_path


def evaluate_candidate_for_paper_promotion(
    *,
    best_result: BacktestResult,
    baseline_result: BacktestResult,
    incumbent_result: BacktestResult,
    policy: PromotionPolicy,
) -> dict[str, Any]:
    objective_delta_vs_baseline = round(best_result.objective_score - baseline_result.objective_score, 6)
    objective_delta_vs_incumbent = round(best_result.objective_score - incumbent_result.objective_score, 6)
    equity_delta_vs_incumbent = round(best_result.ending_equity - incumbent_result.ending_equity, 6)
    drawdown_regression = round(best_result.max_drawdown_pct - incumbent_result.max_drawdown_pct, 6)

    checks = {
        "beats_baseline_objective": objective_delta_vs_baseline > 0,
        "meets_min_objective_delta": objective_delta_vs_incumbent >= policy.min_objective_delta,
        "meets_min_return_pct": best_result.return_pct >= policy.min_return_pct,
        "meets_min_trades": best_result.trades >= policy.min_trades,
        "within_drawdown_ceiling": best_result.max_drawdown_pct <= policy.max_drawdown_pct,
        "drawdown_regression_ok": drawdown_regression <= policy.max_drawdown_regression_pct,
        "equity_improves": (equity_delta_vs_incumbent > 0) if policy.require_equity_improvement else True,
    }

    if all(checks.values()):
        reason = (
            f"Promoted to paper: objective +{objective_delta_vs_incumbent:.2f} vs incumbent, "
            f"return {best_result.return_pct:.2f}%, drawdown {best_result.max_drawdown_pct:.2f}%."
        )
        applied = True
    else:
        failed = [name for name, passed in checks.items() if not passed]
        reason = "Rejected for paper promotion: " + ", ".join(failed) + "."
        applied = False

    return {
        "applied": applied,
        "reason": reason,
        "checks": checks,
        "objective_delta_vs_baseline": objective_delta_vs_baseline,
        "objective_delta_vs_incumbent": objective_delta_vs_incumbent,
        "equity_delta_vs_incumbent": equity_delta_vs_incumbent,
        "drawdown_regression_pct": drawdown_regression,
    }


def _timestamp(now: datetime) -> str:
    return now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)
