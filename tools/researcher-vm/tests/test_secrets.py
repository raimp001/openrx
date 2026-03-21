from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from researcher.alerts import send_telegram_alert, telegram_configured
from researcher.coinbase import CoinbaseCredentials
from researcher.kraken import KrakenCredentials
from researcher.secrets import load_secret_config


class SecretConfigTests(unittest.TestCase):
    def test_load_secret_config_parses_export_lines_and_quotes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "live.env"
            config_path.write_text(
                'export FOO="bar"\n'
                "BAZ='qux'\n"
                "# comment\n"
                "EMPTY=\n",
                encoding="utf-8",
            )

            values = load_secret_config(config_path)

            self.assertEqual(values["FOO"], "bar")
            self.assertEqual(values["BAZ"], "qux")
            self.assertEqual(values["EMPTY"], "")

    def test_exchange_credentials_can_be_loaded_from_file_backed_secret_config(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            coinbase_name = root / "coinbase_api_key_name"
            coinbase_key = root / "coinbase_private_key.pem"
            kraken_key = root / "kraken_api_key"
            kraken_secret = root / "kraken_api_secret"

            coinbase_name.write_text("organizations/test/apiKeys/key-1\n", encoding="utf-8")
            coinbase_key.write_text("-----BEGIN PRIVATE KEY-----\nline\n-----END PRIVATE KEY-----\n", encoding="utf-8")
            kraken_key.write_text("kraken-key-1\n", encoding="utf-8")
            kraken_secret.write_text("kraken-secret-1\n", encoding="utf-8")

            config_path = root / "live.env"
            config_path.write_text(
                "\n".join(
                    [
                        f"COINBASE_API_KEY_NAME_FILE={coinbase_name}",
                        f"COINBASE_API_PRIVATE_KEY_FILE={coinbase_key}",
                        f"KRAKEN_API_KEY_FILE={kraken_key}",
                        f"KRAKEN_API_SECRET_FILE={kraken_secret}",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )

            with patch.dict(os.environ, {"RESEARCHER_SECRET_CONFIG": str(config_path)}, clear=True):
                coinbase = CoinbaseCredentials.from_env()
                kraken = KrakenCredentials.from_env()

            self.assertEqual(coinbase.api_key_name, "organizations/test/apiKeys/key-1")
            self.assertEqual(coinbase.private_key_file, str(coinbase_key))
            self.assertEqual(coinbase.resolved_private_key(), coinbase_key.read_text(encoding="utf-8"))
            self.assertEqual(kraken.api_key, "kraken-key-1")
            self.assertEqual(kraken.api_secret_file, str(kraken_secret))
            self.assertEqual(kraken.resolved_api_secret(), "kraken-secret-1")

    def test_telegram_helpers_read_file_backed_values_from_secret_config(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            bot_token = root / "telegram_bot_token"
            chat_id = root / "telegram_chat_id"
            bot_token.write_text("token-123\n", encoding="utf-8")
            chat_id.write_text("chat-456\n", encoding="utf-8")

            config_path = root / "live.env"
            config_path.write_text(
                "\n".join(
                    [
                        f"TELEGRAM_BOT_TOKEN_FILE={bot_token}",
                        f"TELEGRAM_CHAT_ID_FILE={chat_id}",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )

            class FakeResponse:
                def __enter__(self):
                    return self

                def __exit__(self, exc_type, exc, tb):
                    del exc_type, exc, tb
                    return False

                def read(self):
                    return b'{"ok": true}'

            def fake_open(request, timeout=10.0):
                del timeout
                self.assertIn("/bottoken-123/sendMessage", request.full_url)
                return FakeResponse()

            with patch.dict(os.environ, {"RESEARCHER_SECRET_CONFIG": str(config_path)}, clear=True):
                self.assertTrue(telegram_configured())
                sent = send_telegram_alert("hello", http_open=fake_open)

            self.assertTrue(sent)
