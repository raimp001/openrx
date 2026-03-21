from __future__ import annotations

import os
from pathlib import Path


DEFAULT_SECRET_CONFIG = Path("config/local_secrets.env")
SECRET_CONFIG_ENV = "RESEARCHER_SECRET_CONFIG"


def configured_secret_config_path(path: str | Path | None = None) -> Path | None:
    if path is not None:
        return Path(path)
    explicit = os.getenv(SECRET_CONFIG_ENV)
    if explicit:
        return Path(explicit).expanduser()
    if DEFAULT_SECRET_CONFIG.exists():
        return DEFAULT_SECRET_CONFIG
    return None


def load_secret_config(path: str | Path | None = None) -> dict[str, str]:
    config_path = configured_secret_config_path(path)
    if config_path is None or not config_path.exists():
        return {}

    values: dict[str, str] = {}
    for line_number, raw_line in enumerate(config_path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("export "):
            stripped = stripped[7:].strip()
        if "=" not in stripped:
            raise ValueError(f"Invalid secret config line {line_number} in {config_path}: expected KEY=VALUE.")
        key, value = stripped.split("=", maxsplit=1)
        key = key.strip()
        if not key:
            raise ValueError(f"Invalid secret config line {line_number} in {config_path}: empty key.")
        values[key] = _strip_quotes(value.strip())
    return values


def env_value(name: str, default: str | None = None, *, config_path: str | Path | None = None) -> str | None:
    value = os.getenv(name)
    if value not in {None, ""}:
        return value
    configured = load_secret_config(config_path).get(name)
    if configured not in {None, ""}:
        return configured
    return default


def env_or_file_value(
    name: str,
    default: str | None = None,
    *,
    trim: bool = True,
    config_path: str | Path | None = None,
) -> str | None:
    value = env_value(name, config_path=config_path)
    if value not in {None, ""}:
        return value

    file_value = env_value(f"{name}_FILE", config_path=config_path)
    if file_value in {None, ""}:
        return default

    text = Path(file_value).expanduser().read_text(encoding="utf-8")
    return text.strip() if trim else text


def _strip_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value
