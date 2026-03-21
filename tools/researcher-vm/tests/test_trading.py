import base64
import json
import os
import unittest
from decimal import Decimal

from researcher.coinbase import (
    CoinbaseCredentials,
    CoinbaseJWTSigner,
    build_limit_order_payload,
    build_market_order_payload,
    coinbase_granularity,
    format_rest_uri,
)
from researcher.trading import LIVE_TRADING_ACK, StrategyConfig, balances_by_currency, evaluate_signal


class CoinbaseHelpersTests(unittest.TestCase):
    def test_build_market_order_payload_for_buy(self) -> None:
        payload = build_market_order_payload(
            product_id="BTC-USD",
            side="BUY",
            quote_size="50.00",
        )

        self.assertEqual(payload["side"], "BUY")
        self.assertEqual(payload["order_configuration"]["market_market_ioc"]["quote_size"], "50.00")
        self.assertIn("client_order_id", payload)

    def test_format_rest_uri(self) -> None:
        self.assertEqual(
            format_rest_uri("get", "/api/v3/brokerage/accounts", "api.coinbase.com"),
            "GET api.coinbase.com/api/v3/brokerage/accounts",
        )

    def test_build_limit_order_payload_for_buy(self) -> None:
        payload = build_limit_order_payload(
            product_id="TAO-USD",
            side="BUY",
            base_size="0.25",
            limit_price="123.45",
            post_only=True,
        )

        self.assertEqual(payload["side"], "BUY")
        self.assertEqual(payload["order_configuration"]["limit_limit_gtc"]["base_size"], "0.25")
        self.assertEqual(payload["order_configuration"]["limit_limit_gtc"]["limit_price"], "123.45")
        self.assertTrue(payload["order_configuration"]["limit_limit_gtc"]["post_only"])

    def test_coinbase_granularity_helper(self) -> None:
        self.assertEqual(coinbase_granularity("15m"), "FIFTEEN_MINUTE")
        self.assertEqual(coinbase_granularity("1h"), "ONE_HOUR")

    def test_jwt_builder_embeds_expected_claims(self) -> None:
        signer = CoinbaseJWTSigner(
            CoinbaseCredentials(api_key_name="organizations/test/apiKeys/test", private_key_pem="unused"),
            sign_callback=lambda _: b"test-signature",
        )

        token = signer.build_rest_jwt("GET", "/api/v3/brokerage/accounts", "api.coinbase.com")
        header_b64, payload_b64, _ = token.split(".")
        header = json.loads(_decode_b64url(header_b64))
        payload = json.loads(_decode_b64url(payload_b64))

        self.assertEqual(header["alg"], "ES256")
        self.assertEqual(payload["iss"], "cdp")
        self.assertEqual(payload["uri"], "GET api.coinbase.com/api/v3/brokerage/accounts")


class TradingLogicTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = StrategyConfig(
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
        )

    def test_balances_by_currency(self) -> None:
        accounts = {
            "accounts": [
                {"currency": "USD", "available_balance": {"value": "400"}},
                {"currency": "BTC", "available_balance": {"value": "0.002"}},
            ]
        }
        balances = balances_by_currency(accounts)
        self.assertEqual(balances["USD"], Decimal("400"))
        self.assertEqual(balances["BTC"], Decimal("0.002"))

    def test_evaluate_signal_buy(self) -> None:
        ticker = {
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
        accounts = {"accounts": [{"currency": "USD", "available_balance": {"value": "1000"}}]}

        decision = evaluate_signal(ticker, accounts, self.config)

        self.assertEqual(decision.action, "BUY")
        self.assertEqual(decision.quote_size, "100")

    def test_evaluate_signal_sell(self) -> None:
        ticker = {
            "best_bid": "100.00",
            "best_ask": "100.10",
            "trades": [
                {"price": "95"},
                {"price": "96"},
                {"price": "97"},
                {"price": "100"},
                {"price": "101"},
            ],
        }
        accounts = {"accounts": [{"currency": "BTC", "available_balance": {"value": "0.005"}}]}

        decision = evaluate_signal(ticker, accounts, self.config)

        self.assertEqual(decision.action, "SELL")
        self.assertEqual(decision.base_size, "0.001")

    def test_evaluate_signal_holds_on_wide_spread(self) -> None:
        ticker = {
            "best_bid": "100.00",
            "best_ask": "101.00",
            "trades": [
                {"price": "105"},
                {"price": "104"},
                {"price": "103"},
                {"price": "100"},
                {"price": "99"},
            ],
        }
        accounts = {"accounts": [{"currency": "USD", "available_balance": {"value": "1000"}}]}

        decision = evaluate_signal(ticker, accounts, self.config)

        self.assertEqual(decision.action, "HOLD")

    def test_live_ack_value_constant(self) -> None:
        self.assertEqual(LIVE_TRADING_ACK, "I_ACCEPT_REAL_TRADES")


def _decode_b64url(value: str) -> str:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding).decode("utf-8")
