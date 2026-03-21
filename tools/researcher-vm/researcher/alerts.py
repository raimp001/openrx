from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable

from researcher.secrets import env_or_file_value


DEFAULT_TELEGRAM_API_BASE = "https://api.telegram.org"


def telegram_configured() -> bool:
    return bool(env_or_file_value("TELEGRAM_BOT_TOKEN") and env_or_file_value("TELEGRAM_CHAT_ID"))


def send_telegram_alert(
    message: str,
    *,
    token: str | None = None,
    chat_id: str | None = None,
    parse_mode: str | None = None,
    http_open: Callable[..., Any] | None = None,
) -> bool:
    bot_token = token or env_or_file_value("TELEGRAM_BOT_TOKEN")
    target_chat_id = chat_id or env_or_file_value("TELEGRAM_CHAT_ID")
    if not bot_token or not target_chat_id:
        return False

    opener = http_open or urllib.request.urlopen
    payload = {
        "chat_id": target_chat_id,
        "text": message,
        "disable_web_page_preview": True,
    }
    if parse_mode:
        payload["parse_mode"] = parse_mode

    data = urllib.parse.urlencode(payload).encode("utf-8")
    request = urllib.request.Request(
        url=f"{DEFAULT_TELEGRAM_API_BASE}/bot{bot_token}/sendMessage",
        headers={"Accept": "application/json"},
        data=data,
        method="POST",
    )

    try:
        with opener(request, timeout=10.0) as response:
            raw = response.read()
    except urllib.error.URLError:
        return False

    if not raw:
        return False
    body = json.loads(raw.decode("utf-8"))
    return bool(body.get("ok"))
