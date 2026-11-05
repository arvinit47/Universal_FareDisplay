"""Ticket and counter session state management for Universal Fare Display.

This module has no GUI or hardware dependencies, allowing complete unit test
coverage on development machines and headless environments.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from .config import save_config


class FareState:
    """Encapsulates the passenger ticket data and operator session."""

    def __init__(self, settings: dict[str, Any] | None = None) -> None:
        self.settings: dict[str, Any] = settings if settings is not None else {}
        self.values: dict[str, str] = {}
        self.day: str = ""
        self.month: str = ""
        self.route_from: str = ""
        self.route_to: str = ""
        self.via_stations: list[str] = []
        self.qr_value: str = ""
        self.last_update: dict[str, float] = {}
        self.last_activity: float = time.monotonic()
        self.apply_settings()

    def apply_settings(self) -> None:
        """Initialize or update session values from configuration settings."""
        self.values["operator"] = str(self.settings.get("operator", "")).strip()
        self.values["terminal"] = str(self.settings.get("terminal", "")).strip()
        self.values["window"] = str(self.settings.get("windowNo", "")).strip()
        self.values["shift"] = str(self.settings.get("shiftNo", "")).strip()
        self.values["zone"] = str(self.settings.get("zone", "INDIAN RAILWAYS")).strip()
        self.values["station"] = str(self.settings.get("station", "")).strip()

    def mark_updated(self, name: str) -> None:
        now = time.monotonic()
        self.last_update[name] = now
        self.last_activity = now

    def is_updated_recently(self, name: str, threshold: float = 0.6) -> bool:
        return (time.monotonic() - self.last_update.get(name, 0.0)) < threshold

    def clear_ticket(self) -> None:
        """Clear current passenger ticket data while preserving the operator session."""
        ticket_keys = (
            "source",
            "destination",
            "source_hin",
            "destination_hin",
            "date",
            "adult",
            "child",
            "class",
            "train_type",
            "fare",
            "transaction_type",
            "pay_mode",
            "via",
            "refund",
        )
        for key in ticket_keys:
            self.values[key] = ""
        self.day = ""
        self.month = ""
        self.route_from = ""
        self.route_to = ""
        self.via_stations.clear()
        self.qr_value = ""
        self.last_activity = time.monotonic()

    def reset_all(self) -> None:
        """Full reset of both ticket data and counter session."""
        self.values.clear()
        self.day = ""
        self.month = ""
        self.route_from = ""
        self.route_to = ""
        self.via_stations.clear()
        self.qr_value = ""
        self.last_update.clear()
        self.apply_settings()

    def should_auto_clear(self, timeout_seconds: float) -> bool:
        """Check if an active ticket has exceeded the inactivity threshold."""
        if timeout_seconds <= 0:
            return False
        has_active_ticket = bool(
            self.values.get("source")
            or self.values.get("fare")
            or self.values.get("destination")
        )
        return has_active_ticket and (time.monotonic() - self.last_activity > timeout_seconds)

    def apply_message(
        self,
        message: dict[str, dict[str, Any]],
        *,
        config_path: Path | None = None,
        persist_operator: bool = True,
    ) -> list[str]:
        """Apply parsed UTS message frames. Returns a list of changed keys."""
        changed: list[str] = []

        for key, data in message.items():
            if key == "clear_display_device":
                self.clear_ticket()
                changed.append("clear_ticket")
            elif key == "source_station":
                name = str(data.get("eng_name", "")).strip()
                code = str(data.get("station_code", "")).strip()
                hin = str(data.get("hin_name", "")).strip()
                self.values["source"] = f"{name} ({code})".strip() if code else name
                self.values["source_hin"] = hin
                self.route_from = code or name
                self.mark_updated("source")
                changed.append("source")
            elif key == "destination_station":
                name = str(data.get("eng_name", "")).strip()
                code = str(data.get("station_code", "")).strip()
                hin = str(data.get("hin_name", "")).strip()
                self.values["destination"] = f"{name} ({code})".strip() if code else name
                self.values["destination_hin"] = hin
                self.route_to = code or name
                self.mark_updated("destination")
                changed.append("destination")
            elif key == "date":
                self.day = str(data.get("dateData", "")).zfill(2) if data.get("dateData") else ""
                changed.append("date")
            elif key == "month":
                self.month = str(data.get("monthData", "")).zfill(2) if data.get("monthData") else ""
                changed.append("month")
            elif key == "adult":
                self.values["adult"] = str(data.get("adultData", "")).strip()
                self.mark_updated("adult")
                changed.append("adult")
            elif key == "child":
                self.values["child"] = str(data.get("childData", "")).strip()
                self.mark_updated("child")
                changed.append("child")
            elif key == "class":
                self.values["class"] = str(data.get("Class", "")).strip()
                self.mark_updated("class")
                changed.append("class")
            elif key == "type_of_trian":
                val = str(data.get("value", "")).strip()
                desc = str(data.get("description", "")).strip()
                self.values["train_type"] = f"{val} ({desc})".strip() if desc else val
                self.mark_updated("train_type")
                changed.append("train_type")
            elif key == "fare":
                self.values["fare"] = str(data.get("fareData", "")).strip()
                self.mark_updated("fare")
                changed.append("fare")
            elif key == "transaction_type":
                self.values["transaction_type"] = str(data.get("transactionType", "")).strip()
                self.mark_updated("transaction_type")
                changed.append("transaction_type")
            elif key == "cancellation_refund_amount":
                code_name = str(data.get("code", "CANCELLATION")).strip()
                refund_type = str(data.get("type", "")).strip()
                amount = str(data.get("amount", "")).strip()
                self.values["transaction_type"] = (
                    f"{code_name} ({refund_type})".strip() if refund_type else code_name
                )
                self.values["refund"] = amount
                self.values["fare"] = f"{amount} (REFUND)"
                self.mark_updated("transaction_type")
                self.mark_updated("refund")
                self.mark_updated("fare")
                changed.extend(["transaction_type", "refund", "fare"])
            elif key in {
                "source_station_2",
                "source_station_3",
                "destination_station_2",
                "destination_station_3",
            }:
                via_code = (
                    str(data.get("station_code", ""))
                    or next((str(v) for k, v in data.items() if "Code" in k or "code" in k), "")
                ).strip()
                via_name = (
                    str(data.get("eng_name", ""))
                    or next((str(v) for k, v in data.items() if "English" in k or "Name" in k), "")
                ).strip()
                station_repr = via_code or via_name
                if station_repr and station_repr not in self.via_stations:
                    self.via_stations.append(station_repr)
                self.values["via"] = " - ".join(self.via_stations)
                self.mark_updated("via")
                changed.append("via")
            elif key == "payment_gateway":
                self.values["pay_mode"] = str(data.get("paymentGateway", "")).strip()
                self.mark_updated("pay_mode")
                changed.append("pay_mode")
            elif key == "operator_details":
                updates = {
                    "operator": str(data.get("Operator", "")).strip(),
                    "terminal": str(data.get("Terminal", "")).strip(),
                    "window": str(data.get("WindowNo", "")).strip(),
                    "shift": str(data.get("ShiftNo", "")).strip(),
                }
                self.values.update(updates)
                for name in updates:
                    self.mark_updated(name)
                self.settings.update(
                    {
                        "operator": updates["operator"],
                        "terminal": updates["terminal"],
                        "windowNo": updates["window"],
                        "shiftNo": updates["shift"],
                    }
                )
                if persist_operator and config_path:
                    try:
                        save_config(config_path, self.settings)
                    except OSError:
                        pass
                changed.extend(["operator", "terminal", "window", "shift"])
            elif key == "qr_code":
                self.qr_value = str(data.get("QRCode", "")).strip()
                self.mark_updated("qr_code")
                changed.append("qr_code")

        if self.day and self.month:
            self.values["date"] = f"{self.day}/{self.month}"
            self.mark_updated("date")
            changed.append("date")

        return changed
