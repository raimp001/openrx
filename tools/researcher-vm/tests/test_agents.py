import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, Union

from researcher.agents import AgentStrategy, candidate_action_from_score, evaluate_agent_strategy, strategy_from_mapping
from researcher.trading import StrategyConfig


def _full_scorecard(score: int) -> Dict[str, Dict[str, Union[str, int]]]:
    return {
        "leadership_resilience": {"score": score, "evidence": "ok"},
        "mission_clarity": {"score": score, "evidence": "ok"},
        "moat": {"score": score, "evidence": "ok"},
        "distribution": {"score": score, "evidence": "ok"},
        "market_tailwind": {"score": score, "evidence": "ok"},
        "financial_strength": {"score": score, "evidence": "ok"},
        "regulatory_resilience": {"score": score, "evidence": "ok"},
        "strategic_optionality": {"score": score, "evidence": "ok"},
        "timing": {"score": score, "evidence": "ok"},
    }


class AgentCommitteeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.strategy = AgentStrategy(
            name="BTC",
            trade=StrategyConfig(
                product_id="BTC-USD",
                quote_currency="USD",
                base_currency="BTC",
                max_quote_trade=Decimal("100"),
                max_base_trade=Decimal("0.001"),
                min_quote_buffer=Decimal("250"),
                min_base_trade=Decimal("0.0001"),
                buy_signal_bps=Decimal("20"),
                sell_signal_bps=Decimal("-20"),
                max_spread_bps=Decimal("20"),
                short_window=3,
                long_window=5,
            ),
            research_slug="bitcoin",
            research_buy_floor=Decimal("80"),
            research_sell_ceiling=Decimal("60"),
            target_base_allocation=Decimal("0.35"),
            max_base_allocation=Decimal("0.60"),
            min_base_allocation=Decimal("0.05"),
            buy_vote_threshold=Decimal("2"),
            sell_vote_threshold=Decimal("-2"),
        )
        self.strong_company = [
            {
                "slug": "bitcoin",
                "name": "Bitcoin",
                "scorecard": _full_scorecard(9),
            }
        ]
        self.weak_company = [
            {
                "slug": "bitcoin",
                "name": "Bitcoin",
                "scorecard": _full_scorecard(4),
            }
        ]
        self.buy_ticker = {
            "best_bid": "100.00",
            "best_ask": "100.10",
            "trades": [
                {"price": "105"},
                {"price": "104"},
                {"price": "103"},
                {"price": "100"},
                {"price": "99"},
            ],
        }
        self.sentiment_feed = {
            "updated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "market": {
                "crypto": {
                    "sentiment_score": "2.0",
                    "confidence": "0.8",
                }
            },
            "products": {
                "BTC-USD": {
                    "sentiment_score": "2.5",
                    "confidence": "0.8",
                }
            },
            "research_slugs": {
                "bitcoin": {
                    "sentiment_score": "2.0",
                    "confidence": "0.8",
                }
            },
        }

    def test_candidate_action_thresholds(self) -> None:
        self.assertEqual(candidate_action_from_score(Decimal("2"), self.strategy), "BUY")
        self.assertEqual(candidate_action_from_score(Decimal("-2"), self.strategy), "SELL")
        self.assertEqual(candidate_action_from_score(Decimal("1"), self.strategy), "HOLD")

    def test_committee_generates_buy(self) -> None:
        accounts = {"accounts": [{"currency": "USD", "available_balance": {"value": "1000"}}]}
        report = evaluate_agent_strategy(self.strategy, accounts, self.buy_ticker, self.strong_company, {})

        self.assertEqual(report["decision"]["action"], "BUY")
        self.assertEqual(report["decision"]["candidate_action"], "BUY")
        self.assertTrue(Decimal(report["decision"]["quote_size"]) > 0)

    def test_risk_blocks_buy_when_quote_buffer_is_too_small(self) -> None:
        accounts = {
            "accounts": [
                {"currency": "USD", "available_balance": {"value": "200"}},
                {"currency": "BTC", "available_balance": {"value": "0.5"}},
            ]
        }
        report = evaluate_agent_strategy(self.strategy, accounts, self.buy_ticker, self.strong_company, {})

        self.assertEqual(report["decision"]["candidate_action"], "BUY")
        self.assertEqual(report["decision"]["action"], "HOLD")

    def test_weak_research_keeps_committee_on_hold(self) -> None:
        accounts = {"accounts": [{"currency": "USD", "available_balance": {"value": "1000"}}]}
        report = evaluate_agent_strategy(self.strategy, accounts, self.buy_ticker, self.weak_company, {})

        self.assertEqual(report["decision"]["action"], "HOLD")

    def test_founder_gate_blocks_otherwise_strong_buy(self) -> None:
        companies = [
            {
                "slug": "bitcoin",
                "name": "Bitcoin",
                "scorecard": {
                    **_full_scorecard(9),
                    "leadership_resilience": {"score": 6, "evidence": "weak founder"},
                },
            }
        ]
        accounts = {"accounts": [{"currency": "USD", "available_balance": {"value": "1000"}}]}
        report = evaluate_agent_strategy(self.strategy, accounts, self.buy_ticker, companies, {})

        self.assertEqual(report["decision"]["action"], "HOLD")
        research_agent = next(agent for agent in report["agents"] if agent["agent"] == "research")
        self.assertEqual(research_agent["stance"], "HOLD")

    def test_state_agent_blocks_fast_reentry(self) -> None:
        accounts = {"accounts": [{"currency": "USD", "available_balance": {"value": "1000"}}]}
        recent_sell = (datetime.now(timezone.utc) - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
        report = evaluate_agent_strategy(
            self.strategy,
            accounts,
            self.buy_ticker,
            self.strong_company,
            {},
            state_entry={
                "last_action": "SELL",
                "last_trade_at": recent_sell,
            },
        )

        self.assertEqual(report["decision"]["candidate_action"], "BUY")
        self.assertEqual(report["decision"]["action"], "HOLD")
        state_agent = next(agent for agent in report["agents"] if agent["agent"] == "state")
        self.assertEqual(state_agent["stance"], "BLOCK")

    def test_sentiment_confirmation_can_block_buy(self) -> None:
        strategy = AgentStrategy(
            **{
                **self.strategy.__dict__,
                "buy_requires_sentiment_confirmation": True,
            }
        )
        bearish_feed = {
            "updated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "market": {"crypto": {"sentiment_score": "-2.0", "confidence": "0.9"}},
            "products": {"BTC-USD": {"sentiment_score": "-2.5", "confidence": "0.9"}},
            "research_slugs": {"bitcoin": {"sentiment_score": "-2.0", "confidence": "0.8"}},
        }
        accounts = {"accounts": [{"currency": "USD", "available_balance": {"value": "1000"}}]}

        report = evaluate_agent_strategy(
            strategy,
            accounts,
            self.buy_ticker,
            self.strong_company,
            {},
            sentiment_feed=bearish_feed,
        )

        self.assertEqual(report["decision"]["candidate_action"], "HOLD")
        sentiment_agent = next(agent for agent in report["agents"] if agent["agent"] == "sentiment")
        self.assertEqual(sentiment_agent["stance"], "SELL")

    def test_mean_reversion_style_buys_deep_dip(self) -> None:
        strategy = AgentStrategy(
            name="BTC Mean Reversion",
            trade=StrategyConfig(
                product_id="BTC-USD",
                quote_currency="USD",
                base_currency="BTC",
                max_quote_trade=Decimal("100"),
                max_base_trade=Decimal("0.001"),
                min_quote_buffer=Decimal("250"),
                min_base_trade=Decimal("0.0001"),
                buy_signal_bps=Decimal("10"),
                sell_signal_bps=Decimal("-30"),
                max_spread_bps=Decimal("20"),
                short_window=3,
                long_window=5,
            ),
            style="mean_reversion",
            research_slug="bitcoin",
            mean_reversion_entry_bps=Decimal("120"),
            mean_reversion_exit_bps=Decimal("30"),
            research_buy_floor=Decimal("80"),
            research_sell_ceiling=Decimal("60"),
            target_base_allocation=Decimal("0.35"),
            max_base_allocation=Decimal("0.60"),
            min_base_allocation=Decimal("0.05"),
            buy_vote_threshold=Decimal("1.7"),
            sell_vote_threshold=Decimal("-1.8"),
            sentiment_buy_floor=Decimal("-0.5"),
        )
        dip_ticker = {
            "best_bid": "89.95",
            "best_ask": "90.05",
            "trades": [
                {"price": "90"},
                {"price": "91"},
                {"price": "92"},
                {"price": "100"},
                {"price": "102"},
            ],
        }
        accounts = {"accounts": [{"currency": "USD", "available_balance": {"value": "1000"}}]}

        report = evaluate_agent_strategy(
            strategy,
            accounts,
            dip_ticker,
            self.strong_company,
            {},
            sentiment_feed=self.sentiment_feed,
        )

        self.assertEqual(report["decision"]["action"], "BUY")
        self.assertEqual(report["strategy"]["style"], "mean_reversion")
        market_agent = next(agent for agent in report["agents"] if agent["agent"] == "market")
        self.assertEqual(market_agent["stance"], "BUY")

    def test_stale_sentiment_is_ignored(self) -> None:
        stale_feed = {
            "updated_at_utc": "2026-01-01T00:00:00Z",
            "market": {"crypto": {"sentiment_score": "2.0", "confidence": "0.9", "updated_at_utc": "2026-01-01T00:00:00Z"}},
            "products": {"BTC-USD": {"sentiment_score": "2.5", "confidence": "0.9", "updated_at_utc": "2026-01-01T00:00:00Z"}},
            "research_slugs": {"bitcoin": {"sentiment_score": "2.0", "confidence": "0.9", "updated_at_utc": "2026-01-01T00:00:00Z"}},
        }
        accounts = {"accounts": [{"currency": "USD", "available_balance": {"value": "1000"}}]}

        report = evaluate_agent_strategy(
            self.strategy,
            accounts,
            self.buy_ticker,
            self.strong_company,
            {},
            sentiment_feed=stale_feed,
        )

        sentiment_agent = next(agent for agent in report["agents"] if agent["agent"] == "sentiment")
        self.assertEqual(sentiment_agent["stance"], "HOLD")
        self.assertIn("stale", sentiment_agent["reason"].lower())

    def test_strategy_from_mapping_parses_string_booleans(self) -> None:
        strategy = strategy_from_mapping(
            {
                "name": "Test",
                "product_id": "BTC-USD",
                "max_quote_trade": "100",
                "max_base_trade": "0.001",
                "min_quote_buffer": "100",
                "min_base_trade": "0.0001",
                "buy_signal_bps": "10",
                "sell_signal_bps": "-10",
                "max_spread_bps": "20",
                "short_window": 3,
                "long_window": 5,
                "buy_requires_research_confirmation": "false",
                "buy_requires_sentiment_confirmation": "true",
            }
        )

        self.assertFalse(strategy.buy_requires_research_confirmation)
        self.assertTrue(strategy.buy_requires_sentiment_confirmation)


if __name__ == "__main__":
    unittest.main()
