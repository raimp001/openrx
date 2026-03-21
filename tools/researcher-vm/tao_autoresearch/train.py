from __future__ import annotations

import argparse
import json
import math
import random
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


DEFAULT_DATASET = Path("data/kraken_tao_usd.json")
DEFAULT_OUTPUT_DIR = Path("runs")
STARTING_EQUITY = 100.0
ENTRY_STYLES = (
    "hybrid",
    "dip_buy",
    "breakout_retest",
    "reclaim_trend",
    "momentum_continuation",
)


@dataclass(frozen=True)
class Candidate:
    entry_style: str
    trend_ema_period: int
    signal_ema_period: int
    rsi_period: int
    rsi_lower: float
    rsi_upper: float
    breakout_lookback: int
    support_lookback: int
    retest_tolerance_pct: float
    min_volume_ratio: float
    max_single_candle_move_pct: float
    stop_atr_multiplier: float
    min_stop_loss_pct: float
    max_stop_loss_pct: float
    take_profit_1_r: float
    take_profit_2_r: float
    trail_after_tp1: bool
    trail_buffer_r: float
    risk_per_trade_pct: float
    max_position_notional_pct: float
    fee_bps: float
    slippage_bps: float


@dataclass(frozen=True)
class BacktestResult:
    objective_score: float
    ending_equity: float
    return_pct: float
    max_drawdown_pct: float
    trades: int
    wins: int
    losses: int
    win_rate_pct: float
    fees_paid: float


def load_dataset(path: str | Path) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if "candles_15m" not in payload or "candles_1h" not in payload:
        raise ValueError("Dataset must include candles_15m and candles_1h.")
    return payload


def search(
    dataset: dict[str, Any],
    *,
    budget_seconds: float,
    max_candidates: int,
    seed: int,
) -> tuple[Candidate, BacktestResult, list[dict[str, Any]]]:
    randomizer = random.Random(seed)
    started_at = time.time()
    history: list[dict[str, Any]] = []
    best_candidate: Candidate | None = None
    best_result: BacktestResult | None = None

    for index in range(max_candidates):
        if time.time() - started_at >= budget_seconds:
            break
        candidate = sample_candidate(randomizer)
        result = backtest(dataset, candidate)
        row = {
            "candidate_index": index + 1,
            "candidate": asdict(candidate),
            "result": asdict(result),
        }
        history.append(row)
        if best_result is None or result.objective_score > best_result.objective_score:
            best_candidate = candidate
            best_result = result

    if best_candidate is None or best_result is None:
        raise ValueError("Search did not evaluate any candidates.")
    return best_candidate, best_result, history


def backtest(dataset: dict[str, Any], candidate: Candidate) -> BacktestResult:
    candles_15m = list(dataset["candles_15m"])
    candles_1h = list(dataset["candles_1h"])
    closes_15m = [float(candle["close"]) for candle in candles_15m]
    opens_15m = [float(candle["open"]) for candle in candles_15m]
    highs_15m = [float(candle["high"]) for candle in candles_15m]
    lows_15m = [float(candle["low"]) for candle in candles_15m]
    volumes_15m = [float(candle["volume"]) for candle in candles_15m]
    closes_1h = [float(candle["close"]) for candle in candles_1h]
    volumes_1h = [float(candle["volume"]) for candle in candles_1h]

    ema_1h = ema_series(closes_1h, candidate.trend_ema_period)
    ema_15m = ema_series(closes_15m, candidate.signal_ema_period)
    rsi_15m = rsi_series(closes_15m, candidate.rsi_period)
    macd_15m, macd_signal_15m = macd_series(closes_15m, 12, 26, 9)
    atr_15m = atr_series(highs_15m, lows_15m, closes_15m, 14)
    hour_index_by_15m = build_hour_alignment(candles_15m, candles_1h)

    cash = STARTING_EQUITY
    position: dict[str, float] | None = None
    fees_paid = 0.0
    equity_curve = [STARTING_EQUITY]
    wins = 0
    losses = 0
    trade_count = 0

    lookback = max(
        candidate.signal_ema_period + 5,
        candidate.breakout_lookback + 5,
        candidate.support_lookback + 5,
        candidate.rsi_period + 3,
        20,
    )

    for index in range(lookback, len(candles_15m)):
        close_price = closes_15m[index]
        open_price = opens_15m[index]
        high_price = highs_15m[index]
        low_price = lows_15m[index]
        current_atr = atr_15m[index]
        hour_index = hour_index_by_15m[index]
        trend_ok = hour_index >= 0 and close_price > ema_1h[hour_index]

        if position is not None:
            position["highest_price"] = max(position["highest_price"], high_price)
            if position["tp1_hit"] and candidate.trail_after_tp1:
                trail_stop = position["highest_price"] - (position["risk_per_unit"] * candidate.trail_buffer_r)
                position["stop_price"] = max(position["stop_price"], position["entry_price"], trail_stop)

            exit_price = None
            exit_fraction = 0.0
            if low_price <= position["stop_price"]:
                exit_price = position["stop_price"] * (1 - candidate.slippage_bps / 10000)
                exit_fraction = 1.0
            elif high_price >= position["take_profit_2"]:
                exit_price = position["take_profit_2"]
                exit_fraction = 1.0
            elif (not position["tp1_hit"]) and high_price >= position["take_profit_1"]:
                exit_price = position["take_profit_1"]
                exit_fraction = 0.5

            if exit_price is not None:
                sold_units = position["units"] * exit_fraction
                proceeds = sold_units * exit_price
                exit_fee = proceeds * (candidate.fee_bps / 10000)
                fees_paid += exit_fee
                allocated_cost = position["cost_basis"] * exit_fraction
                pnl = proceeds - exit_fee - allocated_cost
                cash += proceeds - exit_fee
                position["units"] -= sold_units
                position["cost_basis"] -= allocated_cost
                position["realized_pnl"] += pnl

                if exit_fraction >= 1.0 or position["units"] <= 1e-12:
                    trade_count += 1
                    if position["realized_pnl"] >= 0:
                        wins += 1
                    else:
                        losses += 1
                    position = None
                else:
                    position["tp1_hit"] = True
                    position["stop_price"] = max(position["stop_price"], position["entry_price"])

        if position is None:
            if not trend_ok:
                equity_curve.append(cash)
                continue

            latest_rsi = rsi_15m[index]
            previous_rsi = rsi_15m[index - 1]
            bullish_confirmation = close_price > open_price
            pullback_high = max(closes_15m[index - 10 : index + 1])
            pullback_pct = ((pullback_high - close_price) / pullback_high) * 100 if pullback_high else 0.0
            candle_move_pct = abs(close_price - open_price) / open_price * 100 if open_price else 0.0
            support_level = min(lows_15m[index - candidate.support_lookback : index])
            resistance_level = max(highs_15m[index - candidate.breakout_lookback : index - 1])
            volume_ratio = recent_volume_ratio(volumes_1h, hour_index, window=6)
            latest_low = low_price
            uptrend = close_price > ema_1h[hour_index]

            recent_breakout = closes_15m[index - 1] > resistance_level
            retest_hold = latest_low <= resistance_level * (1 + candidate.retest_tolerance_pct / 100) and close_price > resistance_level
            breakout_retest = recent_breakout and retest_hold and bullish_confirmation
            rsi_turn = candidate.rsi_lower <= latest_rsi <= candidate.rsi_upper and latest_rsi > previous_rsi
            macd_cross = macd_15m[index - 1] <= macd_signal_15m[index - 1] and macd_15m[index] > macd_signal_15m[index]
            reclaim = closes_15m[index - 1] <= support_level and close_price > support_level and bullish_confirmation
            momentum_continuation = (
                uptrend
                and bullish_confirmation
                and closes_15m[index - 1] <= resistance_level
                and close_price > resistance_level
                and close_price >= ema_15m[index]
                and macd_cross
                and candle_move_pct <= (candidate.max_single_candle_move_pct * 0.7)
            )
            confirmation = rsi_turn or macd_cross or reclaim or breakout_retest

            if candle_move_pct > candidate.max_single_candle_move_pct or volume_ratio < candidate.min_volume_ratio:
                equity_curve.append(cash)
                continue

            dip_buy = (
                uptrend
                and bullish_confirmation
                and close_price >= ema_15m[index] * 0.995
                and 0.3 <= pullback_pct <= candidate.max_single_candle_move_pct
            )
            reclaim_trend = uptrend and reclaim and confirmation
            setup_flags = {
                "dip_buy": dip_buy and confirmation,
                "breakout_retest": breakout_retest,
                "reclaim_trend": reclaim_trend,
                "momentum_continuation": momentum_continuation,
            }
            if candidate.entry_style == "hybrid":
                active_setup = next(
                    (
                        name
                        for name in (
                            "breakout_retest",
                            "momentum_continuation",
                            "dip_buy",
                            "reclaim_trend",
                        )
                        if setup_flags[name]
                    ),
                    "none",
                )
            else:
                active_setup = candidate.entry_style if setup_flags.get(candidate.entry_style, False) else "none"
            if active_setup == "none":
                equity_curve.append(cash)
                continue

            stop_loss_pct = clamp(current_atr / close_price * 100 * candidate.stop_atr_multiplier, candidate.min_stop_loss_pct, candidate.max_stop_loss_pct)
            risk_amount = cash * (candidate.risk_per_trade_pct / 100)
            max_notional = min(cash, STARTING_EQUITY * (candidate.max_position_notional_pct / 100), risk_amount / (stop_loss_pct / 100))
            if max_notional < 5:
                equity_curve.append(cash)
                continue

            entry_price = close_price * (1 + candidate.slippage_bps / 10000)
            units = max_notional / entry_price
            risk_per_unit = entry_price * (stop_loss_pct / 100)
            take_profit_1 = entry_price + (risk_per_unit * candidate.take_profit_1_r)
            gross_reward_pct = ((take_profit_1 - entry_price) / entry_price) * 100
            net_reward_pct = gross_reward_pct - ((candidate.fee_bps * 2 + candidate.slippage_bps * 2) / 100)
            if net_reward_pct / stop_loss_pct < 1.0:
                equity_curve.append(cash)
                continue

            entry_fee = max_notional * (candidate.fee_bps / 10000)
            cash -= max_notional + entry_fee
            fees_paid += entry_fee
            position = {
                "entry_price": entry_price,
                "units": units,
                "cost_basis": max_notional + entry_fee,
                "stop_price": entry_price - risk_per_unit,
                "take_profit_1": take_profit_1,
                "take_profit_2": entry_price + (risk_per_unit * candidate.take_profit_2_r),
                "risk_per_unit": risk_per_unit,
                "highest_price": entry_price,
                "tp1_hit": False,
                "realized_pnl": 0.0,
            }

        mark_equity = cash
        if position is not None:
            mark_equity += position["units"] * close_price
        equity_curve.append(mark_equity)

    if position is not None:
        final_close = closes_15m[-1]
        proceeds = position["units"] * final_close
        exit_fee = proceeds * (candidate.fee_bps / 10000)
        fees_paid += exit_fee
        pnl = proceeds - exit_fee - position["cost_basis"]
        cash += proceeds - exit_fee
        trade_count += 1
        if pnl >= 0:
            wins += 1
        else:
            losses += 1

    ending_equity = cash
    peak = equity_curve[0]
    max_drawdown_pct = 0.0
    for value in equity_curve:
        peak = max(peak, value)
        if peak > 0:
            max_drawdown_pct = max(max_drawdown_pct, ((peak - value) / peak) * 100)

    return_pct = ((ending_equity / STARTING_EQUITY) - 1) * 100
    win_rate_pct = (wins / trade_count) * 100 if trade_count else 0.0
    objective_score = (
        return_pct
        - (max_drawdown_pct * 2.5)
        - (fees_paid / STARTING_EQUITY * 10)
        + (win_rate_pct * 0.08)
        - max(0, trade_count - 18) * 0.75
    )
    if ending_equity < STARTING_EQUITY:
        objective_score -= 10

    return BacktestResult(
        objective_score=round(objective_score, 6),
        ending_equity=round(ending_equity, 6),
        return_pct=round(return_pct, 6),
        max_drawdown_pct=round(max_drawdown_pct, 6),
        trades=trade_count,
        wins=wins,
        losses=losses,
        win_rate_pct=round(win_rate_pct, 6),
        fees_paid=round(fees_paid, 6),
    )


def sample_candidate(randomizer: random.Random) -> Candidate:
    return Candidate(
        entry_style=randomizer.choice(ENTRY_STYLES),
        trend_ema_period=randomizer.randint(35, 80),
        signal_ema_period=randomizer.randint(12, 34),
        rsi_period=randomizer.randint(10, 18),
        rsi_lower=randomizer.randint(35, 48),
        rsi_upper=randomizer.randint(52, 65),
        breakout_lookback=randomizer.randint(8, 28),
        support_lookback=randomizer.randint(6, 18),
        retest_tolerance_pct=round(randomizer.uniform(0.25, 1.25), 4),
        min_volume_ratio=round(randomizer.uniform(0.55, 1.05), 4),
        max_single_candle_move_pct=round(randomizer.uniform(4.5, 7.0), 4),
        stop_atr_multiplier=round(randomizer.uniform(1.0, 1.9), 4),
        min_stop_loss_pct=round(randomizer.uniform(2.0, 3.0), 4),
        max_stop_loss_pct=round(randomizer.uniform(3.2, 5.0), 4),
        take_profit_1_r=round(randomizer.uniform(1.2, 1.8), 4),
        take_profit_2_r=round(randomizer.uniform(1.8, 3.0), 4),
        trail_after_tp1=randomizer.choice([True, False]),
        trail_buffer_r=round(randomizer.uniform(0.35, 0.9), 4),
        risk_per_trade_pct=round(randomizer.uniform(0.35, 1.0), 4),
        max_position_notional_pct=round(randomizer.uniform(15, 40), 4),
        fee_bps=round(randomizer.uniform(8, 35), 4),
        slippage_bps=round(randomizer.uniform(3, 18), 4),
    )


def ema_series(values: list[float], period: int) -> list[float]:
    if not values:
        return []
    period = max(1, period)
    multiplier = 2 / (period + 1)
    ema = sum(values[:period]) / min(len(values), period)
    output = [ema]
    for value in values[1:]:
        ema = ((value - ema) * multiplier) + ema
        output.append(ema)
    return output


def rsi_series(values: list[float], period: int) -> list[float]:
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
    output = [50.0] * period
    rs = avg_gain / avg_loss if avg_loss else math.inf
    output.append(100 - (100 / (1 + rs)))
    for index in range(period + 1, len(values)):
        delta = values[index] - values[index - 1]
        avg_gain = ((avg_gain * (period - 1)) + max(delta, 0.0)) / period
        avg_loss = ((avg_loss * (period - 1)) + max(-delta, 0.0)) / period
        rs = avg_gain / avg_loss if avg_loss else math.inf
        output.append(100 - (100 / (1 + rs)))
    while len(output) < len(values):
        output.insert(0, 50.0)
    return output


def macd_series(values: list[float], fast: int, slow: int, signal: int) -> tuple[list[float], list[float]]:
    fast_values = ema_series(values, fast)
    slow_values = ema_series(values, slow)
    macd_values = [fast_value - slow_value for fast_value, slow_value in zip(fast_values, slow_values)]
    signal_values = ema_series(macd_values, signal)
    return macd_values, signal_values


def atr_series(highs: list[float], lows: list[float], closes: list[float], period: int) -> list[float]:
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
    atr = sum(true_ranges[:period]) / min(len(true_ranges), period)
    output = [atr]
    for value in true_ranges[1:]:
        atr = ((atr * (period - 1)) + value) / period
        output.append(atr)
    return output


def build_hour_alignment(candles_15m: list[dict[str, Any]], candles_1h: list[dict[str, Any]]) -> list[int]:
    output = []
    hour_index = 0
    hour_starts = [int(candle["start"]) for candle in candles_1h]
    for candle in candles_15m:
        start = int(candle["start"])
        while hour_index + 1 < len(hour_starts) and hour_starts[hour_index + 1] <= start:
            hour_index += 1
        output.append(hour_index if hour_starts else -1)
    return output


def recent_volume_ratio(volumes_1h: list[float], hour_index: int, *, window: int) -> float:
    if hour_index < window * 2:
        return 1.0
    recent = sum(volumes_1h[hour_index - window + 1 : hour_index + 1])
    prior = sum(volumes_1h[hour_index - (window * 2) + 1 : hour_index - window + 1])
    if prior <= 0:
        return 1.0
    return recent / prior


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def write_outputs(
    output_dir: str | Path,
    *,
    best_candidate: Candidate,
    best_result: BacktestResult,
    history: list[dict[str, Any]],
    dataset: dict[str, Any],
) -> tuple[Path, Path]:
    active_dir = Path(output_dir)
    active_dir.mkdir(parents=True, exist_ok=True)
    best_path = active_dir / "best.json"
    history_path = active_dir / "history.jsonl"
    best_payload = {
        "exchange": dataset.get("exchange"),
        "product_id": dataset.get("product_id"),
        "best_candidate": asdict(best_candidate),
        "best_result": asdict(best_result),
        "evaluated_candidates": len(history),
    }
    best_path.write_text(json.dumps(best_payload, indent=2, sort_keys=True), encoding="utf-8")
    with history_path.open("w", encoding="utf-8") as handle:
        for row in history:
            handle.write(json.dumps(row, sort_keys=True) + "\n")
    return best_path, history_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Minimal TAO autoresearch strategy search.")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--budget-seconds", type=float, default=300.0)
    parser.add_argument("--max-candidates", type=int, default=128)
    parser.add_argument("--seed", type=int, default=1337)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    dataset = load_dataset(args.dataset)
    best_candidate, best_result, history = search(
        dataset,
        budget_seconds=args.budget_seconds,
        max_candidates=args.max_candidates,
        seed=args.seed,
    )
    best_path, history_path = write_outputs(
        args.output_dir,
        best_candidate=best_candidate,
        best_result=best_result,
        history=history,
        dataset=dataset,
    )
    print(json.dumps({"best_result": asdict(best_result), "best_candidate": asdict(best_candidate)}, indent=2, sort_keys=True))
    print(f"Wrote {best_path}")
    print(f"Wrote {history_path}")


if __name__ == "__main__":
    main()
