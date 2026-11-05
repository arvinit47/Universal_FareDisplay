"""Configuration storage for the Pi display."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


DEFAULTS: dict[str, Any] = {
    "port": "/dev/serial0",
    "baudRate": "9600",
    "operator": "",
    "station": "",
    "zone": "INDIAN RAILWAYS",
    "message": "भारतीय रेलवे आपका स्वागत करता है  INDIAN RAILWAYS WELCOMES YOU",
    "terminal": "",
    "windowNo": "",
    "shiftNo": "",
    "fullscreen": True,
    # The board redraws only when UTS data changes. Four small dynamic updates
    # per second keep the marquee readable without stressing a Pi Zero W.
    "displayFps": 4,
    "serialReconnectSeconds": 3,
    "demoMode": False,
    "autoClearSeconds": 0,
}


def default_config_path() -> Path:
    return Path(__file__).resolve().parents[1] / "config" / "rpi-config.json"


def load_config(path: Path) -> dict[str, Any]:
    """Load config, retaining future custom keys and filling known defaults."""

    try:
        with path.open("r", encoding="utf-8") as config_file:
            saved = json.load(config_file)
        if not isinstance(saved, dict):
            raise ValueError("configuration root must be an object")
    except FileNotFoundError:
        saved = {}
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Cannot read configuration {path}: {exc}") from exc
    return {**DEFAULTS, **saved}


def save_config(path: Path, settings: dict[str, Any]) -> None:
    """Atomically save configuration so a power loss cannot leave broken JSON."""

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    try:
        temporary_path.write_text(
            json.dumps(settings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        os.replace(temporary_path, path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink(missing_ok=True)

