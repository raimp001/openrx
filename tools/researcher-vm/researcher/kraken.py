from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from decimal import Decimal, ROUND_DOWN
from pathlib import Path
from time import time_ns
from typing import Any, Callable, Mapping

from researcher.exchange import ExchangeAPIError, ExchangeConfigurationError
from researcher.secrets import env_or_file_value, env_value


DEFAULT_API_BASE_URL = "https://api.kraken.com"
DEFAULT_TIMEOUT_SECONDS = 10.0

PRIVATE_BALANCE_PATH = "/0/private/Balance"
PRIVATE_ADD_ORDER_PATH = "/0/private/AddOrder"
PRIVATE_QUERY_ORDERS_PATH = "/0/private/QueryOrders"
PUBLIC_ASSET_PAIRS_PATH = "/0/public/AssetPairs"
PUBLIC_OHLC_PATH = "/0/public/OHLC"
PUBLIC_TICKER_PATH = "/0/public/Ticker"
PUBLIC_TRADES_PATH = "/0/public/Trades"

ASSET_ALIASES = {
    "XXBT": "BTC",
    "XBT": "BTC",
    "XXDG": "DOGE",
    "XDG": "DOGE",
    "XETH": "ETH",
    "ETH2": "ETH",
    "ETH2.S": "ETH",
    "ZUSD": "USD",
    "ZEUR": "EUR",
    "ZGBP": "GBP",
    "ZCAD": "CAD",
    "ZAUD": "AUD",
    "ZJPY": "JPY",
    "ZCHF": "CHF",
}

BASE_ASSET_ALIASES = {
    "BTC": "XBT",
    "DOGE": "XDG",
}


class KrakenConfigurationError(ExchangeConfigurationError):
    """Raised when local Kraken configuration is incomplete."""


class KrakenAPIError(ExchangeAPIError):
    """Raised when a Kraken API request fails."""


@dataclass(frozen=True)
class KrakenCredentials:
    api_key: str | None = None
    api_secret: str | None = None
    api_secret_file: str | None = None
    otp: str | None = None

    @classmethod
    def from_env(cls) -> "KrakenCredentials":
        return cls(
            api_key=env_or_file_value("KRAKEN_API_KEY"),
            api_secret=env_or_file_value("KRAKEN_API_SECRET"),
            api_secret_file=env_value("KRAKEN_API_SECRET_FILE"),
            otp=env_or_file_value("KRAKEN_API_OTP"),
        )

    def complete(self) -> bool:
        return bool(self.api_key and (self.api_secret or self.api_secret_file))

    def resolved_api_secret(self) -> str:
        if self.api_secret_file:
            return Path(self.api_secret_file).read_text(encoding="utf-8").strip()
        if self.api_secret:
            return self.api_secret.strip()
        raise KrakenConfigurationError(
            "Missing Kraken API secret. Set KRAKEN_API_SECRET or KRAKEN_API_SECRET_FILE."
        )


class KrakenRESTClient:
    exchange_name = "kraken"

    def __init__(
        self,
        base_url: str | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        credentials: KrakenCredentials | None = None,
        http_open: Callable[..., Any] | None = None,
        nonce_factory: Callable[[], str] | None = None,
    ) -> None:
        self.base_url = (base_url or env_value("KRAKEN_API_BASE_URL") or DEFAULT_API_BASE_URL).rstrip("/")
        self.timeout_seconds = float(env_value("KRAKEN_TIMEOUT_SECONDS", str(timeout_seconds)) or timeout_seconds)
        self.credentials = credentials or KrakenCredentials.from_env()
        self.http_open = http_open or urllib.request.urlopen
        self.nonce_factory = nonce_factory or default_nonce

    def list_accounts(self, limit: int = 100) -> dict[str, Any]:
        del limit
        payload = self._request_private(PRIVATE_BALANCE_PATH, {}).get("result", {})
        accounts = []
        for asset, balance in sorted(payload.items()):
            currency = normalize_asset_code(asset)
            if not currency:
                continue
            accounts.append(
                {
                    "currency": currency,
                    "available_balance": {"value": str(balance)},
                    "hold": {"value": "0"},
                    "type": "spot",
                }
            )
        return {"accounts": accounts}

    def get_product(self, product_id: str) -> dict[str, Any]:
        pair = kraken_pair_from_product(product_id)
        asset_pairs_payload = self._request_public(PUBLIC_ASSET_PAIRS_PATH, {"pair": pair})
        ticker_payload = self._request_public(PUBLIC_TICKER_PATH, {"pair": pair})

        pair_result = asset_pairs_payload["result"]
        pair_key = next(iter(pair_result))
        pair_info = pair_result[pair_key]

        ticker_result = ticker_payload["result"]
        ticker_key = next(iter(ticker_result))
        book = ticker_result[ticker_key]
        last_price = str((book.get("c") or [book["a"][0]])[0])

        return {
            "product_id": product_id,
            "status": pair_info.get("status", "online"),
            "base_increment": decimal_increment_from_places(pair_info.get("lot_decimals", 8)),
            "quote_increment": str(pair_info.get("tick_size") or decimal_increment_from_places(pair_info.get("pair_decimals", 2))),
            "base_min_size": str(pair_info.get("ordermin", "0")),
            "quote_min_size": str(pair_info.get("costmin", "0")),
            "best_bid": str(book["b"][0]),
            "best_ask": str(book["a"][0]),
            "last_price": last_price,
            "volume_24h": str(book["v"][1]),
            "volume_weighted_average_24h": str(book["p"][1]),
        }

    def get_ticker(self, product_id: str, limit: int = 50) -> dict[str, Any]:
        pair = kraken_pair_from_product(product_id)
        ticker_payload = self._request_public(PUBLIC_TICKER_PATH, {"pair": pair})
        trades_payload = self._request_public(PUBLIC_TRADES_PATH, {"pair": pair})

        ticker_result = ticker_payload["result"]
        ticker_key = next(iter(ticker_result))
        book = ticker_result[ticker_key]
        last_price = str((book.get("c") or [book["a"][0]])[0])

        trades_result = trades_payload["result"]
        trade_key = next(key for key in trades_result if key != "last")
        trade_rows = list(trades_result[trade_key])[-limit:]
        trade_rows.reverse()

        return {
            "product_id": product_id,
            "best_bid": str(book["b"][0]),
            "best_ask": str(book["a"][0]),
            "last_price": last_price,
            "volume_24h": str((book.get("v") or ["0", "0"])[1]),
            "trades": [{"price": str(row[0]), "size": str(row[1]), "time": str(row[2])} for row in trade_rows],
        }

    def get_candles(self, product_id: str, granularity: str, limit: int = 100) -> dict[str, Any]:
        pair = kraken_pair_from_product(product_id)
        payload = self._request_public(
            PUBLIC_OHLC_PATH,
            {
                "pair": pair,
                "interval": kraken_interval(granularity),
            },
        )
        result = payload["result"]
        candle_key = next(key for key in result if key != "last")
        rows = list(result[candle_key])[-limit:]
        candles = [
            {
                "start": int(str(row[0])),
                "open": str(row[1]),
                "high": str(row[2]),
                "low": str(row[3]),
                "close": str(row[4]),
                "volume": str(row[6]),
            }
            for row in rows
        ]
        return {
            "product_id": product_id,
            "granularity": granularity,
            "candles": candles,
        }

    def preview_market_order(
        self,
        product_id: str,
        side: str,
        *,
        quote_size: str | None = None,
        base_size: str | None = None,
        retail_portfolio_id: str | None = None,
    ) -> dict[str, Any]:
        del retail_portfolio_id
        payload = self._add_order_payload(
            product_id=product_id,
            side=side,
            quote_size=quote_size,
            base_size=base_size,
            validate=True,
        )
        response = self._request_private(PRIVATE_ADD_ORDER_PATH, payload, raise_on_errors=False)
        return {
            "preview_id": None,
            "errs": response.get("error", []),
            "preview": response.get("result", {}),
        }

    def create_market_order(
        self,
        product_id: str,
        side: str,
        *,
        quote_size: str | None = None,
        base_size: str | None = None,
        retail_portfolio_id: str | None = None,
        preview_id: str | None = None,
        client_order_id: str | None = None,
    ) -> dict[str, Any]:
        del retail_portfolio_id, preview_id
        payload = self._add_order_payload(
            product_id=product_id,
            side=side,
            quote_size=quote_size,
            base_size=base_size,
            validate=False,
            client_order_id=client_order_id,
        )
        return self._request_private(PRIVATE_ADD_ORDER_PATH, payload)

    def preview_limit_order(
        self,
        product_id: str,
        side: str,
        *,
        base_size: str,
        limit_price: str,
        retail_portfolio_id: str | None = None,
        post_only: bool = False,
    ) -> dict[str, Any]:
        del retail_portfolio_id
        payload = build_limit_add_order_payload(
            product_id=product_id,
            side=side,
            base_size=base_size,
            limit_price=limit_price,
            validate=True,
            post_only=post_only,
        )
        response = self._request_private(PRIVATE_ADD_ORDER_PATH, payload, raise_on_errors=False)
        return {
            "preview_id": None,
            "errs": response.get("error", []),
            "preview": response.get("result", {}),
        }

    def create_limit_order(
        self,
        product_id: str,
        side: str,
        *,
        base_size: str,
        limit_price: str,
        retail_portfolio_id: str | None = None,
        post_only: bool = False,
        preview_id: str | None = None,
        client_order_id: str | None = None,
    ) -> dict[str, Any]:
        del retail_portfolio_id, preview_id
        payload = build_limit_add_order_payload(
            product_id=product_id,
            side=side,
            base_size=base_size,
            limit_price=limit_price,
            validate=False,
            client_order_id=client_order_id,
            post_only=post_only,
        )
        return self._request_private(PRIVATE_ADD_ORDER_PATH, payload)

    def get_order(
        self,
        *,
        order_id: str | None = None,
        client_order_id: str | None = None,
    ) -> dict[str, Any]:
        del client_order_id
        if not order_id:
            raise ValueError("Kraken order lookup currently requires order_id.")
        payload = self._request_private(PRIVATE_QUERY_ORDERS_PATH, {"txid": order_id})
        result = payload.get("result", {})
        if not result:
            raise KrakenAPIError(f"No Kraken order found for {order_id}.")
        lookup_key = next(iter(result))
        order = result[lookup_key]
        order_volume = Decimal(str(order.get("vol", "0")))
        executed_volume = Decimal(str(order.get("vol_exec", "0")))
        average_price = order.get("avg_price") or order.get("price") or "0"
        quote_filled = order.get("cost") or (executed_volume * Decimal(str(average_price or "0")))
        client_id = order.get("cl_ord_id") or order.get("userref")
        return {
            "exchange": self.exchange_name,
            "order_id": str(lookup_key),
            "client_order_id": str(client_id) if client_id is not None else None,
            "status": normalize_kraken_order_status(order.get("status"), order_volume, executed_volume),
            "raw_status": str(order.get("status", "")),
            "side": str(order.get("descr", {}).get("type", "")).upper(),
            "product_id": product_from_kraken_pair(str(order.get("descr", {}).get("pair", ""))),
            "average_filled_price": str(average_price),
            "filled_base_size": str(executed_volume),
            "filled_quote_size": str(quote_filled),
        }

    def _add_order_payload(
        self,
        *,
        product_id: str,
        side: str,
        quote_size: str | None,
        base_size: str | None,
        validate: bool,
        client_order_id: str | None = None,
    ) -> dict[str, str]:
        payload = build_add_order_payload(
            product_id=product_id,
            side=side,
            quote_size=quote_size,
            base_size=base_size,
            validate=validate,
            client_order_id=client_order_id,
        )
        if quote_size and side.upper() != "BUY":
            ticker = self.get_ticker(product_id, limit=1)
            payload["volume"] = quote_to_base_size(quote_size, ticker["best_bid"])
        return payload

    def _request_public(self, path: str, query: Mapping[str, Any] | None = None) -> dict[str, Any]:
        return self._request("GET", path, query=query, auth_required=False)

    def _request_private(
        self,
        path: str,
        payload: Mapping[str, Any],
        *,
        raise_on_errors: bool = True,
    ) -> dict[str, Any]:
        return self._request("POST", path, body=payload, auth_required=True, raise_on_errors=raise_on_errors)

    def _request(
        self,
        method: str,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
        body: Mapping[str, Any] | None = None,
        auth_required: bool,
        raise_on_errors: bool = True,
    ) -> dict[str, Any]:
        query_string = urllib.parse.urlencode(query or {}, doseq=True)
        url = f"{self.base_url}{path}"
        if query_string:
            url = f"{url}?{query_string}"

        headers = {"Accept": "application/json"}
        data: bytes | None = None
        if method.upper() == "POST":
            payload = {key: str(value) for key, value in (body or {}).items()}
            if auth_required:
                if not self.credentials.complete():
                    raise KrakenConfigurationError(
                        "Incomplete Kraken credentials. Set KRAKEN_API_KEY and a Kraken secret."
                    )
                payload["nonce"] = self.nonce_factory()
                if self.credentials.otp:
                    payload["otp"] = self.credentials.otp
                encoded_payload = urllib.parse.urlencode(payload)
                headers["API-Key"] = self.credentials.api_key or ""
                headers["API-Sign"] = build_api_sign(path, payload["nonce"], encoded_payload, self.credentials.resolved_api_secret())
            else:
                encoded_payload = urllib.parse.urlencode(payload)
            headers["Content-Type"] = "application/x-www-form-urlencoded; charset=utf-8"
            data = encoded_payload.encode("utf-8")

        request = urllib.request.Request(url=url, headers=headers, data=data, method=method.upper())

        try:
            with self.http_open(request, timeout=self.timeout_seconds) as response:
                raw = response.read()
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="replace")
            raise KrakenAPIError(f"Kraken API {exc.code} for {path}: {message}") from exc
        except urllib.error.URLError as exc:
            raise KrakenAPIError(f"Unable to reach Kraken API at {url}: {exc}") from exc

        if not raw:
            payload = {}
        else:
            payload = json.loads(raw.decode("utf-8"))

        errors = payload.get("error") or []
        if errors and raise_on_errors:
            raise KrakenAPIError(f"Kraken API error for {path}: {', '.join(str(error) for error in errors)}")
        return payload


def build_api_sign(url_path: str, nonce: str, encoded_payload: str, secret: str) -> str:
    encoded = (nonce + encoded_payload).encode("utf-8")
    message = url_path.encode("utf-8") + hashlib.sha256(encoded).digest()
    signature = hmac.new(base64.b64decode(secret), message, hashlib.sha512)
    return base64.b64encode(signature.digest()).decode("ascii")


def build_add_order_payload(
    *,
    product_id: str,
    side: str,
    quote_size: str | None = None,
    base_size: str | None = None,
    validate: bool = False,
    client_order_id: str | None = None,
) -> dict[str, str]:
    side_lower = side.lower()
    if side_lower not in {"buy", "sell"}:
        raise ValueError("side must be BUY or SELL.")
    if not quote_size and not base_size:
        raise ValueError("Either quote_size or base_size must be provided.")
    if quote_size and base_size:
        raise ValueError("Provide only one of quote_size or base_size for a market order.")

    payload = {
        "pair": kraken_pair_from_product(product_id),
        "type": side_lower,
        "ordertype": "market",
    }
    if quote_size:
        payload["volume"] = str(quote_size)
        if side_lower == "buy":
            payload["oflags"] = "viqc"
    if base_size:
        payload["volume"] = str(base_size)
    if validate:
        payload["validate"] = "true"
    if client_order_id:
        payload["cl_ord_id"] = client_order_id
    return payload


def build_limit_add_order_payload(
    *,
    product_id: str,
    side: str,
    base_size: str,
    limit_price: str,
    validate: bool = False,
    client_order_id: str | None = None,
    post_only: bool = False,
) -> dict[str, str]:
    side_lower = side.lower()
    if side_lower not in {"buy", "sell"}:
        raise ValueError("side must be BUY or SELL.")
    if not base_size:
        raise ValueError("base_size is required for a limit order.")
    if not limit_price:
        raise ValueError("limit_price is required for a limit order.")

    payload = {
        "pair": kraken_pair_from_product(product_id),
        "type": side_lower,
        "ordertype": "limit",
        "price": str(limit_price),
        "volume": str(base_size),
    }
    if post_only:
        payload["oflags"] = "post"
    if validate:
        payload["validate"] = "true"
    if client_order_id:
        payload["cl_ord_id"] = client_order_id
    return payload


def default_nonce() -> str:
    return str(time_ns() // 1_000)


def kraken_interval(granularity: str) -> str:
    normalized = granularity.strip().lower()
    mapping = {
        "15m": "15",
        "15min": "15",
        "900": "15",
        "1h": "60",
        "60m": "60",
        "60min": "60",
        "3600": "60",
    }
    if normalized not in mapping:
        raise ValueError("Unsupported Kraken granularity. Use 15m or 1h.")
    return mapping[normalized]


def kraken_pair_from_product(product_id: str) -> str:
    base_asset, quote_asset = product_id.split("-", maxsplit=1)
    base = BASE_ASSET_ALIASES.get(base_asset.upper(), base_asset.upper())
    quote = quote_asset.upper()
    return f"{base}{quote}"


def normalize_asset_code(asset_code: str) -> str:
    normalized = asset_code.split(".", maxsplit=1)[0].upper()
    normalized = ASSET_ALIASES.get(normalized, normalized)
    if len(normalized) > 3 and normalized[0] in {"X", "Z"}:
        candidate = normalized[1:]
        if candidate in {"USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "ETH", "BTC", "DOGE"}:
            return candidate
    return normalized


def quote_to_base_size(quote_size: str, reference_price: str) -> str:
    quote_value = Decimal(str(quote_size))
    price = Decimal(str(reference_price))
    if price <= 0:
        raise ValueError("Reference price must be positive.")
    base_value = (quote_value / price).quantize(Decimal("0.00000001"), rounding=ROUND_DOWN)
    return format(base_value.normalize(), "f")


def decimal_increment_from_places(places: int | str) -> str:
    digits = int(str(places))
    if digits <= 0:
        return "1"
    return "0." + ("0" * (digits - 1)) + "1"


def product_from_kraken_pair(pair: str) -> str:
    normalized = pair.upper()
    suffixes = ("USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF")
    for suffix in suffixes:
        if normalized.endswith(suffix):
            base = normalized[: -len(suffix)]
            return f"{normalize_asset_code(base)}-{normalize_asset_code(suffix)}"
    return normalized


def normalize_kraken_order_status(status: Any, order_volume: Decimal, executed_volume: Decimal) -> str:
    normalized = str(status or "").strip().lower()
    if normalized == "closed":
        return "filled" if executed_volume >= order_volume and order_volume > 0 else "canceled"
    if normalized in {"canceled", "cancelled", "expired"}:
        return "canceled"
    if normalized in {"pending", "open"}:
        return "pending"
    return "unknown"


def extract_kraken_order_id(payload: dict[str, Any]) -> str | None:
    result = payload.get("result", {})
    txids = result.get("txid")
    if isinstance(txids, list) and txids:
        return str(txids[0])
    return None
