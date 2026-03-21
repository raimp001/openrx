from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Mapping


SQLITE_SUFFIXES = {".db", ".sqlite", ".sqlite3"}


def is_sqlite_path(path: str | Path | None) -> bool:
    if path is None:
        return False
    return Path(path).suffix.lower() in SQLITE_SUFFIXES


def load_snapshot(path: str | Path, scope: str) -> dict[str, Any] | None:
    active_path = Path(path)
    if is_sqlite_path(active_path):
        if not active_path.exists():
            return None
        with _connect(active_path) as connection:
            row = connection.execute(
                "SELECT payload_json FROM runtime_snapshots WHERE scope = ?",
                (scope,),
            ).fetchone()
        if row is None:
            return None
        return json.loads(str(row[0]))

    if not active_path.exists():
        return None
    return json.loads(active_path.read_text(encoding="utf-8"))


def save_snapshot(path: str | Path, scope: str, payload: Mapping[str, Any]) -> Path:
    active_path = Path(path)
    if is_sqlite_path(active_path):
        with _connect(active_path) as connection:
            connection.execute(
                """
                INSERT INTO runtime_snapshots (scope, payload_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(scope) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at
                """,
                (
                    scope,
                    json.dumps(dict(payload), indent=2, sort_keys=True),
                    _payload_timestamp(payload),
                ),
            )
        return active_path

    active_path.parent.mkdir(parents=True, exist_ok=True)
    active_path.write_text(json.dumps(dict(payload), indent=2, sort_keys=True), encoding="utf-8")
    return active_path


def append_log(path: str | Path, scope: str, payload: Mapping[str, Any]) -> Path:
    active_path = Path(path)
    if is_sqlite_path(active_path):
        with _connect(active_path) as connection:
            connection.execute(
                """
                INSERT INTO runtime_events (scope, timestamp_utc, payload_json)
                VALUES (?, ?, ?)
                """,
                (
                    scope,
                    _payload_timestamp(payload),
                    json.dumps(dict(payload), sort_keys=True),
                ),
            )
        return active_path

    active_path.parent.mkdir(parents=True, exist_ok=True)
    with active_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dict(payload), sort_keys=True) + "\n")
    return active_path


def load_logs(path: str | Path, scope: str) -> list[dict[str, Any]]:
    active_path = Path(path)
    if is_sqlite_path(active_path):
        if not active_path.exists():
            return []
        with _connect(active_path) as connection:
            rows = connection.execute(
                "SELECT payload_json FROM runtime_events WHERE scope = ? ORDER BY id ASC",
                (scope,),
            ).fetchall()
        return [json.loads(str(row[0])) for row in rows]

    if not active_path.exists():
        return []
    return [json.loads(line) for line in active_path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS runtime_snapshots (
            scope TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS runtime_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT NOT NULL,
            timestamp_utc TEXT NOT NULL,
            payload_json TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS runtime_events_scope_id_idx
        ON runtime_events (scope, id)
        """
    )
    return connection


def _payload_timestamp(payload: Mapping[str, Any]) -> str:
    return str(
        payload.get("timestamp_utc")
        or payload.get("updated_at")
        or payload.get("updated_at_utc")
        or ""
    )
