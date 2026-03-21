from __future__ import annotations

import json
import time
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from researcher.alerts import send_telegram_alert
from researcher.exchange import ExchangeAPIError, TradingClient, create_exchange_client
from researcher.improvement import DEFAULT_TAO_IMPROVEMENT_STATE, resolve_promoted_paper_config
from researcher.runtime_store import append_log, save_snapshot
from researcher.tao_bot import (
    DEFAULT_TAO_OUTPUT_DIR,
    TAOBotConfig,
    default_tao_journal_path,
    default_tao_state_path,
    run_tao_bot,
)
from tao_autoresearch.train import load_dataset, search, write_outputs


DEFAULT_TAO_AUTOPILOT_HEARTBEAT = Path("runtime/tao_autopilot.db")
DEFAULT_TAO_AUTOPILOT_JOURNAL = DEFAULT_TAO_AUTOPILOT_HEARTBEAT
DEFAULT_TAO_AUTORESEARCH_DATASET = Path("tao_autoresearch/data/kraken_tao_usd.json")
DEFAULT_TAO_AUTORESEARCH_OUTPUT_DIR = Path("tao_autoresearch/runs")


def run_tao_autopilot(
    config: TAOBotConfig,
    *,
    mode: str,
    output_dir: str | Path = DEFAULT_TAO_OUTPUT_DIR,
    state_path: str | Path | None = None,
    journal_path: str | Path | None = None,
    exchange: str = "auto",
    live_ack: str | None = None,
    client_factory: Callable[[str], TradingClient] = create_exchange_client,
    interval_seconds: float = 900.0,
    pending_interval_seconds: float = 60.0,
    iterations: int | None = None,
    heartbeat_path: str | Path = DEFAULT_TAO_AUTOPILOT_HEARTBEAT,
    loop_journal_path: str | Path = DEFAULT_TAO_AUTOPILOT_JOURNAL,
    enable_research: bool = False,
    improvement_state_path: str | Path = DEFAULT_TAO_IMPROVEMENT_STATE,
    research_dataset: str | Path = DEFAULT_TAO_AUTORESEARCH_DATASET,
    research_output_dir: str | Path = DEFAULT_TAO_AUTORESEARCH_OUTPUT_DIR,
    research_budget_seconds: float = 300.0,
    research_max_candidates: int = 128,
    research_seed: int = 1337,
    research_every: int = 12,
    sleep_fn: Callable[[float], None] = time.sleep,
    now_provider: Callable[[], datetime] | None = None,
    bot_runner: Callable[..., tuple[dict[str, Any], Path]] = run_tao_bot,
    dataset_loader: Callable[[str | Path], dict[str, Any]] = load_dataset,
    search_runner: Callable[..., Any] = search,
    research_writer: Callable[..., tuple[Path, Path]] = write_outputs,
    config_resolver: Callable[[TAOBotConfig], tuple[TAOBotConfig, dict[str, Any] | None]] | None = None,
) -> tuple[dict[str, Any], Path]:
    mode_lower = mode.lower()
    if mode_lower not in {"paper", "manual", "live"}:
        raise ValueError("mode must be paper, manual, or live.")
    if iterations is not None and iterations <= 0:
        raise ValueError("iterations must be positive when provided.")
    if interval_seconds < 0:
        raise ValueError("interval_seconds must be zero or greater.")
    if pending_interval_seconds < 0:
        raise ValueError("pending_interval_seconds must be zero or greater.")
    if research_every <= 0:
        raise ValueError("research_every must be positive.")
    if research_budget_seconds <= 0:
        raise ValueError("research_budget_seconds must be positive.")
    if research_max_candidates <= 0:
        raise ValueError("research_max_candidates must be positive.")

    active_state_path = Path(state_path) if state_path is not None else default_tao_state_path(mode_lower)
    active_trade_journal_path = Path(journal_path) if journal_path is not None else default_tao_journal_path(mode_lower)
    active_heartbeat_path = Path(heartbeat_path)
    active_loop_journal_path = Path(loop_journal_path)
    active_research_dataset = Path(research_dataset)
    active_research_output_dir = Path(research_output_dir)
    clock = now_provider or _utc_now

    started_at = _timestamp(clock())
    last_trade_report: dict[str, Any] | None = None
    last_trade_report_path: Path | None = None
    last_research: dict[str, Any] | None = None
    last_paper_candidate: dict[str, Any] | None = None
    last_error: str | None = None
    iterations_completed = 0
    stop_reason = "Reached requested iterations."
    status = "completed"

    initial_summary = _build_summary(
        config=config,
        mode=mode_lower,
        exchange=exchange,
        state_path=active_state_path,
        journal_path=active_trade_journal_path,
        heartbeat_path=active_heartbeat_path,
        loop_journal_path=active_loop_journal_path,
        started_at=started_at,
        updated_at=started_at,
        interval_seconds=interval_seconds,
        pending_interval_seconds=pending_interval_seconds,
        iterations_target=iterations,
        iterations_completed=0,
        status="starting",
        stop_reason=None,
        last_trade_report=last_trade_report,
        last_trade_report_path=last_trade_report_path,
        last_research=last_research,
        last_paper_candidate=last_paper_candidate,
        last_error=last_error,
    )
    _write_summary(active_heartbeat_path, mode_lower, initial_summary)

    try:
        while iterations is None or iterations_completed < iterations:
            cycle_now = clock()
            cycle_timestamp = _timestamp(cycle_now)
            cycle_payload: dict[str, Any] = {
                "type": "cycle",
                "timestamp_utc": cycle_timestamp,
                "iteration": iterations_completed + 1,
                "mode": mode_lower,
                "exchange_request": exchange,
            }

            active_config = config
            paper_candidate = None
            if mode_lower == "paper":
                if config_resolver is not None:
                    active_config, paper_candidate = config_resolver(config)
                else:
                    active_config, paper_candidate = resolve_promoted_paper_config(
                        config,
                        state_path=improvement_state_path,
                    )
                last_paper_candidate = paper_candidate
                if paper_candidate is not None:
                    cycle_payload["paper_candidate"] = paper_candidate

            try:
                trade_report, trade_path = bot_runner(
                    active_config,
                    mode=mode_lower,
                    output_dir=output_dir,
                    state_path=active_state_path,
                    journal_path=active_trade_journal_path,
                    exchange=exchange,
                    live_ack=live_ack,
                    client_factory=client_factory,
                    now=cycle_now,
                )
                last_trade_report = trade_report
                last_trade_report_path = Path(trade_path)
                last_error = None
                cycle_payload["trade"] = {
                    "report_path": str(trade_path),
                    "exchange": trade_report.get("exchange"),
                    "action": trade_report.get("decision", {}).get("action"),
                    "reason": trade_report.get("decision", {}).get("reason"),
                    "pending_order": trade_report.get("pending_order"),
                }
            except ExchangeAPIError as exc:
                last_error = str(exc)
                cycle_payload["trade_error"] = last_error
                send_telegram_alert(f"[TAO] Autopilot trading error at {cycle_timestamp}: {last_error}")

            if enable_research and _research_due(iterations_completed + 1, research_every):
                last_research = _run_autoresearch_cycle(
                    dataset_path=active_research_dataset,
                    output_dir=active_research_output_dir,
                    budget_seconds=research_budget_seconds,
                    max_candidates=research_max_candidates,
                    seed=research_seed,
                    cycle_timestamp=cycle_timestamp,
                    dataset_loader=dataset_loader,
                    search_runner=search_runner,
                    research_writer=research_writer,
                )
                cycle_payload["research"] = last_research
                if last_research["status"] == "error":
                    send_telegram_alert(
                        f"[TAO] Autopilot research error at {cycle_timestamp}: {last_research['error']}"
                    )

            iterations_completed += 1
            sleep_seconds = None
            if iterations is None or iterations_completed < iterations:
                sleep_seconds = _next_sleep_seconds(
                    last_trade_report,
                    interval_seconds=interval_seconds,
                    pending_interval_seconds=pending_interval_seconds,
                )
                cycle_payload["next_sleep_seconds"] = sleep_seconds

            _append_loop_event(active_loop_journal_path, mode_lower, cycle_payload)
            current_summary = _build_summary(
                config=config,
                mode=mode_lower,
                exchange=exchange,
                state_path=active_state_path,
                journal_path=active_trade_journal_path,
                heartbeat_path=active_heartbeat_path,
                loop_journal_path=active_loop_journal_path,
                started_at=started_at,
                updated_at=cycle_timestamp,
                interval_seconds=interval_seconds,
                pending_interval_seconds=pending_interval_seconds,
                iterations_target=iterations,
                iterations_completed=iterations_completed,
                status="running" if iterations is None or iterations_completed < iterations else "completed",
                stop_reason=None if iterations is None or iterations_completed < iterations else stop_reason,
                last_trade_report=last_trade_report,
                last_trade_report_path=last_trade_report_path,
                last_research=last_research,
                last_paper_candidate=last_paper_candidate,
                last_error=last_error,
            )
            _write_summary(active_heartbeat_path, mode_lower, current_summary)

            if sleep_seconds is not None and sleep_seconds > 0:
                sleep_fn(sleep_seconds)
    except KeyboardInterrupt:
        status = "interrupted"
        stop_reason = "Autopilot interrupted by operator."

    finished_at = _timestamp(clock())
    final_summary = _build_summary(
        config=config,
        mode=mode_lower,
        exchange=exchange,
        state_path=active_state_path,
        journal_path=active_trade_journal_path,
        heartbeat_path=active_heartbeat_path,
        loop_journal_path=active_loop_journal_path,
        started_at=started_at,
        updated_at=finished_at,
        interval_seconds=interval_seconds,
        pending_interval_seconds=pending_interval_seconds,
        iterations_target=iterations,
        iterations_completed=iterations_completed,
        status=status,
        stop_reason=stop_reason,
        last_trade_report=last_trade_report,
        last_trade_report_path=last_trade_report_path,
        last_research=last_research,
        last_paper_candidate=last_paper_candidate,
        last_error=last_error,
    )
    _write_summary(active_heartbeat_path, mode_lower, final_summary)
    return final_summary, active_heartbeat_path


def _run_autoresearch_cycle(
    *,
    dataset_path: Path,
    output_dir: Path,
    budget_seconds: float,
    max_candidates: int,
    seed: int,
    cycle_timestamp: str,
    dataset_loader: Callable[[str | Path], dict[str, Any]],
    search_runner: Callable[..., Any],
    research_writer: Callable[..., tuple[Path, Path]],
) -> dict[str, Any]:
    if not dataset_path.exists():
        return {
            "status": "skipped",
            "timestamp_utc": cycle_timestamp,
            "dataset": str(dataset_path),
            "reason": "Dataset not found. Run tao_autoresearch/prepare.py first.",
        }

    try:
        dataset = dataset_loader(dataset_path)
        best_candidate, best_result, history = search_runner(
            dataset,
            budget_seconds=budget_seconds,
            max_candidates=max_candidates,
            seed=seed,
        )
        best_path, history_path = research_writer(
            output_dir,
            best_candidate=best_candidate,
            best_result=best_result,
            history=history,
            dataset=dataset,
        )
    except Exception as exc:
        return {
            "status": "error",
            "timestamp_utc": cycle_timestamp,
            "dataset": str(dataset_path),
            "error": str(exc),
        }

    return {
        "status": "completed",
        "timestamp_utc": cycle_timestamp,
        "dataset": str(dataset_path),
        "output_dir": str(output_dir),
        "best_path": str(best_path),
        "history_path": str(history_path),
        "best_candidate": _to_jsonable(best_candidate),
        "best_result": _to_jsonable(best_result),
        "evaluated_candidates": len(history),
    }


def _build_summary(
    *,
    config: TAOBotConfig,
    mode: str,
    exchange: str,
    state_path: Path,
    journal_path: Path,
    heartbeat_path: Path,
    loop_journal_path: Path,
    started_at: str,
    updated_at: str,
    interval_seconds: float,
    pending_interval_seconds: float,
    iterations_target: int | None,
    iterations_completed: int,
    status: str,
    stop_reason: str | None,
    last_trade_report: dict[str, Any] | None,
    last_trade_report_path: Path | None,
    last_research: dict[str, Any] | None,
    last_paper_candidate: dict[str, Any] | None,
    last_error: str | None,
) -> dict[str, Any]:
    decision = (last_trade_report or {}).get("decision", {})
    return {
        "bot": config.name,
        "product_id": config.product_id,
        "mode": mode,
        "requested_exchange": exchange,
        "status": status,
        "stop_reason": stop_reason,
        "started_at_utc": started_at,
        "updated_at_utc": updated_at,
        "interval_seconds": interval_seconds,
        "pending_interval_seconds": pending_interval_seconds,
        "iterations_target": iterations_target,
        "iterations_completed": iterations_completed,
        "state_path": str(state_path),
        "journal_path": str(journal_path),
        "heartbeat_path": str(heartbeat_path),
        "loop_journal_path": str(loop_journal_path),
        "last_trade_report_path": str(last_trade_report_path) if last_trade_report_path is not None else None,
        "last_trade_exchange": (last_trade_report or {}).get("exchange"),
        "last_trade_action": decision.get("action"),
        "last_trade_reason": decision.get("reason"),
        "last_pending_order": (last_trade_report or {}).get("pending_order"),
        "last_research": last_research,
        "last_paper_candidate": last_paper_candidate,
        "paper_candidate_source": (last_paper_candidate or {}).get("source"),
        "paper_candidate_exchange": (last_paper_candidate or {}).get("exchange"),
        "last_error": last_error,
    }


def _research_due(iteration_number: int, research_every: int) -> bool:
    return iteration_number == 1 or ((iteration_number - 1) % research_every == 0)


def _next_sleep_seconds(
    report: dict[str, Any] | None,
    *,
    interval_seconds: float,
    pending_interval_seconds: float,
) -> float:
    if report and report.get("pending_order"):
        return pending_interval_seconds
    return interval_seconds


def _append_loop_event(path: str | Path, mode: str, payload: dict[str, Any]) -> Path:
    return append_log(path, f"tao_autopilot_journal:{mode}", _to_jsonable(payload))


def _write_summary(path: str | Path, mode: str, payload: dict[str, Any]) -> Path:
    return save_snapshot(path, f"tao_autopilot_heartbeat:{mode}", _to_jsonable(payload))


def _timestamp(now: datetime) -> str:
    return now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_jsonable(value: Any) -> Any:
    if is_dataclass(value):
        return _to_jsonable(asdict(value))
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _to_jsonable(inner) for key, inner in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_jsonable(inner) for inner in value]
    return value
