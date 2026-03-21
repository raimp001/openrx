from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from tao_autoresearch.train import load_dataset, search, write_outputs


class TAOAutoresearchTests(unittest.TestCase):
    def test_search_runs_on_synthetic_dataset(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dataset_path = Path(temp_dir) / "dataset.json"
            output_dir = Path(temp_dir) / "runs"
            dataset_path.write_text(json.dumps(_synthetic_dataset()), encoding="utf-8")

            dataset = load_dataset(dataset_path)
            best_candidate, best_result, history = search(
                dataset,
                budget_seconds=0.5,
                max_candidates=4,
                seed=7,
            )
            best_path, history_path = write_outputs(
                output_dir,
                best_candidate=best_candidate,
                best_result=best_result,
                history=history,
                dataset=dataset,
            )

            self.assertGreaterEqual(len(history), 1)
            self.assertTrue(best_path.exists())
            self.assertTrue(history_path.exists())
            best_payload = json.loads(best_path.read_text(encoding="utf-8"))
            self.assertIn("best_candidate", best_payload)
            self.assertIn("best_result", best_payload)


def _synthetic_dataset() -> dict:
    candles_15m = []
    candles_1h = []
    start_15m = 1_700_000_000
    start_1h = 1_700_000_000
    price = 100.0
    for index in range(160):
        drift = 0.12 if index < 90 else (-0.08 if index < 120 else 0.18)
        open_price = price
        close_price = price + drift
        candles_15m.append(
            {
                "start": start_15m + (index * 900),
                "open": f"{open_price:.4f}",
                "high": f"{close_price + 0.25:.4f}",
                "low": f"{open_price - 0.25:.4f}",
                "close": f"{close_price:.4f}",
                "volume": "150.0",
            }
        )
        price = close_price

    price = 100.0
    for index in range(80):
        drift = 0.4 if index < 45 else (-0.15 if index < 60 else 0.5)
        open_price = price
        close_price = price + drift
        candles_1h.append(
            {
                "start": start_1h + (index * 3600),
                "open": f"{open_price:.4f}",
                "high": f"{close_price + 0.35:.4f}",
                "low": f"{open_price - 0.35:.4f}",
                "close": f"{close_price:.4f}",
                "volume": "500.0",
            }
        )
        price = close_price

    return {
        "exchange": "kraken",
        "product_id": "TAO-USD",
        "candles_15m": candles_15m,
        "candles_1h": candles_1h,
    }


if __name__ == "__main__":
    unittest.main()
