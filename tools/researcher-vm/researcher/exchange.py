from __future__ import annotations

from typing import Any, Protocol


SUPPORTED_EXCHANGES = ("coinbase", "kraken")


class ExchangeConfigurationError(RuntimeError):
    """Raised when local exchange configuration is incomplete."""


class ExchangeAPIError(RuntimeError):
    """Raised when an exchange API request fails."""


class TradingClient(Protocol):
    exchange_name: str

    def list_accounts(self, limit: int = 100) -> dict[str, Any]:
        ...

    def get_product(self, product_id: str) -> dict[str, Any]:
        ...

    def get_ticker(self, product_id: str, limit: int = 50) -> dict[str, Any]:
        ...

    def get_candles(self, product_id: str, granularity: str, limit: int = 100) -> dict[str, Any]:
        ...

    def preview_market_order(
        self,
        product_id: str,
        side: str,
        *,
        quote_size: str | None = None,
        base_size: str | None = None,
        retail_portfolio_id: str | None = None,
    ) -> dict[str, Any]:
        ...

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
        ...

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
        ...

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
        ...

    def get_order(
        self,
        *,
        order_id: str | None = None,
        client_order_id: str | None = None,
    ) -> dict[str, Any]:
        ...


def normalize_exchange_name(exchange: str) -> str:
    normalized = exchange.strip().lower()
    if normalized not in SUPPORTED_EXCHANGES:
        raise ValueError(f"Unsupported exchange: {exchange}. Choose from {', '.join(SUPPORTED_EXCHANGES)}.")
    return normalized


def create_exchange_client(exchange: str) -> TradingClient:
    normalized = normalize_exchange_name(exchange)
    if normalized == "coinbase":
        from researcher.coinbase import CoinbaseCredentials, CoinbaseRESTClient

        return CoinbaseRESTClient(credentials=CoinbaseCredentials.from_env())

    from researcher.kraken import KrakenCredentials, KrakenRESTClient

    return KrakenRESTClient(credentials=KrakenCredentials.from_env())
