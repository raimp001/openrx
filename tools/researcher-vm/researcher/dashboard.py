from __future__ import annotations

import html
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from researcher.autopilot import DEFAULT_TAO_AUTOPILOT_HEARTBEAT
from researcher.backtesting import DEFAULT_TAO_BACKTEST_OUTPUT
from researcher.runtime_store import load_logs, load_snapshot
from researcher.tao_bot import default_tao_state_path


DEFAULT_TAO_DASHBOARD_OUTPUT = Path("output/tao_dashboard/index.html")


def build_tao_dashboard(
    *,
    mode: str = "paper",
    runtime_db: str | Path | None = None,
    autopilot_db: str | Path | None = None,
    backtest_report: str | Path = DEFAULT_TAO_BACKTEST_OUTPUT,
    output_path: str | Path = DEFAULT_TAO_DASHBOARD_OUTPUT,
) -> tuple[dict[str, Any], Path]:
    mode_lower = mode.lower()
    active_runtime = Path(runtime_db) if runtime_db is not None else default_tao_state_path(mode_lower)
    active_autopilot = Path(autopilot_db) if autopilot_db is not None else DEFAULT_TAO_AUTOPILOT_HEARTBEAT
    active_backtest = Path(backtest_report)

    state = load_snapshot(active_runtime, "tao_state") or {}
    journal = load_logs(active_runtime, "tao_journal")
    autopilot = load_snapshot(active_autopilot, f"tao_autopilot_heartbeat:{mode_lower}") or {}
    backtest = _load_json(active_backtest)
    performance = _build_performance_summary(state, journal)

    summary = {
        "generated_at_utc": _timestamp(),
        "mode": mode_lower,
        "runtime_db": str(active_runtime),
        "autopilot_db": str(active_autopilot),
        "backtest_report": str(active_backtest),
        "state": state,
        "position": state.get("position"),
        "daily": state.get("daily"),
        "manual_kill_switch": bool(state.get("manual_kill_switch")),
        "manual_kill_reason": state.get("manual_kill_reason") or "",
        "pending_order": state.get("pending_order"),
        "autopilot": autopilot,
        "backtest": backtest,
        "performance": performance,
        "metrics": _build_runtime_metrics(state, journal, performance),
        "recent_events": journal[-12:][::-1],
    }

    rendered = render_tao_dashboard(summary)
    active_output = Path(output_path)
    active_output.parent.mkdir(parents=True, exist_ok=True)
    active_output.write_text(rendered, encoding="utf-8")
    return summary, active_output


def render_tao_dashboard(summary: dict[str, Any]) -> str:
    metrics = summary["metrics"]
    position = summary.get("position") or {}
    daily = summary.get("daily") or {}
    autopilot = summary.get("autopilot") or {}
    backtest = summary.get("backtest") or {}
    performance = summary.get("performance") or {}
    pending_order = summary.get("pending_order") or {}

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TAO Trader Dashboard</title>
  <style>
    :root {{
      --bg: #f5efe6;
      --paper: rgba(255, 252, 246, 0.88);
      --ink: #1e2b24;
      --muted: #637166;
      --line: rgba(40, 58, 47, 0.14);
      --accent: #1e7a5a;
      --accent-soft: #d6efe6;
      --warning: #b55d2a;
      --warning-soft: #f7dfcf;
      --danger: #8b3430;
      --danger-soft: #f4d8d5;
      --shadow: 0 18px 42px rgba(43, 36, 27, 0.10);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(226, 240, 214, 0.85), transparent 36%),
        radial-gradient(circle at top right, rgba(255, 220, 195, 0.8), transparent 32%),
        linear-gradient(180deg, #fbf7f0 0%, var(--bg) 100%);
      min-height: 100vh;
    }}
    .shell {{
      max-width: 1160px;
      margin: 0 auto;
      padding: 28px 18px 56px;
    }}
    .hero {{
      display: grid;
      gap: 18px;
      padding: 26px;
      border-radius: 28px;
      background: linear-gradient(145deg, rgba(255,255,255,0.78), rgba(238,248,243,0.9));
      border: 1px solid rgba(30, 122, 90, 0.12);
      box-shadow: var(--shadow);
      margin-bottom: 18px;
    }}
    .eyebrow {{
      font-size: 12px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 10px;
    }}
    h1, h2 {{
      font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
      margin: 0;
      font-weight: 600;
      letter-spacing: -0.02em;
    }}
    h1 {{ font-size: clamp(2rem, 3vw, 3.2rem); line-height: 1; }}
    h2 {{ font-size: 1.3rem; margin-bottom: 12px; }}
    .subtitle {{
      display: grid;
      gap: 4px;
      color: var(--muted);
      font-size: 0.96rem;
    }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin: 18px 0 8px;
    }}
    .card {{
      padding: 16px;
      border-radius: 18px;
      background: var(--paper);
      border: 1px solid var(--line);
      box-shadow: 0 10px 24px rgba(62, 51, 37, 0.05);
    }}
    .label {{
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      margin-bottom: 6px;
    }}
    .value {{
      font-size: 1.45rem;
      font-weight: 700;
      line-height: 1.05;
    }}
    .small {{
      margin-top: 6px;
      font-size: 0.88rem;
      color: var(--muted);
    }}
    .panel-grid {{
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 14px;
      margin-top: 14px;
    }}
    .panel {{
      padding: 18px;
      border-radius: 22px;
      background: var(--paper);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
    }}
    .signal {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      font-size: 0.86rem;
      font-weight: 700;
      margin-top: 10px;
    }}
    .signal.ok {{ background: var(--accent-soft); color: var(--accent); }}
    .signal.warn {{ background: var(--warning-soft); color: var(--warning); }}
    .signal.danger {{ background: var(--danger-soft); color: var(--danger); }}
    .kv {{
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid var(--line);
      font-size: 0.95rem;
    }}
    .kv:last-child {{ border-bottom: 0; }}
    .kv .k {{ color: var(--muted); }}
    .kv .v {{ font-weight: 600; text-align: right; }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
    }}
    th, td {{
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }}
    th {{
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
    }}
    .mono {{
      font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
      font-size: 0.9em;
    }}
    .empty {{
      color: var(--muted);
      font-style: italic;
    }}
    @media (max-width: 900px) {{
      .panel-grid {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div>
        <div class="eyebrow">TAO Trader / Local Dashboard</div>
        <h1>Capital first. Evidence before risk.</h1>
      </div>
      <div class="subtitle">
        <div>Mode: <span class="mono">{_escape(summary['mode'])}</span></div>
        <div>Generated: <span class="mono">{_escape(summary['generated_at_utc'])}</span></div>
        <div>Runtime: <span class="mono">{_escape(summary['runtime_db'])}</span></div>
      </div>
      <div class="cards">
        {_metric_card("Cash", metrics["cash"], f"Equity {metrics['equity']}")}
        {_metric_card("Closed Trades", metrics["closed_trades"], f"Win rate {metrics['win_rate_pct']}%")}
        {_metric_card("Realized PnL", metrics["realized_pnl"], f"Avg win {metrics['avg_win']} / avg loss {metrics['avg_loss']}")}
        {_metric_card("Fees", metrics["fees_paid"], f"Realized DD {metrics['realized_drawdown_pct']}%")}
      </div>
    </section>

    <div class="panel-grid">
      <section class="panel">
        <h2>Runtime State</h2>
        <div class="signal {_signal_class(summary)}">{_escape(_signal_text(summary))}</div>
        <div class="kv"><div class="k">Manual kill switch</div><div class="v">{'ON' if summary['manual_kill_switch'] else 'OFF'}</div></div>
        <div class="kv"><div class="k">Kill reason</div><div class="v">{_escape(summary['manual_kill_reason'] or '-')}</div></div>
        <div class="kv"><div class="k">Position exchange</div><div class="v">{_escape(position.get('exchange', '-'))}</div></div>
        <div class="kv"><div class="k">Entry price</div><div class="v">{_escape(position.get('entry_price', '-'))}</div></div>
        <div class="kv"><div class="k">Base size</div><div class="v">{_escape(position.get('base_size', '-'))}</div></div>
        <div class="kv"><div class="k">Stop / TP1 / TP2</div><div class="v">{_escape(_join_values(position.get('stop_price'), position.get('take_profit_1'), position.get('take_profit_2')))}</div></div>
        <div class="kv"><div class="k">Cooldown until</div><div class="v">{_escape(daily.get('cooldown_until', '-') or '-')}</div></div>
        <div class="kv"><div class="k">Pending order</div><div class="v">{_escape(_pending_text(pending_order))}</div></div>
      </section>

      <section class="panel">
        <h2>Autopilot</h2>
        {_autopilot_block(autopilot)}
      </section>
    </div>

    <div class="panel-grid">
      <section class="panel">
        <h2>Performance</h2>
        {_performance_block(performance)}
      </section>

      <section class="panel">
        <h2>Backtest</h2>
        {_backtest_block(backtest)}
      </section>
    </div>

    <div class="panel-grid">
      <section class="panel">
        <h2>Recent Events</h2>
        {_events_table(summary['recent_events'])}
      </section>
    </div>
  </div>
</body>
</html>
"""


def _build_runtime_metrics(state: dict[str, Any], journal: list[dict[str, Any]], performance: dict[str, Any]) -> dict[str, str]:
    daily = state.get("daily") or {}
    pending = state.get("pending_order") or {}
    return {
        "cash": str(state.get("cash", "-")),
        "equity": _runtime_equity(state),
        "pending_status": _pending_text(pending),
        "daily_realized_pnl": str(daily.get("realized_pnl", "0")),
        "daily_losses": str(daily.get("losses", 0)),
        "journal_events": str(len(journal)),
        "closed_trades": str(performance.get("closed_trades", 0)),
        "win_rate_pct": str(performance.get("win_rate_pct", "0")),
        "realized_pnl": str(performance.get("realized_pnl", "0")),
        "avg_win": str(performance.get("avg_win", "0")),
        "avg_loss": str(performance.get("avg_loss", "0")),
        "fees_paid": str(performance.get("fees_paid", "0")),
        "realized_drawdown_pct": str(performance.get("realized_drawdown_pct", "0")),
    }


def _runtime_equity(state: dict[str, Any]) -> str:
    cash = state.get("cash")
    position = state.get("position") or {}
    if cash in {None, ""}:
        return "-"
    if not position:
        return str(cash)
    entry_price = position.get("entry_price")
    base_size = position.get("base_size")
    if entry_price in {None, ""} or base_size in {None, ""}:
        return str(cash)
    try:
        return f"{float(cash) + (float(entry_price) * float(base_size)):.6f}".rstrip("0").rstrip(".")
    except (TypeError, ValueError):
        return str(cash)


def _metric_card(label: str, value: str, small: str) -> str:
    return (
        f'<article class="card"><div class="label">{_escape(label)}</div>'
        f'<div class="value">{_escape(value)}</div><div class="small">{_escape(small)}</div></article>'
    )


def _autopilot_block(autopilot: dict[str, Any]) -> str:
    if not autopilot:
        return '<div class="empty">No autopilot heartbeat found yet.</div>'
    return "".join(
        [
            _kv("Status", autopilot.get("status", "-")),
            _kv("Iterations", autopilot.get("iterations_completed", "-")),
            _kv("Last action", autopilot.get("last_trade_action", "-")),
            _kv("Last reason", autopilot.get("last_trade_reason", "-")),
            _kv("Last exchange", autopilot.get("last_trade_exchange", "-")),
            _kv("Last error", autopilot.get("last_error", "-") or "-"),
            _kv("Updated", autopilot.get("updated_at_utc", "-")),
        ]
    )


def _backtest_block(backtest: dict[str, Any]) -> str:
    if not backtest:
        return '<div class="empty">No backtest report found yet. Run <span class="mono">tao-backtest</span>.</div>'
    selected = backtest.get("selected_result") or {}
    delta = backtest.get("delta_vs_baseline") or {}
    return "".join(
        [
            _kv("Dataset", f"{backtest.get('dataset_exchange', '-')} {backtest.get('product_id', '-')}"),
            _kv("Candidate", backtest.get("selected_candidate_source", "-")),
            _kv("Ending equity", selected.get("ending_equity", "-")),
            _kv("Return %", selected.get("return_pct", "-")),
            _kv("Max drawdown %", selected.get("max_drawdown_pct", "-")),
            _kv("Trades / win rate", _join_values(selected.get("trades", "-"), selected.get("win_rate_pct", "-"))),
            _kv("Delta vs baseline", f"equity {delta.get('ending_equity', '-')} / objective {delta.get('objective_score', '-')}"),
        ]
    )


def _performance_block(performance: dict[str, Any]) -> str:
    if int(performance.get("closed_trades", 0)) <= 0 and float(performance.get("fees_paid", "0") or 0) <= 0:
        note = '<div class="empty">No closed TAO trades have been logged yet.</div>'
    else:
        note = ""
    return note + "".join(
        [
            _kv("Closed trades", performance.get("closed_trades", "0")),
            _kv("Wins / losses / flat", _join_values(performance.get("wins", "0"), performance.get("losses", "0"), performance.get("breakeven", "0"))),
            _kv("Win rate", f"{performance.get('win_rate_pct', '0')}%"),
            _kv("Realized PnL", performance.get("realized_pnl", "0")),
            _kv("Average win / loss", _join_values(performance.get("avg_win", "0"), performance.get("avg_loss", "0"))),
            _kv("Profit factor", performance.get("profit_factor", "0")),
            _kv("Fees paid", performance.get("fees_paid", "0")),
            _kv("Realized drawdown", _join_values(performance.get("realized_drawdown", "0"), f"{performance.get('realized_drawdown_pct', '0')}%")),
            _kv("Stop-loss / TP hits", _join_values(performance.get("stop_loss_count", "0"), performance.get("take_profit_count", "0"))),
        ]
    )


def _build_performance_summary(state: dict[str, Any], journal: list[dict[str, Any]]) -> dict[str, str]:
    completed_trade_pnls: list[float] = []
    realized_changes: list[float] = []
    fees_paid = 0.0
    stop_loss_count = 0
    take_profit_count = 0
    first_cash_before = _as_float((state.get("daily") or {}).get("starting_equity"), default=None)

    for event in journal:
        fill_summary = event.get("fill_summary")
        if not isinstance(fill_summary, dict):
            continue

        fees_paid += _as_float(fill_summary.get("entry_fee"))
        fees_paid += _as_float(fill_summary.get("exit_fee"))

        cash_before = _as_float(fill_summary.get("cash_before"), default=None)
        if first_cash_before is None and cash_before is not None and cash_before > 0:
            first_cash_before = cash_before

        setup = (
            fill_summary.get("setup")
            or (event.get("decision") or {}).get("setup")
            or (event.get("filled_decision") or {}).get("setup")
            or event.get("setup")
            or ""
        )
        side = str(fill_summary.get("side") or "")
        if side == "SELL":
            if "stop" in str(setup):
                stop_loss_count += 1
            if "take_profit" in str(setup):
                take_profit_count += 1

            realized_change = _as_float(fill_summary.get("realized_pnl"), default=None)
            if realized_change is not None:
                realized_changes.append(realized_change)

        position_closed = _as_bool(fill_summary.get("position_closed"))
        total_trade_pnl = _as_float(fill_summary.get("total_trade_pnl"), default=None)
        if position_closed and total_trade_pnl is not None:
            completed_trade_pnls.append(total_trade_pnl)

    wins = [pnl for pnl in completed_trade_pnls if pnl > 0]
    losses = [pnl for pnl in completed_trade_pnls if pnl < 0]
    breakeven = [pnl for pnl in completed_trade_pnls if pnl == 0]
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    realized_pnl = sum(realized_changes)

    realized_curve = 0.0
    realized_peak = 0.0
    max_drawdown = 0.0
    for change in realized_changes:
        realized_curve += change
        realized_peak = max(realized_peak, realized_curve)
        max_drawdown = max(max_drawdown, realized_peak - realized_curve)

    drawdown_base = first_cash_before if first_cash_before and first_cash_before > 0 else None
    realized_drawdown_pct = (max_drawdown / drawdown_base) * 100 if drawdown_base else 0.0

    closed_trades = len(completed_trade_pnls)
    win_rate_pct = (len(wins) / closed_trades) * 100 if closed_trades else 0.0
    avg_win = (gross_profit / len(wins)) if wins else 0.0
    avg_loss = (sum(losses) / len(losses)) if losses else 0.0
    if gross_loss > 0:
        profit_factor = _format_number(gross_profit / gross_loss)
    elif gross_profit > 0:
        profit_factor = "inf"
    else:
        profit_factor = "0.00"

    return {
        "closed_trades": str(closed_trades),
        "wins": str(len(wins)),
        "losses": str(len(losses)),
        "breakeven": str(len(breakeven)),
        "win_rate_pct": _format_number(win_rate_pct),
        "realized_pnl": _format_number(realized_pnl),
        "avg_win": _format_number(avg_win),
        "avg_loss": _format_number(avg_loss),
        "profit_factor": profit_factor,
        "fees_paid": _format_number(fees_paid),
        "realized_drawdown": _format_number(max_drawdown),
        "realized_drawdown_pct": _format_number(realized_drawdown_pct),
        "stop_loss_count": str(stop_loss_count),
        "take_profit_count": str(take_profit_count),
    }


def _events_table(events: list[dict[str, Any]]) -> str:
    if not events:
        return '<div class="empty">No TAO journal events recorded yet.</div>'
    rows = []
    for event in events:
        reason = (
            event.get("reason")
            or event.get("decision", {}).get("reason")
            or event.get("filled_decision", {}).get("reason")
            or "-"
        )
        action = (
            event.get("action")
            or event.get("decision", {}).get("action")
            or event.get("filled_decision", {}).get("action")
            or "-"
        )
        rows.append(
            "<tr>"
            f"<td class='mono'>{_escape(event.get('timestamp_utc', '-'))}</td>"
            f"<td>{_escape(event.get('type', '-'))}</td>"
            f"<td>{_escape(action)}</td>"
            f"<td>{_escape(str(event.get('exchange', '-')))}</td>"
            f"<td>{_escape(str(reason))}</td>"
            "</tr>"
        )
    return (
        "<table><thead><tr><th>Time</th><th>Type</th><th>Action</th><th>Venue</th><th>Reason</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>"
    )


def _kv(key: Any, value: Any) -> str:
    return f'<div class="kv"><div class="k">{_escape(key)}</div><div class="v">{_escape(value)}</div></div>'


def _signal_text(summary: dict[str, Any]) -> str:
    if summary["manual_kill_switch"]:
        return "Manual kill switch is active"
    if summary.get("pending_order"):
        return "Pending order is blocking fresh decisions"
    if summary.get("position"):
        return "Position is open and being managed"
    return "Flat and ready for the next clean setup"


def _signal_class(summary: dict[str, Any]) -> str:
    if summary["manual_kill_switch"]:
        return "danger"
    if summary.get("pending_order"):
        return "warn"
    return "ok"


def _pending_text(pending_order: dict[str, Any]) -> str:
    if not pending_order:
        return "none"
    return f"{pending_order.get('phase', '-')}/{pending_order.get('submission_mode', '-')}"


def _join_values(*values: Any) -> str:
    normalized = [str(value) for value in values if value is not None and value != ""]
    return " / ".join(normalized) if normalized else "-"


def _load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _as_float(value: Any, *, default: float | None = 0.0) -> float | None:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _format_number(value: Any, places: int = 2) -> str:
    parsed = _as_float(value, default=None)
    if parsed is None:
        return "0.00"
    return f"{parsed:.{places}f}"


def _escape(value: Any) -> str:
    if value is None or value == "":
        return "-"
    return html.escape(str(value))


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
