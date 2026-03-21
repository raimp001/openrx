from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Mapping

from researcher.exchange import ExchangeAPIError, TradingClient, normalize_exchange_name


LIVE_TRADING_ACK = "I_ACCEPT_REAL_TRADES"
DEFAULT_STRATEGY_PATH = Path("data/trading_strategy.json")


@dataclass(frozen=True)
class StrategyConfig:
    product_id: str
    quote_currency: str
    base_currency: str
    max_quote_trade: Decimal
    max_base_trade: Decimal
    min_quote_buffer: Decimal
    min_base_trade: Decimal
    buy_signal_bps: Decimal
    sell_signal_bps: Decimal
    max_spread_bps: Decimal
    short_window: int
    long_window: int
    retail_portfolio_id: str | None = None
    exchange: str = "coinbase"


@dataclass(frozen=True)
class SignalDecision:
    action: str
    reason: str
    quote_size: str | None
    base_size: str | None
    metrics: dict[str, str]


def load_strategy(path: str | Path) -> StrategyConfig:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    product_id = payload["product_id"]
    quote_currency, base_currency = _currencies_from_product(product_id)

    return StrategyConfig(
        product_id=product_id,
        quote_currency=payload.get("quote_currency", quote_currency),
        base_currency=payload.get("base_currency", base_currency),
        max_quote_trade=Decimal(str(payload["max_quote_trade"])),
        max_base_trade=Decimal(str(payload["max_base_trade"])),
        min_quote_buffer=Decimal(str(payload["min_quote_buffer"])),
        min_base_trade=Decimal(str(payload["min_base_trade"])),
        buy_signal_bps=Decimal(str(payload["buy_signal_bps"])),
        sell_signal_bps=Decimal(str(payload["sell_signal_bps"])),
        max_spread_bps=Decimal(str(payload["max_spread_bps"])),
        short_window=int(payload["short_window"]),
        long_window=int(payload["long_window"]),
        retail_portfolio_id=payload.get("retail_portfolio_id"),
        exchange=normalize_exchange_name(str(payload.get("exchange", "coinbase"))),
    )


def evaluate_signal(
    ticker: Mapping[str, Any],
    accounts: Mapping[str, Any],
    config: StrategyConfig,
) -> SignalDecision:
    trades = ticker.get("trades", [])
    if len(trades) < config.long_window:
        return SignalDecision(
            action="HOLD",
            reason=f"Need at least {config.long_window} trades; received {len(trades)}.",
            quote_size=None,
            base_size=None,
            metrics={},
        )

    prices = [Decimal(str(trade["price"])) for trade in trades]
    short_avg = _mean(prices[: config.short_window])
    long_avg = _mean(prices[: config.long_window])
    last_price = prices[0]
    best_bid = Decimal(str(ticker["best_bid"]))
    best_ask = Decimal(str(ticker["best_ask"]))
    mid_price = (best_bid + best_ask) / Decimal("2")
    spread_bps = ((best_ask - best_bid) / mid_price) * Decimal("10000") if mid_price else Decimal("0")
    momentum_bps = ((short_avg - long_avg) / long_avg) * Decimal("10000") if long_avg else Decimal("0")
    deviation_bps = ((last_price - long_avg) / long_avg) * Decimal("10000") if long_avg else Decimal("0")

    balances = balances_by_currency(accounts)
    quote_available = balances.get(config.quote_currency, Decimal("0"))
    base_available = balances.get(config.base_currency, Decimal("0"))

    metrics = {
        "last_price": quantize_string(last_price),
        "best_bid": quantize_string(best_bid),
        "best_ask": quantize_string(best_ask),
        "short_avg": quantize_string(short_avg),
        "long_avg": quantize_string(long_avg),
        "momentum_bps": quantize_string(momentum_bps, places="0.01"),
        "deviation_bps": quantize_string(deviation_bps, places="0.01"),
        "spread_bps": quantize_string(spread_bps, places="0.01"),
        "quote_available": quantize_string(quote_available),
        "base_available": quantize_string(base_available, places="0.00000001"),
    }

    if spread_bps > config.max_spread_bps:
        return SignalDecision(
            action="HOLD",
            reason=(
                f"Spread is {quantize_string(spread_bps, places='0.01')} bps, above the configured max "
                f"of {quantize_string(config.max_spread_bps, places='0.01')}."
            ),
            quote_size=None,
            base_size=None,
            metrics=metrics,
        )

    quote_to_deploy = max(quote_available - config.min_quote_buffer, Decimal("0"))
    if momentum_bps >= config.buy_signal_bps and quote_to_deploy > Decimal("0"):
        quote_size = min(quote_to_deploy, config.max_quote_trade)
        if quote_size > Decimal("0"):
            return SignalDecision(
                action="BUY",
                reason=(
                    f"Momentum is {metrics['momentum_bps']} bps with sufficient {config.quote_currency} "
                    f"above the safety buffer."
                ),
                quote_size=quantize_string(quote_size),
                base_size=None,
                metrics=metrics,
            )

    if momentum_bps <= config.sell_signal_bps and base_available >= config.min_base_trade:
        base_size = min(base_available, config.max_base_trade)
        if base_size >= config.min_base_trade:
            return SignalDecision(
                action="SELL",
                reason=(
                    f"Momentum is {metrics['momentum_bps']} bps and available {config.base_currency} "
                    f"meets the minimum trade size."
                ),
                quote_size=None,
                base_size=quantize_string(base_size, places="0.00000001"),
                metrics=metrics,
            )

    return SignalDecision(
        action="HOLD",
        reason="Signal did not clear the configured thresholds.",
        quote_size=None,
        base_size=None,
        metrics=metrics,
    )


def run_trading_bot(
    client: TradingClient,
    config: StrategyConfig,
    *,
    mode: str,
    output_dir: str | Path,
    live_ack: str | None = None,
) -> tuple[dict[str, Any], Path]:
    mode_lower = mode.lower()
    if mode_lower not in {"paper", "live"}:
        raise ValueError("mode must be paper or live.")
    if mode_lower == "live":
        require_live_ack(live_ack, config.exchange)

    accounts = client.list_accounts()
    ticker = client.get_ticker(config.product_id, limit=max(config.long_window, config.short_window))
    decision = evaluate_signal(ticker, accounts, config)

    report: dict[str, Any] = {
        "timestamp_utc": _timestamp(),
        "mode": mode_lower,
        "exchange": config.exchange,
        "config": strategy_to_json(config),
        "decision": asdict(decision),
        "accounts_summary": {
            currency: quantize_string(value, places="0.00000001")
            for currency, value in balances_by_currency(accounts).items()
        },
    }

    if decision.action == "HOLD":
        return _write_trade_report(output_dir, config.exchange, config.product_id, mode_lower, report)

    preview = client.preview_market_order(
        config.product_id,
        decision.action,
        quote_size=decision.quote_size,
        base_size=decision.base_size,
        retail_portfolio_id=config.retail_portfolio_id,
    )
    report["preview"] = preview

    preview_errors = preview.get("errs") or []
    if preview_errors:
        report["decision"]["action"] = "HOLD"
        report["decision"]["reason"] = (
            "Preview returned exchange-side errors: " + ", ".join(str(err) for err in preview_errors)
        )
        return _write_trade_report(output_dir, config.exchange, config.product_id, mode_lower, report)

    if mode_lower == "live":
        order = client.create_market_order(
            config.product_id,
            decision.action,
            quote_size=decision.quote_size,
            base_size=decision.base_size,
            retail_portfolio_id=config.retail_portfolio_id,
            preview_id=preview.get("preview_id"),
        )
        report["live_order"] = order
    else:
        report["paper_order"] = {
            "exchange": config.exchange,
            "product_id": config.product_id,
            "side": decision.action,
            "quote_size": decision.quote_size,
            "base_size": decision.base_size,
            "preview_id": preview.get("preview_id"),
        }

    return _write_trade_report(output_dir, config.exchange, config.product_id, mode_lower, report)


def strategy_to_json(config: StrategyConfig) -> dict[str, Any]:
    return {
        "exchange": config.exchange,
        "product_id": config.product_id,
        "quote_currency": config.quote_currency,
        "base_currency": config.base_currency,
        "max_quote_trade": quantize_string(config.max_quote_trade),
        "max_base_trade": quantize_string(config.max_base_trade, places="0.00000001"),
        "min_quote_buffer": quantize_string(config.min_quote_buffer),
        "min_base_trade": quantize_string(config.min_base_trade, places="0.00000001"),
        "buy_signal_bps": quantize_string(config.buy_signal_bps, places="0.01"),
        "sell_signal_bps": quantize_string(config.sell_signal_bps, places="0.01"),
        "max_spread_bps": quantize_string(config.max_spread_bps, places="0.01"),
        "short_window": config.short_window,
        "long_window": config.long_window,
        "retail_portfolio_id": config.retail_portfolio_id,
    }


def balances_by_currency(accounts: Mapping[str, Any]) -> dict[str, Decimal]:
    balances: dict[str, Decimal] = {}
    for account in accounts.get("accounts", []):
        currency = str(account.get("currency", "")).upper()
        available = Decimal(str(account.get("available_balance", {}).get("value", "0")))
        balances[currency] = balances.get(currency, Decimal("0")) + available
    return balances


def quantize_string(value: Decimal, places: str = "0.00000001") -> str:
    quantized = value.quantize(Decimal(places))
    return format(quantized.normalize(), "f") if "." in format(quantized, "f") else format(quantized, "f")


def require_live_ack(live_ack: str | None, exchange: str) -> None:
    normalized_exchange = normalize_exchange_name(exchange)
    exchange_flag = f"{normalized_exchange.upper()}_ENABLE_LIVE_TRADING"
    if os.getenv("RESEARCHER_ENABLE_LIVE_TRADING") != "1" and os.getenv(exchange_flag) != "1":
        raise ExchangeAPIError(
            f"Live trading blocked. Set RESEARCHER_ENABLE_LIVE_TRADING=1 or {exchange_flag}=1 to unlock."
        )
    if live_ack != LIVE_TRADING_ACK:
        raise ExchangeAPIError(
            f"Live trading blocked. Re-run with --live-ack {LIVE_TRADING_ACK} to confirm real orders."
        )


def _currencies_from_product(product_id: str) -> tuple[str, str]:
    base, quote = product_id.split("-", maxsplit=1)
    return quote.upper(), base.upper()


def _mean(values: list[Decimal]) -> Decimal:
    return sum(values, Decimal("0")) / Decimal(len(values))


def _write_trade_report(
    output_dir: str | Path,
    exchange: str,
    product_id: str,
    mode: str,
    report: dict[str, Any],
) -> tuple[dict[str, Any], Path]:
    report_dir = Path(output_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}_{exchange}_{product_id}_{mode}.json"
    path = report_dir / filename
    path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    return report, path


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
