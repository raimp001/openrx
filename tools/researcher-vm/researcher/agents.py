from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Mapping

from researcher.exchange import TradingClient, create_exchange_client
from researcher.scoring import find_company, load_companies, load_weights, rank_companies, score_company
from researcher.trading import (
    StrategyConfig,
    balances_by_currency,
    quantize_string,
    require_live_ack,
)


DEFAULT_AGENT_WATCHLIST = Path("data/agent_watchlist.json")
DEFAULT_SENTIMENT_PATH = Path("data/sentiment_feed.json")
ALLOCATION_BAND = Decimal("0.05")
SUPPORTED_STYLES = ("trend", "breakout", "mean_reversion", "sentiment")


@dataclass(frozen=True)
class AgentStrategy:
    name: str
    trade: StrategyConfig
    research_slug: str | None = None
    style: str = "trend"
    research_buy_floor: Decimal = Decimal("75")
    research_sell_ceiling: Decimal = Decimal("60")
    min_research_coverage: Decimal = Decimal("0.85")
    founder_resilience_floor: Decimal = Decimal("8")
    mission_clarity_floor: Decimal = Decimal("8")
    moat_floor: Decimal = Decimal("7")
    distribution_floor: Decimal = Decimal("6")
    target_base_allocation: Decimal = Decimal("0.35")
    max_base_allocation: Decimal = Decimal("0.60")
    min_base_allocation: Decimal = Decimal("0.05")
    buy_vote_threshold: Decimal = Decimal("2")
    sell_vote_threshold: Decimal = Decimal("-2")
    minimum_hold_hours: int = 72
    add_cooldown_hours: int = 48
    reentry_cooldown_hours: int = 96
    research_weight: Decimal = Decimal("1")
    sentiment_weight: Decimal = Decimal("1")
    market_weight: Decimal = Decimal("1")
    allocator_weight: Decimal = Decimal("1")
    buy_requires_research_confirmation: bool = True
    buy_requires_sentiment_confirmation: bool = False
    sentiment_buy_floor: Decimal = Decimal("1.5")
    sentiment_sell_ceiling: Decimal = Decimal("-1.5")
    max_sentiment_age_hours: int = 36
    breakout_confirmation_bps: Decimal = Decimal("25")
    mean_reversion_entry_bps: Decimal = Decimal("75")
    mean_reversion_exit_bps: Decimal = Decimal("25")
    sizing_aggression: Decimal = Decimal("1.0")

    @property
    def product_id(self) -> str:
        return self.trade.product_id


@dataclass(frozen=True)
class AgentAssessment:
    agent: str
    stance: str
    score: Decimal
    reason: str
    metrics: dict[str, str]


def default_agent_state_path(mode: str) -> Path:
    return Path("runtime") / f"agent_state_{mode.lower()}.json"


def load_agent_watchlist(path: str | Path) -> list[AgentStrategy]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    entries = payload if isinstance(payload, list) else [payload]
    return [strategy_from_mapping(entry) for entry in entries]


def load_sentiment_feed(path: str | Path | None = DEFAULT_SENTIMENT_PATH) -> dict[str, Any]:
    if path is None:
        return {}

    sentiment_path = Path(path)
    if not sentiment_path.exists():
        return {}
    return json.loads(sentiment_path.read_text(encoding="utf-8"))


def strategy_from_mapping(payload: Mapping[str, Any]) -> AgentStrategy:
    product_id = str(payload["product_id"])
    base_currency, quote_currency = product_id.split("-", maxsplit=1)

    trade = StrategyConfig(
        product_id=product_id,
        quote_currency=str(payload.get("quote_currency", quote_currency)).upper(),
        base_currency=str(payload.get("base_currency", base_currency)).upper(),
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
        exchange=str(payload.get("exchange", "coinbase")).lower(),
    )

    return AgentStrategy(
        name=str(payload.get("name", product_id)),
        trade=trade,
        research_slug=payload.get("research_slug"),
        style=normalize_style(str(payload.get("style", "trend"))),
        research_buy_floor=Decimal(str(payload.get("research_buy_floor", "75"))),
        research_sell_ceiling=Decimal(str(payload.get("research_sell_ceiling", "60"))),
        min_research_coverage=Decimal(str(payload.get("min_research_coverage", "0.85"))),
        founder_resilience_floor=Decimal(str(payload.get("founder_resilience_floor", "8"))),
        mission_clarity_floor=Decimal(str(payload.get("mission_clarity_floor", "8"))),
        moat_floor=Decimal(str(payload.get("moat_floor", "7"))),
        distribution_floor=Decimal(str(payload.get("distribution_floor", "6"))),
        target_base_allocation=Decimal(str(payload.get("target_base_allocation", "0.35"))),
        max_base_allocation=Decimal(str(payload.get("max_base_allocation", "0.60"))),
        min_base_allocation=Decimal(str(payload.get("min_base_allocation", "0.05"))),
        buy_vote_threshold=Decimal(str(payload.get("buy_vote_threshold", "2"))),
        sell_vote_threshold=Decimal(str(payload.get("sell_vote_threshold", "-2"))),
        minimum_hold_hours=int(payload.get("minimum_hold_hours", 72)),
        add_cooldown_hours=int(payload.get("add_cooldown_hours", 48)),
        reentry_cooldown_hours=int(payload.get("reentry_cooldown_hours", 96)),
        research_weight=Decimal(str(payload.get("research_weight", "1.0"))),
        sentiment_weight=Decimal(str(payload.get("sentiment_weight", "1.0"))),
        market_weight=Decimal(str(payload.get("market_weight", "1.0"))),
        allocator_weight=Decimal(str(payload.get("allocator_weight", "1.0"))),
        buy_requires_research_confirmation=_coerce_bool(payload.get("buy_requires_research_confirmation", True)),
        buy_requires_sentiment_confirmation=_coerce_bool(payload.get("buy_requires_sentiment_confirmation", False)),
        sentiment_buy_floor=Decimal(str(payload.get("sentiment_buy_floor", "1.5"))),
        sentiment_sell_ceiling=Decimal(str(payload.get("sentiment_sell_ceiling", "-1.5"))),
        max_sentiment_age_hours=int(payload.get("max_sentiment_age_hours", 36)),
        breakout_confirmation_bps=Decimal(str(payload.get("breakout_confirmation_bps", "25"))),
        mean_reversion_entry_bps=Decimal(str(payload.get("mean_reversion_entry_bps", "75"))),
        mean_reversion_exit_bps=Decimal(str(payload.get("mean_reversion_exit_bps", "25"))),
        sizing_aggression=Decimal(str(payload.get("sizing_aggression", "1.0"))),
    )


def load_agent_state(path: str | Path | None) -> dict[str, Any]:
    if path is None:
        return {}

    state_path = Path(path)
    if not state_path.exists():
        return {}
    return json.loads(state_path.read_text(encoding="utf-8"))


def save_agent_state(path: str | Path, state: Mapping[str, Any]) -> Path:
    state_path = Path(path)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
    return state_path


def position_key(strategy: AgentStrategy) -> str:
    return f"{strategy.trade.exchange}:{strategy.product_id}"


def strategy_key(strategy: AgentStrategy) -> str:
    return f"{position_key(strategy)}:{_slugify(strategy.name)}"


def normalize_style(style: str) -> str:
    normalized = style.strip().lower()
    if normalized not in SUPPORTED_STYLES:
        raise ValueError(f"Unsupported style: {style}. Choose from {', '.join(SUPPORTED_STYLES)}.")
    return normalized


def _state_entry_for_strategy(state: Mapping[str, Any], strategy: AgentStrategy) -> Mapping[str, Any] | None:
    return (
        state.get(position_key(strategy))
        or state.get(strategy_key(strategy))
        or state.get(strategy.product_id)
    )


def evaluate_agent_strategy(
    strategy: AgentStrategy,
    accounts: Mapping[str, Any],
    ticker: Mapping[str, Any],
    companies: list[Mapping[str, Any]],
    weights: Mapping[str, float],
    *,
    sentiment_feed: Mapping[str, Any] | None = None,
    state_entry: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    market_snapshot = build_market_snapshot(ticker, strategy.trade)
    research_agent, research_snapshot = evaluate_research_agent(strategy, companies, weights)
    sentiment_agent, sentiment_snapshot = evaluate_sentiment_agent(strategy, sentiment_feed or {})
    market_agent = evaluate_market_agent(strategy, market_snapshot)
    allocator_agent = evaluate_allocator_agent(strategy, accounts, market_snapshot["mid_price"])

    committee = [research_agent, sentiment_agent, market_agent, allocator_agent]
    weighted_votes = {
        "research": weighted_agent_score(research_agent.score, strategy.research_weight),
        "sentiment": weighted_agent_score(sentiment_agent.score, strategy.sentiment_weight),
        "market": weighted_agent_score(market_agent.score, strategy.market_weight),
        "allocator": weighted_agent_score(allocator_agent.score, strategy.allocator_weight),
    }
    total_score = sum(weighted_votes.values(), Decimal("0"))
    max_score = committee_max_score(strategy)
    candidate_action = candidate_action_from_score(total_score, strategy)

    if candidate_action == "BUY" and strategy.buy_requires_research_confirmation and research_agent.stance != "BUY":
        candidate_action = "HOLD"
    if candidate_action == "BUY" and strategy.buy_requires_sentiment_confirmation and sentiment_agent.stance != "BUY":
        candidate_action = "HOLD"

    state_agent = evaluate_state_agent(
        strategy,
        state_entry,
        candidate_action,
        research_agent,
        market_agent,
    )
    risk_agent, quote_size, base_size = evaluate_risk_agent(
        strategy,
        accounts,
        market_snapshot["mid_price"],
        total_score,
        candidate_action,
        max_score,
    )

    final_action = candidate_action
    reason = _committee_reason(committee, state_agent, risk_agent)
    if state_agent.stance == "BLOCK":
        final_action = "HOLD"
        reason = f"State agent blocked {candidate_action}: {state_agent.reason}"
        quote_size = None
        base_size = None
    elif risk_agent.stance == "BLOCK":
        final_action = "HOLD"
        reason = f"Risk agent blocked {candidate_action}: {risk_agent.reason}"
        quote_size = None
        base_size = None
    elif candidate_action == "HOLD":
        reason = "Committee did not reach the vote threshold."

    edge_score = opportunity_score(final_action, total_score, max_score, sentiment_snapshot)
    report = {
        "exchange": strategy.trade.exchange,
        "strategy_key": strategy_key(strategy),
        "position_key": position_key(strategy),
        "strategy": strategy_to_dict(strategy),
        "product_id": strategy.product_id,
        "research_slug": strategy.research_slug,
        "market_snapshot": _snapshot_to_strings(market_snapshot),
        "research_snapshot": research_snapshot,
        "sentiment_snapshot": sentiment_snapshot,
        "weighted_votes": {name: quantize_string(value, places="0.01") for name, value in weighted_votes.items()},
        "agents": [agent_to_dict(agent) for agent in committee]
        + [agent_to_dict(state_agent), agent_to_dict(risk_agent)],
        "decision": {
            "candidate_action": candidate_action,
            "action": final_action,
            "total_score": quantize_string(total_score, places="0.01"),
            "max_committee_score": quantize_string(max_score, places="0.01"),
            "edge_score": quantize_string(edge_score, places="0.01"),
            "confidence": confidence_label(total_score, max_score),
            "reason": reason,
            "quote_size": quote_size,
            "base_size": base_size,
        },
    }
    return report


def scan_agent_watchlist(
    strategies: list[AgentStrategy],
    *,
    companies_path: str | Path,
    weights_path: str | Path | None = None,
    state_path: str | Path | None = None,
    sentiment_path: str | Path | None = DEFAULT_SENTIMENT_PATH,
) -> list[dict[str, Any]]:
    companies = load_companies(companies_path)
    weights = load_weights(weights_path)
    sentiment_feed = load_sentiment_feed(sentiment_path)
    state = load_agent_state(state_path)
    reports = []
    clients: dict[str, TradingClient] = {}
    accounts_by_exchange: dict[str, Mapping[str, Any]] = {}

    for strategy in strategies:
        client = _client_for_exchange(clients, strategy.trade.exchange)
        accounts = accounts_by_exchange.get(strategy.trade.exchange)
        if accounts is None:
            accounts = client.list_accounts()
            accounts_by_exchange[strategy.trade.exchange] = accounts
        ticker = client.get_ticker(strategy.product_id, limit=max(strategy.trade.long_window, strategy.trade.short_window))
        report = evaluate_agent_strategy(
            strategy,
            accounts,
            ticker,
            companies,
            weights,
            sentiment_feed=sentiment_feed,
            state_entry=_state_entry_for_strategy(state, strategy),
        )
        reports.append(report)

    return sorted(reports, key=_report_sort_key, reverse=True)


def run_agent_trade(
    strategy: AgentStrategy,
    *,
    companies_path: str | Path,
    weights_path: str | Path | None,
    mode: str,
    output_dir: str | Path,
    live_ack: str | None = None,
    state_path: str | Path | None = None,
    sentiment_path: str | Path | None = DEFAULT_SENTIMENT_PATH,
    client: TradingClient | None = None,
) -> tuple[dict[str, Any], Path]:
    mode_lower = mode.lower()
    if mode_lower not in {"paper", "live"}:
        raise ValueError("mode must be paper or live.")
    if mode_lower == "live":
        require_live_ack(live_ack, strategy.trade.exchange)

    active_state_path = Path(state_path) if state_path is not None else default_agent_state_path(mode_lower)
    state = load_agent_state(active_state_path)
    companies = load_companies(companies_path)
    weights = load_weights(weights_path)
    sentiment_feed = load_sentiment_feed(sentiment_path)
    active_client = client or create_exchange_client(strategy.trade.exchange)
    accounts = active_client.list_accounts()
    ticker = active_client.get_ticker(strategy.product_id, limit=max(strategy.trade.long_window, strategy.trade.short_window))
    report = evaluate_agent_strategy(
        strategy,
        accounts,
        ticker,
        companies,
        weights,
        sentiment_feed=sentiment_feed,
        state_entry=_state_entry_for_strategy(state, strategy),
    )
    report["timestamp_utc"] = _timestamp()
    report["mode"] = mode_lower
    report["accounts_summary"] = {
        currency: quantize_string(value, places="0.00000001")
        for currency, value in balances_by_currency(accounts).items()
    }
    report["state_path"] = str(active_state_path)

    decision = report["decision"]
    if decision["action"] == "HOLD":
        return _write_agent_report(output_dir, strategy, mode_lower, report)

    preview = active_client.preview_market_order(
        strategy.product_id,
        decision["action"],
        quote_size=decision["quote_size"],
        base_size=decision["base_size"],
        retail_portfolio_id=strategy.trade.retail_portfolio_id,
    )
    report["preview"] = preview

    preview_errors = preview.get("errs") or []
    if preview_errors:
        report["decision"]["action"] = "HOLD"
        report["decision"]["reason"] = "Preview returned exchange-side errors: " + ", ".join(str(err) for err in preview_errors)
        return _write_agent_report(output_dir, strategy, mode_lower, report)

    if mode_lower == "live":
        order = active_client.create_market_order(
            strategy.product_id,
            decision["action"],
            quote_size=decision["quote_size"],
            base_size=decision["base_size"],
            retail_portfolio_id=strategy.trade.retail_portfolio_id,
            preview_id=preview.get("preview_id"),
        )
        report["live_order"] = order
    else:
        report["paper_order"] = {
            "exchange": strategy.trade.exchange,
            "product_id": strategy.product_id,
            "strategy_key": strategy_key(strategy),
            "side": decision["action"],
            "quote_size": decision["quote_size"],
            "base_size": decision["base_size"],
            "preview_id": preview.get("preview_id"),
        }

    state[position_key(strategy)] = {
        "strategy_name": strategy.name,
        "strategy_key": strategy_key(strategy),
        "last_action": decision["action"],
        "last_trade_at": report["timestamp_utc"],
        "last_mode": mode_lower,
        "quote_size": decision["quote_size"],
        "base_size": decision["base_size"],
    }
    save_agent_state(active_state_path, state)
    report["state_updated"] = True

    return _write_agent_report(output_dir, strategy, mode_lower, report)


def evaluate_research_agent(
    strategy: AgentStrategy,
    companies: list[Mapping[str, Any]],
    weights: Mapping[str, float],
) -> tuple[AgentAssessment, dict[str, str]]:
    if not strategy.research_slug:
        assessment = AgentAssessment(
            agent="research",
            stance="HOLD",
            score=Decimal("0"),
            reason="No linked research slug for this product.",
            metrics={},
        )
        return assessment, {}

    company = find_company(companies, strategy.research_slug)
    scored = score_company(company, weights)
    criteria = _criteria_lookup(scored)
    weighted_score = Decimal(str(scored["weighted_score"]))
    coverage = Decimal(str(scored["coverage"]))
    founder_score = criteria.get("leadership_resilience", Decimal("0"))
    mission_score = criteria.get("mission_clarity", Decimal("0"))
    moat_score = criteria.get("moat", Decimal("0"))
    distribution_score = criteria.get("distribution", Decimal("0"))

    passes_buy_gate = all(
        [
            weighted_score >= strategy.research_buy_floor,
            coverage >= strategy.min_research_coverage,
            founder_score >= strategy.founder_resilience_floor,
            mission_score >= strategy.mission_clarity_floor,
            moat_score >= strategy.moat_floor,
            distribution_score >= strategy.distribution_floor,
        ]
    )
    trips_sell_gate = any(
        [
            weighted_score <= strategy.research_sell_ceiling,
            founder_score < max(strategy.founder_resilience_floor - Decimal("2"), Decimal("0")),
            mission_score < max(strategy.mission_clarity_floor - Decimal("2"), Decimal("0")),
        ]
    )

    if passes_buy_gate:
        stance = "BUY"
        score = Decimal("1")
        reason = "Weighted score, coverage, founder, mission, moat, and distribution all clear the buy gate."
    elif trips_sell_gate:
        stance = "SELL"
        score = Decimal("-1")
        reason = "Research quality or thesis score has fallen through the sell gate."
    else:
        stance = "HOLD"
        score = Decimal("0")
        reason = "Research is interesting but does not yet clear the full founder/thesis gate."

    metrics = {
        "weighted_score": quantize_string(weighted_score, places="0.1"),
        "coverage": quantize_string(coverage * Decimal("100"), places="0.01"),
        "founder_score": quantize_string(founder_score, places="0.1"),
        "mission_score": quantize_string(mission_score, places="0.1"),
        "moat_score": quantize_string(moat_score, places="0.1"),
        "distribution_score": quantize_string(distribution_score, places="0.1"),
        "conviction": scored["conviction"],
    }

    assessment = AgentAssessment(
        agent="research",
        stance=stance,
        score=score,
        reason=reason,
        metrics=metrics,
    )
    return assessment, {
        **metrics,
        "rank": str(_company_rank(scored["slug"], companies, weights)),
    }


def evaluate_sentiment_agent(
    strategy: AgentStrategy,
    sentiment_feed: Mapping[str, Any],
) -> tuple[AgentAssessment, dict[str, str]]:
    snapshot = build_sentiment_snapshot(strategy, sentiment_feed)
    total_score = snapshot["total_score_decimal"]
    freshness_hours = snapshot["freshness_hours_decimal"]

    if snapshot["coverage_decimal"] <= 0:
        reason = "No sentiment snapshot is loaded for this product."
        if snapshot["stale_components"] > 0:
            reason = "All available sentiment inputs are stale, so sentiment is ignored for execution."
        assessment = AgentAssessment(
            agent="sentiment",
            stance="HOLD",
            score=Decimal("0"),
            reason=reason,
            metrics=_sentiment_metrics(snapshot),
        )
        return assessment, _sentiment_snapshot_to_strings(snapshot)

    if freshness_hours > Decimal(str(strategy.max_sentiment_age_hours)):
        assessment = AgentAssessment(
            agent="sentiment",
            stance="HOLD",
            score=Decimal("0"),
            reason="Sentiment data is stale, so it is ignored for execution.",
            metrics=_sentiment_metrics(snapshot),
        )
        return assessment, _sentiment_snapshot_to_strings(snapshot)

    if total_score >= strategy.sentiment_buy_floor:
        assessment = AgentAssessment(
            agent="sentiment",
            stance="BUY",
            score=Decimal("1"),
            reason="Aggregate sentiment is above the buy floor for this strategy style.",
            metrics=_sentiment_metrics(snapshot),
        )
        return assessment, _sentiment_snapshot_to_strings(snapshot)

    if total_score <= strategy.sentiment_sell_ceiling:
        assessment = AgentAssessment(
            agent="sentiment",
            stance="SELL",
            score=Decimal("-1"),
            reason="Aggregate sentiment is below the sell floor for this strategy style.",
            metrics=_sentiment_metrics(snapshot),
        )
        return assessment, _sentiment_snapshot_to_strings(snapshot)

    assessment = AgentAssessment(
        agent="sentiment",
        stance="HOLD",
        score=Decimal("0"),
        reason="Sentiment is mixed and does not justify a directional vote.",
        metrics=_sentiment_metrics(snapshot),
    )
    return assessment, _sentiment_snapshot_to_strings(snapshot)


def evaluate_market_agent(strategy: AgentStrategy, snapshot: Mapping[str, Decimal]) -> AgentAssessment:
    spread_bps = snapshot["spread_bps"]
    momentum_bps = snapshot["momentum_bps"]
    deviation_bps = snapshot["deviation_bps"]
    last_price = snapshot["last_price"]
    short_avg = snapshot["short_avg"]
    long_avg = snapshot["long_avg"]

    metrics = {
        "style": strategy.style,
        "spread_bps": quantize_string(spread_bps, places="0.01"),
        "momentum_bps": quantize_string(momentum_bps, places="0.01"),
        "deviation_bps": quantize_string(deviation_bps, places="0.01"),
    }

    if spread_bps > strategy.trade.max_spread_bps:
        return AgentAssessment(
            agent="market",
            stance="HOLD",
            score=Decimal("0"),
            reason="Spread is too wide for execution quality.",
            metrics=metrics,
        )

    if strategy.style == "trend":
        if momentum_bps >= strategy.trade.buy_signal_bps and last_price >= short_avg >= long_avg:
            return AgentAssessment(
                agent="market",
                stance="BUY",
                score=Decimal("1"),
                reason="Trend style sees aligned momentum with price above both moving averages.",
                metrics=metrics,
            )
        if momentum_bps <= strategy.trade.sell_signal_bps and last_price <= short_avg:
            return AgentAssessment(
                agent="market",
                stance="SELL",
                score=Decimal("-1"),
                reason="Trend style sees momentum rolling over below the sell threshold.",
                metrics=metrics,
            )
        return AgentAssessment(
            agent="market",
            stance="HOLD",
            score=Decimal("0"),
            reason="Trend style does not yet see enough continuation.",
            metrics=metrics,
        )

    if strategy.style == "breakout":
        if (
            momentum_bps >= strategy.trade.buy_signal_bps
            and deviation_bps >= strategy.breakout_confirmation_bps
            and last_price > short_avg > long_avg
        ):
            return AgentAssessment(
                agent="market",
                stance="BUY",
                score=Decimal("1"),
                reason="Breakout style sees momentum, deviation, and trend alignment clearing the entry gate.",
                metrics=metrics,
            )
        if momentum_bps <= strategy.trade.sell_signal_bps and last_price < short_avg:
            return AgentAssessment(
                agent="market",
                stance="SELL",
                score=Decimal("-1"),
                reason="Breakout style sees failed continuation and deteriorating momentum.",
                metrics=metrics,
            )
        return AgentAssessment(
            agent="market",
            stance="HOLD",
            score=Decimal("0"),
            reason="Breakout style is waiting for cleaner expansion or a failed move.",
            metrics=metrics,
        )

    if strategy.style == "mean_reversion":
        if deviation_bps <= -strategy.mean_reversion_entry_bps and last_price <= short_avg:
            return AgentAssessment(
                agent="market",
                stance="BUY",
                score=Decimal("1"),
                reason="Mean-reversion style sees price stretched well below the longer trend.",
                metrics=metrics,
            )
        if deviation_bps >= strategy.mean_reversion_exit_bps:
            return AgentAssessment(
                agent="market",
                stance="SELL",
                score=Decimal("-1"),
                reason="Mean-reversion style sees the snapback target reached.",
                metrics=metrics,
            )
        return AgentAssessment(
            agent="market",
            stance="HOLD",
            score=Decimal("0"),
            reason="Mean-reversion style does not see enough dislocation.",
            metrics=metrics,
        )

    if momentum_bps >= Decimal("0") and last_price >= short_avg:
        return AgentAssessment(
            agent="market",
            stance="BUY",
            score=Decimal("1"),
            reason="Sentiment-led style has price confirmation from a stable short-term tape.",
            metrics=metrics,
        )
    if momentum_bps <= strategy.trade.sell_signal_bps or last_price < short_avg:
        return AgentAssessment(
            agent="market",
            stance="SELL",
            score=Decimal("-1"),
            reason="Sentiment-led style sees the tape turning against the thesis.",
            metrics=metrics,
        )
    return AgentAssessment(
        agent="market",
        stance="HOLD",
        score=Decimal("0"),
        reason="Sentiment-led style is waiting for better tape confirmation.",
        metrics=metrics,
    )


def evaluate_allocator_agent(
    strategy: AgentStrategy,
    accounts: Mapping[str, Any],
    mid_price: Decimal,
) -> AgentAssessment:
    balances = balances_by_currency(accounts)
    quote_available = balances.get(strategy.trade.quote_currency, Decimal("0"))
    base_available = balances.get(strategy.trade.base_currency, Decimal("0"))
    base_value = base_available * mid_price
    total_value = quote_available + base_value

    if total_value <= 0:
        return AgentAssessment(
            agent="allocator",
            stance="HOLD",
            score=Decimal("0"),
            reason="No quote or base inventory available for allocation decisions.",
            metrics={},
        )

    allocation = base_value / total_value
    gap = strategy.target_base_allocation - allocation

    metrics = {
        "base_allocation": quantize_string(allocation * Decimal("100"), places="0.01"),
        "target_base_allocation": quantize_string(strategy.target_base_allocation * Decimal("100"), places="0.01"),
        "allocation_gap": quantize_string(gap * Decimal("100"), places="0.01"),
    }

    if gap >= ALLOCATION_BAND:
        return AgentAssessment(
            agent="allocator",
            stance="BUY",
            score=Decimal("1"),
            reason="Current base allocation is materially below target.",
            metrics=metrics,
        )

    if gap <= -ALLOCATION_BAND:
        return AgentAssessment(
            agent="allocator",
            stance="SELL",
            score=Decimal("-1"),
            reason="Current base allocation is materially above target.",
            metrics=metrics,
        )

    return AgentAssessment(
        agent="allocator",
        stance="HOLD",
        score=Decimal("0"),
        reason="Current base allocation is already near target.",
        metrics=metrics,
    )


def evaluate_state_agent(
    strategy: AgentStrategy,
    state_entry: Mapping[str, Any] | None,
    candidate_action: str,
    research_agent: AgentAssessment,
    market_agent: AgentAssessment,
) -> AgentAssessment:
    if candidate_action == "HOLD":
        return AgentAssessment(
            agent="state",
            stance="HOLD",
            score=Decimal("0"),
            reason="No pending trade, so no state constraint applies.",
            metrics={},
        )

    if not state_entry or not state_entry.get("last_trade_at"):
        return AgentAssessment(
            agent="state",
            stance="HOLD",
            score=Decimal("0"),
            reason="No prior trade recorded for this product.",
            metrics={},
        )

    age_hours = _age_hours(str(state_entry["last_trade_at"]))
    last_action = str(state_entry.get("last_action", "HOLD")).upper()
    metrics = {
        "last_action": last_action,
        "age_hours": quantize_string(age_hours, places="0.01"),
        "minimum_hold_hours": str(strategy.minimum_hold_hours),
        "add_cooldown_hours": str(strategy.add_cooldown_hours),
        "reentry_cooldown_hours": str(strategy.reentry_cooldown_hours),
    }

    if candidate_action == "BUY":
        if last_action == "BUY" and age_hours < Decimal(str(strategy.add_cooldown_hours)):
            return AgentAssessment(
                agent="state",
                stance="BLOCK",
                score=Decimal("-1"),
                reason="Last buy is still inside the add cooldown window.",
                metrics=metrics,
            )
        if last_action == "SELL" and age_hours < Decimal(str(strategy.reentry_cooldown_hours)):
            return AgentAssessment(
                agent="state",
                stance="BLOCK",
                score=Decimal("-1"),
                reason="Last sell is still inside the re-entry cooldown window.",
                metrics=metrics,
            )
        return AgentAssessment(
            agent="state",
            stance="HOLD",
            score=Decimal("0"),
            reason="No timing constraint blocks a buy.",
            metrics=metrics,
        )

    if last_action == "SELL" and age_hours < Decimal(str(strategy.add_cooldown_hours)):
        return AgentAssessment(
            agent="state",
            stance="BLOCK",
            score=Decimal("-1"),
            reason="Last sell is still inside the trim cooldown window.",
            metrics=metrics,
        )

    emergency_exit = research_agent.stance == "SELL" and market_agent.stance == "SELL"
    if last_action == "BUY" and age_hours < Decimal(str(strategy.minimum_hold_hours)) and not emergency_exit:
        return AgentAssessment(
            agent="state",
            stance="BLOCK",
            score=Decimal("-1"),
            reason="Minimum hold window is not complete and this is not an emergency exit.",
            metrics=metrics,
        )

    return AgentAssessment(
        agent="state",
        stance="HOLD",
        score=Decimal("0"),
        reason="No timing constraint blocks a sell.",
        metrics=metrics,
    )


def evaluate_risk_agent(
    strategy: AgentStrategy,
    accounts: Mapping[str, Any],
    mid_price: Decimal,
    total_score: Decimal,
    candidate_action: str,
    max_score: Decimal,
) -> tuple[AgentAssessment, str | None, str | None]:
    balances = balances_by_currency(accounts)
    quote_available = balances.get(strategy.trade.quote_currency, Decimal("0"))
    base_available = balances.get(strategy.trade.base_currency, Decimal("0"))
    base_value = base_available * mid_price
    total_value = quote_available + base_value
    allocation = (base_value / total_value) if total_value > 0 else Decimal("0")

    metrics = {
        "quote_available": quantize_string(quote_available),
        "base_available": quantize_string(base_available, places="0.00000001"),
        "base_allocation": quantize_string(allocation * Decimal("100"), places="0.01"),
        "sizing_aggression": quantize_string(strategy.sizing_aggression, places="0.01"),
    }

    if candidate_action == "HOLD":
        return (
            AgentAssessment(
                agent="risk",
                stance="HOLD",
                score=Decimal("0"),
                reason="Committee vote did not justify a trade.",
                metrics=metrics,
            ),
            None,
            None,
        )

    denominator = max(max_score, Decimal("1"))
    intensity = min(abs(total_score) / denominator, Decimal("1"))
    trade_cap_multiplier = max(strategy.sizing_aggression, Decimal("0.25"))

    if candidate_action == "BUY":
        if allocation >= strategy.max_base_allocation:
            return (
                AgentAssessment(
                    agent="risk",
                    stance="BLOCK",
                    score=Decimal("-1"),
                    reason="Base allocation is already at or above the max cap.",
                    metrics=metrics,
                ),
                None,
                None,
            )

        deployable_quote = max(quote_available - strategy.trade.min_quote_buffer, Decimal("0"))
        desired_base_value = max((strategy.target_base_allocation * total_value) - base_value, Decimal("0"))
        quote_cap = strategy.trade.max_quote_trade * intensity * trade_cap_multiplier
        quote_size = min(deployable_quote, desired_base_value, quote_cap)
        if quote_size <= 0:
            return (
                AgentAssessment(
                    agent="risk",
                    stance="BLOCK",
                    score=Decimal("-1"),
                    reason="No safe quote inventory is available after buffer and allocation checks.",
                    metrics=metrics,
                ),
                None,
                None,
            )

        return (
            AgentAssessment(
                agent="risk",
                stance="BUY",
                score=Decimal("0"),
                reason="Risk limits permit a buy sized to conviction, caps, and allocation gap.",
                metrics=metrics,
            ),
            quantize_string(quote_size),
            None,
        )

    if allocation <= strategy.min_base_allocation:
        return (
            AgentAssessment(
                agent="risk",
                stance="BLOCK",
                score=Decimal("-1"),
                reason="Base allocation is already at or below the minimum floor.",
                metrics=metrics,
            ),
            None,
            None,
        )

    desired_base_size = (
        max(base_value - (strategy.target_base_allocation * total_value), Decimal("0")) / mid_price
        if mid_price > 0
        else Decimal("0")
    )
    base_cap = strategy.trade.max_base_trade * intensity * trade_cap_multiplier
    base_size = min(base_available, desired_base_size, base_cap)
    if base_size < strategy.trade.min_base_trade:
        return (
            AgentAssessment(
                agent="risk",
                stance="BLOCK",
                score=Decimal("-1"),
                reason="Sell size falls below the configured minimum trade size.",
                metrics=metrics,
            ),
            None,
            None,
        )

    return (
        AgentAssessment(
            agent="risk",
            stance="SELL",
            score=Decimal("0"),
            reason="Risk limits permit a sell sized to conviction, caps, and allocation gap.",
            metrics=metrics,
        ),
        None,
        quantize_string(base_size, places="0.00000001"),
    )


def build_market_snapshot(ticker: Mapping[str, Any], trade: StrategyConfig) -> dict[str, Decimal]:
    trades = ticker.get("trades", [])
    if len(trades) < trade.long_window:
        raise ValueError(f"Need at least {trade.long_window} trades for {trade.product_id}, received {len(trades)}.")

    prices = [Decimal(str(trade_item["price"])) for trade_item in trades]
    short_avg = _mean(prices[: trade.short_window])
    long_avg = _mean(prices[: trade.long_window])
    last_price = prices[0]
    best_bid = Decimal(str(ticker["best_bid"]))
    best_ask = Decimal(str(ticker["best_ask"]))
    mid_price = (best_bid + best_ask) / Decimal("2")
    momentum_bps = ((short_avg - long_avg) / long_avg) * Decimal("10000") if long_avg else Decimal("0")
    deviation_bps = ((last_price - long_avg) / long_avg) * Decimal("10000") if long_avg else Decimal("0")
    spread_bps = ((best_ask - best_bid) / mid_price) * Decimal("10000") if mid_price else Decimal("0")

    return {
        "last_price": last_price,
        "best_bid": best_bid,
        "best_ask": best_ask,
        "mid_price": mid_price,
        "short_avg": short_avg,
        "long_avg": long_avg,
        "momentum_bps": momentum_bps,
        "deviation_bps": deviation_bps,
        "spread_bps": spread_bps,
    }


def build_sentiment_snapshot(strategy: AgentStrategy, sentiment_feed: Mapping[str, Any]) -> dict[str, Any]:
    root_updated = sentiment_feed.get("updated_at_utc")
    market_entry = _market_sentiment_entry(sentiment_feed)
    product_entry = dict(sentiment_feed.get("products", {}).get(strategy.product_id, {}))
    thesis_entry = {}
    if strategy.research_slug:
        thesis_entry = dict(sentiment_feed.get("research_slugs", {}).get(strategy.research_slug, {}))

    product_score, product_confidence, product_updated = _entry_score(product_entry, root_updated)
    market_score, market_confidence, market_updated = _entry_score(market_entry, root_updated)
    thesis_score, thesis_confidence, thesis_updated = _entry_score(thesis_entry, root_updated)

    usable_components = []
    stale_components = 0
    available_components = 0
    freshness_candidates = []
    for score, confidence, updated in (
        (product_score, product_confidence, product_updated),
        (market_score, market_confidence, market_updated),
        (thesis_score, thesis_confidence, thesis_updated),
    ):
        if confidence <= 0:
            continue

        available_components += 1
        age_hours = _age_hours(updated) if updated else Decimal("9999")
        if age_hours > Decimal(str(strategy.max_sentiment_age_hours)):
            stale_components += 1
            continue

        usable_components.append((score, confidence))
        freshness_candidates.append(age_hours)

    if usable_components:
        weighted_numerator = sum((score * confidence for score, confidence in usable_components), Decimal("0"))
        weighted_denominator = sum((confidence for _, confidence in usable_components), Decimal("0"))
        total_score = weighted_numerator / weighted_denominator if weighted_denominator > 0 else Decimal("0")
        confidence = weighted_denominator / Decimal(str(len(usable_components)))
    else:
        total_score = Decimal("0")
        confidence = Decimal("0")

    freshness_hours = max(freshness_candidates) if freshness_candidates else Decimal("9999")
    regime = infer_regime(total_score)

    return {
        "style": strategy.style,
        "regime": regime,
        "product_score_decimal": product_score,
        "market_score_decimal": market_score,
        "thesis_score_decimal": thesis_score,
        "total_score_decimal": total_score,
        "confidence_decimal": confidence,
        "coverage_decimal": Decimal(str(len(usable_components))) / Decimal("3"),
        "available_components": available_components,
        "stale_components": stale_components,
        "freshness_hours_decimal": freshness_hours,
        "product_updated_at": product_updated or root_updated or "",
        "market_updated_at": market_updated or root_updated or "",
        "thesis_updated_at": thesis_updated or root_updated or "",
        "summary": product_entry.get("summary")
        or thesis_entry.get("summary")
        or market_entry.get("summary")
        or "",
    }


def infer_regime(sentiment_score: Decimal) -> str:
    if sentiment_score >= Decimal("1.5"):
        return "risk_on"
    if sentiment_score <= Decimal("-1.5"):
        return "risk_off"
    return "neutral"


def weighted_agent_score(score: Decimal, weight: Decimal) -> Decimal:
    return score * weight


def committee_max_score(strategy: AgentStrategy) -> Decimal:
    return strategy.research_weight + strategy.sentiment_weight + strategy.market_weight + strategy.allocator_weight


def candidate_action_from_score(total_score: Decimal, strategy: AgentStrategy) -> str:
    if total_score >= strategy.buy_vote_threshold:
        return "BUY"
    if total_score <= strategy.sell_vote_threshold:
        return "SELL"
    return "HOLD"


def confidence_label(total_score: Decimal, max_score: Decimal) -> str:
    denominator = max(max_score, Decimal("1"))
    ratio = abs(total_score) / denominator
    if ratio >= Decimal("0.75"):
        return "High"
    if ratio >= Decimal("0.45"):
        return "Medium"
    return "Low"


def opportunity_score(
    action: str,
    total_score: Decimal,
    max_score: Decimal,
    sentiment_snapshot: Mapping[str, str],
) -> Decimal:
    denominator = max(max_score, Decimal("1"))
    base = (abs(total_score) / denominator) * Decimal("100")
    sentiment_bonus = abs(Decimal(str(sentiment_snapshot.get("total_score", "0")))) * Decimal("5")
    if action == "HOLD":
        return base / Decimal("2")
    return base + sentiment_bonus


def agent_to_dict(agent: AgentAssessment) -> dict[str, Any]:
    return {
        "agent": agent.agent,
        "stance": agent.stance,
        "score": quantize_string(agent.score, places="0.01"),
        "reason": agent.reason,
        "metrics": agent.metrics,
    }


def strategy_to_dict(strategy: AgentStrategy) -> dict[str, Any]:
    return {
        "name": strategy.name,
        "style": strategy.style,
        "strategy_key": strategy_key(strategy),
        "position_key": position_key(strategy),
        "exchange": strategy.trade.exchange,
        "product_id": strategy.product_id,
        "research_slug": strategy.research_slug,
        "research_buy_floor": quantize_string(strategy.research_buy_floor, places="0.1"),
        "research_sell_ceiling": quantize_string(strategy.research_sell_ceiling, places="0.1"),
        "min_research_coverage": quantize_string(strategy.min_research_coverage * Decimal("100"), places="0.01"),
        "founder_resilience_floor": quantize_string(strategy.founder_resilience_floor, places="0.1"),
        "mission_clarity_floor": quantize_string(strategy.mission_clarity_floor, places="0.1"),
        "moat_floor": quantize_string(strategy.moat_floor, places="0.1"),
        "distribution_floor": quantize_string(strategy.distribution_floor, places="0.1"),
        "target_base_allocation": quantize_string(strategy.target_base_allocation * Decimal("100"), places="0.01"),
        "max_base_allocation": quantize_string(strategy.max_base_allocation * Decimal("100"), places="0.01"),
        "min_base_allocation": quantize_string(strategy.min_base_allocation * Decimal("100"), places="0.01"),
        "buy_vote_threshold": quantize_string(strategy.buy_vote_threshold, places="0.01"),
        "sell_vote_threshold": quantize_string(strategy.sell_vote_threshold, places="0.01"),
        "minimum_hold_hours": strategy.minimum_hold_hours,
        "add_cooldown_hours": strategy.add_cooldown_hours,
        "reentry_cooldown_hours": strategy.reentry_cooldown_hours,
        "research_weight": quantize_string(strategy.research_weight, places="0.01"),
        "sentiment_weight": quantize_string(strategy.sentiment_weight, places="0.01"),
        "market_weight": quantize_string(strategy.market_weight, places="0.01"),
        "allocator_weight": quantize_string(strategy.allocator_weight, places="0.01"),
        "buy_requires_research_confirmation": strategy.buy_requires_research_confirmation,
        "buy_requires_sentiment_confirmation": strategy.buy_requires_sentiment_confirmation,
        "sentiment_buy_floor": quantize_string(strategy.sentiment_buy_floor, places="0.01"),
        "sentiment_sell_ceiling": quantize_string(strategy.sentiment_sell_ceiling, places="0.01"),
        "max_sentiment_age_hours": strategy.max_sentiment_age_hours,
        "breakout_confirmation_bps": quantize_string(strategy.breakout_confirmation_bps, places="0.01"),
        "mean_reversion_entry_bps": quantize_string(strategy.mean_reversion_entry_bps, places="0.01"),
        "mean_reversion_exit_bps": quantize_string(strategy.mean_reversion_exit_bps, places="0.01"),
        "sizing_aggression": quantize_string(strategy.sizing_aggression, places="0.01"),
        "trade": {
            "exchange": strategy.trade.exchange,
            "max_quote_trade": quantize_string(strategy.trade.max_quote_trade),
            "max_base_trade": quantize_string(strategy.trade.max_base_trade, places="0.00000001"),
            "min_quote_buffer": quantize_string(strategy.trade.min_quote_buffer),
            "min_base_trade": quantize_string(strategy.trade.min_base_trade, places="0.00000001"),
            "buy_signal_bps": quantize_string(strategy.trade.buy_signal_bps, places="0.01"),
            "sell_signal_bps": quantize_string(strategy.trade.sell_signal_bps, places="0.01"),
            "max_spread_bps": quantize_string(strategy.trade.max_spread_bps, places="0.01"),
            "short_window": strategy.trade.short_window,
            "long_window": strategy.trade.long_window,
        },
    }


def select_strategy(strategies: list[AgentStrategy], selector: str | None) -> AgentStrategy:
    if selector is None:
        if len(strategies) == 1:
            return strategies[0]
        raise KeyError("Multiple agent strategies found. Use --strategy to pick one.")

    normalized = selector.lower()
    for strategy in strategies:
        if (
            strategy.name.lower() == normalized
            or strategy_key(strategy).lower() == normalized
            or f"{strategy.trade.exchange}:{strategy.product_id}:{strategy.style}".lower() == normalized
        ):
            return strategy

    product_matches = [strategy for strategy in strategies if strategy.product_id.lower() == normalized]
    if len(product_matches) == 1:
        return product_matches[0]
    if len(product_matches) > 1:
        raise KeyError(f"Multiple agent strategies found for product {selector}. Use the strategy name or strategy key.")
    raise KeyError(f"No agent strategy found for: {selector}")


def best_actionable_strategy(reports: list[dict[str, Any]], strategies: list[AgentStrategy]) -> AgentStrategy:
    lookup = {strategy_key(strategy): strategy for strategy in strategies}
    for report in reports:
        if report["decision"]["action"] != "HOLD":
            return lookup[report["strategy_key"]]
    return lookup[reports[0]["strategy_key"]]


def write_json_report(path: str | Path, payload: Any) -> Path:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return output_path


def _client_for_exchange(cache: dict[str, TradingClient], exchange: str) -> TradingClient:
    client = cache.get(exchange)
    if client is None:
        client = create_exchange_client(exchange)
        cache[exchange] = client
    return client


def _criteria_lookup(scored_company: Mapping[str, Any]) -> dict[str, Decimal]:
    criteria = {}
    for entry in scored_company.get("breakdown", []):
        criteria[entry["criterion"]] = Decimal(str(entry["score"]))
    return criteria


def _company_rank(slug: str, companies: list[Mapping[str, Any]], weights: Mapping[str, float]) -> int:
    ranked = rank_companies(companies, weights)
    for company in ranked:
        if company["slug"] == slug:
            return int(company["rank"])
    return 0


def _committee_reason(
    committee: list[AgentAssessment],
    state_agent: AgentAssessment,
    risk_agent: AgentAssessment,
) -> str:
    reasons = [f"{agent.agent}: {agent.stance.lower()}" for agent in committee if agent.stance != "HOLD"]
    if state_agent.stance == "BLOCK":
        reasons.append("state: block")
    if risk_agent.stance not in {"HOLD", "BLOCK"}:
        reasons.append(f"risk: {risk_agent.stance.lower()}")
    return "; ".join(reasons) if reasons else "No agents produced a directional vote."


def _snapshot_to_strings(snapshot: Mapping[str, Decimal]) -> dict[str, str]:
    return {
        "last_price": quantize_string(snapshot["last_price"]),
        "best_bid": quantize_string(snapshot["best_bid"]),
        "best_ask": quantize_string(snapshot["best_ask"]),
        "mid_price": quantize_string(snapshot["mid_price"]),
        "short_avg": quantize_string(snapshot["short_avg"]),
        "long_avg": quantize_string(snapshot["long_avg"]),
        "momentum_bps": quantize_string(snapshot["momentum_bps"], places="0.01"),
        "deviation_bps": quantize_string(snapshot["deviation_bps"], places="0.01"),
        "spread_bps": quantize_string(snapshot["spread_bps"], places="0.01"),
    }


def _sentiment_snapshot_to_strings(snapshot: Mapping[str, Any]) -> dict[str, str]:
    return {
        "style": str(snapshot["style"]),
        "regime": str(snapshot["regime"]),
        "product_score": quantize_string(snapshot["product_score_decimal"], places="0.01"),
        "market_score": quantize_string(snapshot["market_score_decimal"], places="0.01"),
        "thesis_score": quantize_string(snapshot["thesis_score_decimal"], places="0.01"),
        "total_score": quantize_string(snapshot["total_score_decimal"], places="0.01"),
        "confidence": quantize_string(snapshot["confidence_decimal"] * Decimal("100"), places="0.01"),
        "coverage": quantize_string(snapshot["coverage_decimal"] * Decimal("100"), places="0.01"),
        "available_components": str(snapshot["available_components"]),
        "stale_components": str(snapshot["stale_components"]),
        "freshness_hours": quantize_string(snapshot["freshness_hours_decimal"], places="0.01"),
        "summary": str(snapshot["summary"]),
    }


def _sentiment_metrics(snapshot: Mapping[str, Any]) -> dict[str, str]:
    return {
        "regime": str(snapshot["regime"]),
        "product_score": quantize_string(snapshot["product_score_decimal"], places="0.01"),
        "market_score": quantize_string(snapshot["market_score_decimal"], places="0.01"),
        "thesis_score": quantize_string(snapshot["thesis_score_decimal"], places="0.01"),
        "total_score": quantize_string(snapshot["total_score_decimal"], places="0.01"),
        "confidence": quantize_string(snapshot["confidence_decimal"] * Decimal("100"), places="0.01"),
        "available_components": str(snapshot["available_components"]),
        "stale_components": str(snapshot["stale_components"]),
        "freshness_hours": quantize_string(snapshot["freshness_hours_decimal"], places="0.01"),
    }


def _write_agent_report(
    output_dir: str | Path,
    strategy: AgentStrategy,
    mode: str,
    report: dict[str, Any],
) -> tuple[dict[str, Any], Path]:
    report_dir = Path(output_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    filename = (
        f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}_"
        f"{strategy.trade.exchange}_{strategy.product_id}_{strategy.style}_{_slugify(strategy.name)}_agents_{mode}.json"
    )
    path = report_dir / filename
    path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    return report, path


def _report_sort_key(report: Mapping[str, Any]) -> tuple[bool, Decimal, Decimal, Decimal, Decimal]:
    return (
        report["decision"]["action"] != "HOLD",
        Decimal(str(report["decision"].get("edge_score", "0"))),
        abs(Decimal(str(report["decision"].get("total_score", "0")))),
        abs(Decimal(str(report.get("sentiment_snapshot", {}).get("total_score", "0")))),
        Decimal(str(report.get("research_snapshot", {}).get("weighted_score", "0"))),
    )


def _entry_score(entry: Mapping[str, Any], root_updated: str | None) -> tuple[Decimal, Decimal, str | None]:
    if not entry:
        return Decimal("0"), Decimal("0"), root_updated

    confidence = Decimal(str(entry.get("confidence", "0.5")))
    if "sentiment_score" in entry:
        score = Decimal(str(entry["sentiment_score"]))
    else:
        signals = entry.get("signals", {})
        values = [Decimal(str(value)) for value in signals.values()]
        score = _mean(values) if values else Decimal("0")
    updated = entry.get("updated_at_utc") or root_updated
    return score, confidence, updated


def _market_sentiment_entry(sentiment_feed: Mapping[str, Any]) -> Mapping[str, Any]:
    market = sentiment_feed.get("market", {})
    if "crypto" in market:
        return market["crypto"]
    return market


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "strategy"


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _age_hours(timestamp: str) -> Decimal:
    last_time = datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - last_time
    seconds = Decimal(str(delta.total_seconds()))
    return seconds / Decimal("3600")


def _mean(values: list[Decimal]) -> Decimal:
    return sum(values, Decimal("0")) / Decimal(len(values))


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off"}:
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    raise ValueError(f"Unable to parse boolean value: {value!r}")
