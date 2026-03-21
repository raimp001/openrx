from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


COINBASE_URL = "https://api.coinbase.com"
KRAKEN_URL = "https://api.kraken.com"
PRODUCT_ID = "TAO-USD"
KRAKEN_PAIR = "TAOUSD"
OUTPUT_DIR = Path("data")


def main() -> None:
    args = build_parser().parse_args()
    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    coinbase = {
        "exchange": "coinbase",
        "product_id": PRODUCT_ID,
        "candles_15m": fetch_coinbase_candles("FIFTEEN_MINUTE", limit=350),
        "candles_1h": fetch_coinbase_candles("ONE_HOUR", limit=350),
    }
    kraken = {
        "exchange": "kraken",
        "product_id": PRODUCT_ID,
        "candles_15m": fetch_kraken_candles(15),
        "candles_1h": fetch_kraken_candles(60),
    }

    (output_dir / "coinbase_tao_usd.json").write_text(json.dumps(coinbase, indent=2, sort_keys=True), encoding="utf-8")
    (output_dir / "kraken_tao_usd.json").write_text(json.dumps(kraken, indent=2, sort_keys=True), encoding="utf-8")
    print(f"Wrote {(output_dir / 'coinbase_tao_usd.json')}")
    print(f"Wrote {(output_dir / 'kraken_tao_usd.json')}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Fetch TAO candle datasets for Coinbase and Kraken.")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    return parser


def fetch_coinbase_candles(granularity: str, *, limit: int) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({"granularity": granularity, "limit": str(limit)})
    url = f"{COINBASE_URL}/api/v3/brokerage/market/products/{PRODUCT_ID}/candles?{query}"
    payload = json.loads(_fetch(url).decode("utf-8"))
    candles = payload.get("candles", [])
    return sorted(
        [
            {
                "start": int(str(candle["start"])),
                "open": str(candle["open"]),
                "high": str(candle["high"]),
                "low": str(candle["low"]),
                "close": str(candle["close"]),
                "volume": str(candle["volume"]),
            }
            for candle in candles
        ],
        key=lambda candle: candle["start"],
    )


def fetch_kraken_candles(interval: int) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({"pair": KRAKEN_PAIR, "interval": str(interval)})
    url = f"{KRAKEN_URL}/0/public/OHLC?{query}"
    payload = json.loads(_fetch(url).decode("utf-8"))
    result = payload.get("result", {})
    pair_key = next(key for key in result if key != "last")
    rows = result[pair_key]
    return [
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


def _fetch(url: str) -> bytes:
    request = urllib.request.Request(url=url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=20.0) as response:
        return response.read()


if __name__ == "__main__":
    main()
