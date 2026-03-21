from __future__ import annotations

import base64
import json
import os
import secrets
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from time import time
from typing import Any, Callable

from researcher.exchange import ExchangeAPIError, ExchangeConfigurationError
from researcher.secrets import env_or_file_value, env_value


DEFAULT_API_BASE_URL = "https://api.coinbase.com"
DEFAULT_TIMEOUT_SECONDS = 10.0
SANDBOX_HOST = "api-sandbox.coinbase.com"
PUBLIC_MARKET_PRODUCTS_PATH = "/api/v3/brokerage/market/products"
PUBLIC_BEST_BID_ASK_PATH = "/api/v3/brokerage/best_bid_ask"
PRIVATE_HISTORICAL_ORDERS_PATH = "/api/v3/brokerage/orders/historical"


class CoinbaseConfigurationError(ExchangeConfigurationError):
    """Raised when local Coinbase configuration is incomplete."""


class CoinbaseAPIError(ExchangeAPIError):
    """Raised when a Coinbase API request fails."""


@dataclass(frozen=True)
class CoinbaseCredentials:
    api_key_name: str | None = None
    private_key_pem: str | None = None
    private_key_file: str | None = None

    @classmethod
    def from_env(cls) -> "CoinbaseCredentials":
        return cls(
            api_key_name=env_or_file_value("COINBASE_API_KEY_NAME"),
            private_key_pem=env_or_file_value("COINBASE_API_PRIVATE_KEY", trim=False),
            private_key_file=env_value("COINBASE_API_PRIVATE_KEY_FILE"),
        )

    def complete(self) -> bool:
        return bool(self.api_key_name and (self.private_key_pem or self.private_key_file))

    def resolved_private_key(self) -> str:
        if self.private_key_file:
            return Path(self.private_key_file).read_text(encoding="utf-8")
        if self.private_key_pem:
            normalized = self.private_key_pem.replace("\\n", "\n")
            return normalized if normalized.endswith("\n") else normalized + "\n"
        raise CoinbaseConfigurationError(
            "Missing Coinbase private key. Set COINBASE_API_PRIVATE_KEY or COINBASE_API_PRIVATE_KEY_FILE."
        )


class CoinbaseJWTSigner:
    def __init__(
        self,
        credentials: CoinbaseCredentials,
        sign_callback: Callable[[bytes], bytes] | None = None,
    ) -> None:
        self.credentials = credentials
        self._sign_callback = sign_callback

    def build_rest_jwt(self, method: str, path_with_query: str, host: str) -> str:
        if not self.credentials.api_key_name:
            raise CoinbaseConfigurationError("Missing COINBASE_API_KEY_NAME.")

        if not self.credentials.complete():
            raise CoinbaseConfigurationError(
                "Incomplete Coinbase credentials. Set COINBASE_API_KEY_NAME and a private key."
            )

        issued_at = int(time())
        header = {
            "alg": "ES256",
            "kid": self.credentials.api_key_name,
            "nonce": secrets.token_hex(),
            "typ": "JWT",
        }
        payload = {
            "sub": self.credentials.api_key_name,
            "iss": "cdp",
            "nbf": issued_at,
            "exp": issued_at + 120,
            "uri": format_rest_uri(method, path_with_query, host),
        }

        encoded_header = _b64url_json(header)
        encoded_payload = _b64url_json(payload)
        signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")

        signature = (
            self._sign_callback(signing_input)
            if self._sign_callback is not None
            else self._sign_with_openssl(signing_input)
        )
        encoded_signature = _b64url_encode(signature)
        return f"{encoded_header}.{encoded_payload}.{encoded_signature}"

    def _sign_with_openssl(self, signing_input: bytes) -> bytes:
        key_path: str | None = None
        temp_key_path: str | None = None

        try:
            if self.credentials.private_key_file:
                key_path = self.credentials.private_key_file
            else:
                with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8") as handle:
                    handle.write(self.credentials.resolved_private_key())
                    temp_key_path = handle.name
                    key_path = handle.name

            result = subprocess.run(
                ["openssl", "dgst", "-sha256", "-sign", key_path],
                input=signing_input,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            if result.returncode != 0:
                raise CoinbaseConfigurationError(
                    "Failed to sign Coinbase JWT with openssl: "
                    + result.stderr.decode("utf-8", errors="replace").strip()
                )

            return der_ecdsa_signature_to_jose(result.stdout)
        finally:
            if temp_key_path:
                try:
                    os.remove(temp_key_path)
                except FileNotFoundError:
                    pass


class CoinbaseRESTClient:
    exchange_name = "coinbase"

    def __init__(
        self,
        base_url: str | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        credentials: CoinbaseCredentials | None = None,
        signer: CoinbaseJWTSigner | None = None,
        http_open: Callable[..., Any] | None = None,
    ) -> None:
        self.base_url = (base_url or env_value("COINBASE_API_BASE_URL") or DEFAULT_API_BASE_URL).rstrip("/")
        self.timeout_seconds = float(env_value("COINBASE_TIMEOUT_SECONDS", str(timeout_seconds)) or timeout_seconds)
        self.credentials = credentials or CoinbaseCredentials.from_env()
        self.signer = signer or CoinbaseJWTSigner(self.credentials)
        self.http_open = http_open or urllib.request.urlopen

    @property
    def host(self) -> str:
        return urllib.parse.urlparse(self.base_url).netloc

    @property
    def sandbox(self) -> bool:
        return self.host == SANDBOX_HOST

    def list_accounts(self, limit: int = 100) -> dict[str, Any]:
        return self._request(
            "GET",
            "/api/v3/brokerage/accounts",
            query={"limit": str(limit)},
            auth_required=not self.sandbox,
        )

    def get_product(self, product_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            f"{PUBLIC_MARKET_PRODUCTS_PATH}/{product_id}",
            auth_required=False,
        )

    def get_best_bid_ask(self, product_ids: list[str]) -> dict[str, Any]:
        return self._request(
            "GET",
            PUBLIC_BEST_BID_ASK_PATH,
            query={"product_ids": product_ids},
            auth_required=False,
        )

    def get_ticker(self, product_id: str, limit: int = 50) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/api/v3/brokerage/products/{product_id}/ticker",
            query={"limit": str(limit)},
            auth_required=False,
        )

    def get_candles(self, product_id: str, granularity: str, limit: int = 100) -> dict[str, Any]:
        payload = self._request(
            "GET",
            f"{PUBLIC_MARKET_PRODUCTS_PATH}/{product_id}/candles",
            query={
                "granularity": coinbase_granularity(granularity),
                "limit": str(limit),
            },
            auth_required=False,
        )
        candles = payload.get("candles", [])
        normalized = sorted(
            [
                {
                    "start": int(str(candle.get("start", "0"))),
                    "open": str(candle.get("open", "0")),
                    "high": str(candle.get("high", "0")),
                    "low": str(candle.get("low", "0")),
                    "close": str(candle.get("close", "0")),
                    "volume": str(candle.get("volume", "0")),
                }
                for candle in candles
            ],
            key=lambda candle: candle["start"],
        )
        return {
            "product_id": product_id,
            "granularity": granularity,
            "candles": normalized,
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
        payload = build_market_order_payload(
            product_id=product_id,
            side=side,
            quote_size=quote_size,
            base_size=base_size,
            retail_portfolio_id=retail_portfolio_id,
        )
        payload.pop("client_order_id", None)
        return self._request(
            "POST",
            "/api/v3/brokerage/orders/preview",
            body=payload,
            auth_required=not self.sandbox,
        )

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
        payload = build_market_order_payload(
            product_id=product_id,
            side=side,
            quote_size=quote_size,
            base_size=base_size,
            retail_portfolio_id=retail_portfolio_id,
            preview_id=preview_id,
            client_order_id=client_order_id,
        )
        return self._request(
            "POST",
            "/api/v3/brokerage/orders",
            body=payload,
            auth_required=not self.sandbox,
        )

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
        payload = build_limit_order_payload(
            product_id=product_id,
            side=side,
            base_size=base_size,
            limit_price=limit_price,
            retail_portfolio_id=retail_portfolio_id,
            post_only=post_only,
        )
        payload.pop("client_order_id", None)
        return self._request(
            "POST",
            "/api/v3/brokerage/orders/preview",
            body=payload,
            auth_required=not self.sandbox,
        )

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
        payload = build_limit_order_payload(
            product_id=product_id,
            side=side,
            base_size=base_size,
            limit_price=limit_price,
            retail_portfolio_id=retail_portfolio_id,
            post_only=post_only,
            preview_id=preview_id,
            client_order_id=client_order_id,
        )
        return self._request(
            "POST",
            "/api/v3/brokerage/orders",
            body=payload,
            auth_required=not self.sandbox,
        )

    def get_order(
        self,
        *,
        order_id: str | None = None,
        client_order_id: str | None = None,
    ) -> dict[str, Any]:
        resolved_order_id = order_id or client_order_id
        if not resolved_order_id:
            raise ValueError("Provide order_id or client_order_id.")
        payload = self._request(
            "GET",
            f"{PRIVATE_HISTORICAL_ORDERS_PATH}/{resolved_order_id}",
            auth_required=not self.sandbox,
        )
        order = payload.get("order", payload)
        average_price = (
            order.get("average_filled_price")
            or order.get("avg_price")
            or order.get("filled_price")
            or order.get("limit_price")
            or "0"
        )
        filled_base_size = order.get("filled_size") or order.get("filled_quantity") or order.get("base_size") or "0"
        filled_quote_size = order.get("filled_value") or order.get("quote_size") or "0"
        return {
            "exchange": self.exchange_name,
            "order_id": str(order.get("order_id") or resolved_order_id),
            "client_order_id": order.get("client_order_id"),
            "status": normalize_coinbase_order_status(order.get("status")),
            "raw_status": str(order.get("status", "")),
            "side": str(order.get("side", "")).upper(),
            "product_id": order.get("product_id"),
            "average_filled_price": str(average_price),
            "filled_base_size": str(filled_base_size),
            "filled_quote_size": str(filled_quote_size),
            "completion_percentage": str(order.get("completion_percentage", "")),
        }

    def _request(
        self,
        method: str,
        path: str,
        *,
        query: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
        auth_required: bool = True,
    ) -> dict[str, Any]:
        query_string = ""
        if query:
            query_string = urllib.parse.urlencode(query, doseq=True)

        path_with_query = path if not query_string else f"{path}?{query_string}"
        url = f"{self.base_url}{path}"
        if query_string:
            url = f"{url}?{query_string}"

        headers = {"Accept": "application/json"}
        data: bytes | None = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        if auth_required:
            token = self.signer.build_rest_jwt(method, path_with_query, self.host)
            headers["Authorization"] = f"Bearer {token}"

        request = urllib.request.Request(url=url, headers=headers, data=data, method=method.upper())

        try:
            with self.http_open(request, timeout=self.timeout_seconds) as response:
                raw = response.read()
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="replace")
            raise CoinbaseAPIError(f"Coinbase API {exc.code} for {path}: {message}") from exc
        except urllib.error.URLError as exc:
            raise CoinbaseAPIError(f"Unable to reach Coinbase API at {url}: {exc}") from exc

        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))


def build_market_order_payload(
    *,
    product_id: str,
    side: str,
    quote_size: str | None = None,
    base_size: str | None = None,
    retail_portfolio_id: str | None = None,
    preview_id: str | None = None,
    client_order_id: str | None = None,
) -> dict[str, Any]:
    side_upper = side.upper()
    if side_upper not in {"BUY", "SELL"}:
        raise ValueError("side must be BUY or SELL.")
    if not quote_size and not base_size:
        raise ValueError("Either quote_size or base_size must be provided.")
    if quote_size and base_size:
        raise ValueError("Provide only one of quote_size or base_size for a market order.")

    config: dict[str, Any] = {"market_market_ioc": {}}
    if quote_size:
        config["market_market_ioc"]["quote_size"] = quote_size
    if base_size:
        config["market_market_ioc"]["base_size"] = base_size

    payload: dict[str, Any] = {
        "client_order_id": client_order_id or secrets.token_hex(12),
        "product_id": product_id,
        "side": side_upper,
        "order_configuration": config,
    }
    if retail_portfolio_id:
        payload["retail_portfolio_id"] = retail_portfolio_id
    if preview_id:
        payload["preview_id"] = preview_id
    return payload


def build_limit_order_payload(
    *,
    product_id: str,
    side: str,
    base_size: str,
    limit_price: str,
    retail_portfolio_id: str | None = None,
    post_only: bool = False,
    preview_id: str | None = None,
    client_order_id: str | None = None,
) -> dict[str, Any]:
    side_upper = side.upper()
    if side_upper not in {"BUY", "SELL"}:
        raise ValueError("side must be BUY or SELL.")
    if not base_size:
        raise ValueError("base_size is required for a limit order.")
    if not limit_price:
        raise ValueError("limit_price is required for a limit order.")

    payload: dict[str, Any] = {
        "client_order_id": client_order_id or secrets.token_hex(12),
        "product_id": product_id,
        "side": side_upper,
        "order_configuration": {
            "limit_limit_gtc": {
                "base_size": base_size,
                "limit_price": limit_price,
                "post_only": bool(post_only),
            }
        },
    }
    if retail_portfolio_id:
        payload["retail_portfolio_id"] = retail_portfolio_id
    if preview_id:
        payload["preview_id"] = preview_id
    return payload


def format_rest_uri(method: str, path_with_query: str, host: str) -> str:
    normalized_path = path_with_query if path_with_query.startswith("/") else f"/{path_with_query}"
    return f"{method.upper()} {host}{normalized_path}"


def coinbase_granularity(granularity: str) -> str:
    normalized = granularity.strip().lower()
    mapping = {
        "15m": "FIFTEEN_MINUTE",
        "15min": "FIFTEEN_MINUTE",
        "900": "FIFTEEN_MINUTE",
        "1h": "ONE_HOUR",
        "60m": "ONE_HOUR",
        "60min": "ONE_HOUR",
        "3600": "ONE_HOUR",
    }
    if normalized not in mapping:
        raise ValueError("Unsupported Coinbase granularity. Use 15m or 1h.")
    return mapping[normalized]


def normalize_coinbase_order_status(status: Any) -> str:
    normalized = str(status or "").strip().upper()
    if normalized in {"FILLED", "COMPLETED"}:
        return "filled"
    if normalized in {"CANCELLED", "CANCELED", "EXPIRED", "FAILED"}:
        return "canceled"
    if normalized in {"OPEN", "PENDING", "PARTIALLY_FILLED"}:
        return "pending"
    return "unknown"


def extract_coinbase_order_id(payload: dict[str, Any]) -> str | None:
    candidates = [
        payload.get("order_id"),
        payload.get("id"),
        (payload.get("success_response") or {}).get("order_id"),
        (payload.get("order") or {}).get("order_id"),
    ]
    for candidate in candidates:
        if candidate:
            return str(candidate)
    return None


def der_ecdsa_signature_to_jose(signature: bytes, size: int = 32) -> bytes:
    if not signature or signature[0] != 0x30:
        raise CoinbaseConfigurationError("Unexpected ECDSA signature format from openssl.")

    sequence_length, offset = _read_der_length(signature, 1)
    expected_end = offset + sequence_length
    if expected_end != len(signature):
        raise CoinbaseConfigurationError("Malformed DER signature length.")

    r, offset = _read_der_integer(signature, offset)
    s, offset = _read_der_integer(signature, offset)
    if offset != len(signature):
        raise CoinbaseConfigurationError("Unexpected trailing data in DER signature.")

    if r.bit_length() > size * 8 or s.bit_length() > size * 8:
        raise CoinbaseConfigurationError("ECDSA signature component is too large for ES256.")

    return r.to_bytes(size, "big") + s.to_bytes(size, "big")


def _read_der_length(data: bytes, offset: int) -> tuple[int, int]:
    if offset >= len(data):
        raise CoinbaseConfigurationError("Invalid DER length.")

    first = data[offset]
    offset += 1
    if first < 0x80:
        return first, offset

    byte_count = first & 0x7F
    if byte_count == 0 or offset + byte_count > len(data):
        raise CoinbaseConfigurationError("Invalid DER long-form length.")
    return int.from_bytes(data[offset : offset + byte_count], "big"), offset + byte_count


def _read_der_integer(data: bytes, offset: int) -> tuple[int, int]:
    if offset >= len(data) or data[offset] != 0x02:
        raise CoinbaseConfigurationError("Invalid DER integer.")

    length, offset = _read_der_length(data, offset + 1)
    end = offset + length
    if end > len(data):
        raise CoinbaseConfigurationError("DER integer length exceeds signature.")

    return int.from_bytes(data[offset:end], "big"), end


def _b64url_json(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return _b64url_encode(encoded)


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
