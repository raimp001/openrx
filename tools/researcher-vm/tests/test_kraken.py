import base64
import hashlib
import hmac
import json
import unittest

from researcher.kraken import (
    KrakenCredentials,
    KrakenRESTClient,
    build_add_order_payload,
    build_limit_add_order_payload,
    build_api_sign,
    kraken_interval,
    kraken_pair_from_product,
    normalize_asset_code,
    quote_to_base_size,
)


class KrakenHelpersTests(unittest.TestCase):
    def test_build_api_sign_matches_manual_hmac_calculation(self) -> None:
        secret = "kQH5HW/8lniLvQeX15ZVbQ2tQ2ats4mOsZ7h6d6KJftVQ3x6aYbL6B9VoYtt9A7/3eKZ5jS4zZC4gGvE0wUP7w=="
        encoded_payload = "nonce=1616492376594&ordertype=limit&pair=XBTUSD&price=37500&type=buy&volume=1.25"
        signature = build_api_sign("/0/private/AddOrder", "1616492376594", encoded_payload, secret)
        sha256_digest = hashlib.sha256(("1616492376594" + encoded_payload).encode("utf-8")).digest()
        message = b"/0/private/AddOrder" + sha256_digest
        expected = base64.b64encode(
            hmac.new(base64.b64decode(secret), message, hashlib.sha512).digest()
        ).decode("ascii")
        self.assertEqual(signature, expected)

    def test_build_add_order_payload_uses_viqc_for_buy_quote_size(self) -> None:
        payload = build_add_order_payload(
            product_id="BTC-USD",
            side="BUY",
            quote_size="25",
            validate=True,
        )

        self.assertEqual(payload["pair"], "XBTUSD")
        self.assertEqual(payload["type"], "buy")
        self.assertEqual(payload["ordertype"], "market")
        self.assertEqual(payload["volume"], "25")
        self.assertEqual(payload["oflags"], "viqc")
        self.assertEqual(payload["validate"], "true")

    def test_build_limit_add_order_payload_for_sell(self) -> None:
        payload = build_limit_add_order_payload(
            product_id="TAO-USD",
            side="SELL",
            base_size="0.25",
            limit_price="500.5",
            validate=True,
            post_only=True,
        )

        self.assertEqual(payload["pair"], "TAOUSD")
        self.assertEqual(payload["ordertype"], "limit")
        self.assertEqual(payload["price"], "500.5")
        self.assertEqual(payload["volume"], "0.25")
        self.assertEqual(payload["oflags"], "post")
        self.assertEqual(payload["validate"], "true")

    def test_symbol_helpers_normalize_common_kraken_codes(self) -> None:
        self.assertEqual(kraken_pair_from_product("BTC-USD"), "XBTUSD")
        self.assertEqual(normalize_asset_code("XXBT"), "BTC")
        self.assertEqual(normalize_asset_code("ZUSD"), "USD")
        self.assertEqual(normalize_asset_code("ETH2.S"), "ETH")
        self.assertEqual(quote_to_base_size("25", "100"), "0.25")
        self.assertEqual(kraken_interval("15m"), "15")


class KrakenClientTests(unittest.TestCase):
    def test_get_ticker_normalizes_public_payload(self) -> None:
        responses = iter(
            [
                {
                    "error": [],
                    "result": {
                        "XXBTZUSD": {
                            "a": ["100.1", "1", "1.0"],
                            "b": ["100.0", "1", "1.0"],
                        }
                    },
                },
                {
                    "error": [],
                    "result": {
                        "XXBTZUSD": [
                            ["100.0", "0.1", "1"],
                            ["101.0", "0.2", "2"],
                            ["102.0", "0.3", "3"],
                            ["103.0", "0.4", "4"],
                        ],
                        "last": "5",
                    },
                },
            ]
        )

        client = KrakenRESTClient(http_open=_fake_http_open(responses))

        ticker = client.get_ticker("BTC-USD", limit=3)

        self.assertEqual(ticker["best_bid"], "100.0")
        self.assertEqual(ticker["best_ask"], "100.1")
        self.assertEqual([trade["price"] for trade in ticker["trades"]], ["103.0", "102.0", "101.0"])

    def test_list_accounts_normalizes_private_balance_payload(self) -> None:
        responses = iter(
            [
                {
                    "error": [],
                    "result": {
                        "XXBT": "0.5",
                        "ZUSD": "1250.25",
                    },
                }
            ]
        )
        credentials = KrakenCredentials(
            api_key="test-key",
            api_secret=base64.b64encode(b"test-secret").decode("ascii"),
        )
        client = KrakenRESTClient(
            credentials=credentials,
            http_open=_fake_http_open(responses),
            nonce_factory=lambda: "1",
        )

        accounts = client.list_accounts()

        self.assertEqual(
            accounts,
            {
                "accounts": [
                    {
                        "currency": "BTC",
                        "available_balance": {"value": "0.5"},
                        "hold": {"value": "0"},
                        "type": "spot",
                    },
                    {
                        "currency": "USD",
                        "available_balance": {"value": "1250.25"},
                        "hold": {"value": "0"},
                        "type": "spot",
                    },
                ]
            },
        )


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self.payload = payload

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


def _fake_http_open(responses):
    def _open(request, timeout=0):
        del request, timeout
        return _FakeResponse(next(responses))

    return _open


if __name__ == "__main__":
    unittest.main()
