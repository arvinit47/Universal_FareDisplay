"""Parser for the UTS serial protocol used by the original Electron app.

Frames are ASCII strings that begin with ``$`` and end with ``^``.  This
module deliberately has no pygame or serial dependencies so it can be tested
on a development machine and used by the display process on the Pi.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


TRAIN_TYPES = {
    "O": {"value": "ORD", "description": "ORDINARY"},
    "E": {"value": "M/E", "description": "MAIL/EXP"},
    "S": {"value": "SUP", "description": "SUPERFAST"},
    "T": {"value": "MMT", "description": "MMTS"},
    "C": {"value": "COM", "description": "COMBINED"},
    "R": {"value": "RAJ", "description": "RAJDHANI"},
    "D": {"value": "SHT", "description": "SHATABDI"},
    "M": {"value": "RMT", "description": "RAIL MOTOR"},
    "H": {"value": "DHI", "description": "DARJILLING HILL"},
    "J": {"value": "JAN", "description": "JAN SHATABDI"},
    "P": {"value": "PRM", "description": "PREMIUM SPL"},
    "V": {"value": "VDB", "description": "VANDE BHARAT"},
    "A": {"value": "ANT", "description": "ANTYODAYA"},
    "G": {"value": "GR", "description": "GARIB RATH"},
    "U": {"value": "HMF", "description": "HUMSAFAR"},
    "K": {"value": "SPL", "description": "SPECIAL"},
    "N": {"value": "AB", "description": "AMRIT BHARAT"},
    "B": {"value": "SUB", "description": "SUBURBAN"},
    "L": {"value": "LOC", "description": "LOCAL"},
    "Y": {"value": "TEJ", "description": "TEJAS"},
}

TRANSACTION_TYPES = {
    "SPLC": "SPECIAL CANCEL",
    "PLAT": "PLATFORM",
    "NI": "NON-ISSUE",
    "CANC": "CANCELLATION",
    "CAN": "CANCELLATION",
    "ST": "SEASON TICKET",
    "BPT": "BPT TICKET",
    "SF": "SUPERFAST TICKET",
    "JRNY": "JOURNEY",
    "CARD": "I CARD",
    "MMQT": "MULTIRT MST-QST",
    "RRTT": "RAIL/TOURIST",
    "PART": "PARTIAL CANCELLATION",
    "DUP": "DUPLICATE TICKET",
    "EXT": "EXTENSION",
    "MOD": "MODIFICATION",
    "UPG": "UPGRADATION",
    "CONC": "CONCESSION",
    "REF": "REFUND",
}

ACCESS_KEYS = {
    "00": "thin_client_uts",
    "01": "source_station",
    "02": "destination_station",
    "03": "date",
    "04": "month",
    "05": "adult",
    "06": "child",
    "07": "type_of_trian",  # Kept for compatibility with the Electron app.
    "08": "fare",
    "09": "class",
    "12": "transaction_type",
    "13": "clear_display_device",
    "14": "cancellation_refund_amount",
    "15": "operator_details",
    "17": "source_station_2",
    "18": "source_station_3",
    "19": "destination_station_2",
    "20": "destination_station_3",
    "21": "payment_gateway",
    "22": "qr_code",
}


def _payload_with_declared_length(core: str) -> str | None:
    """Extract the variable-length payload used by codes 00, 12, 14, 15 and 17-22.

    ``core`` has no leading ``$`` or trailing ``^``.  For example, the core
    for ``$1525VENU GOPAL:NLDS99:105:3:^`` is ``1525VENU ... :``.
    """

    length_match = re.match(r"\d+", core[2:])
    if not length_match:
        return None

    length = int(length_match.group(0))
    payload_start = 2 + len(length_match.group(0))
    # Legacy UTS transmitters count the field separator and frame terminator
    # in several variable-length fields (for example station and operator
    # details).  ``core`` intentionally excludes the terminator, so add it
    # back solely for this length-compatible slice.
    wire_core = core + "^"
    payload = wire_core[payload_start : payload_start + length]
    if len(payload) != length:
        # Some UTS transmitters count bytes rather than Unicode code points,
        # or omit the trailing separator in their length counter. If clean,
        # fallback to the remainder of the core payload.
        payload = core[payload_start:]
    return payload.rstrip(":^")


def _station(core: str) -> dict[str, str] | None:
    # The original renderer treats station length as informational. Some UTS
    # sources count the final separator differently, so use the station text
    # through the frame separator rather than reject an otherwise valid route.
    length_match = re.match(r"^(\d+)", core[2:])
    if length_match:
        length_str = length_match.group(0)
        payload = core[2 + len(length_str) :].rstrip(":")
    else:
        length_str = core[2:4]
        payload = core[4:].rstrip(":")
    if not payload:
        return None
    station_code, eng_name, hin_name = (payload.split(":", 2) + ["", "", ""])[:3]
    return {
        "names": payload,
        "length": length_str,
        "station_code": station_code.strip(),
        "eng_name": eng_name.strip(),
        "hin_name": hin_name.strip(),
    }


def parse_frame(frame: str) -> tuple[str | None, dict[str, Any] | None, str | None]:
    """Parse one complete UTS frame.

    Returns ``(access_key, value, error)``.  The value keys intentionally
    match the existing renderer contract, allowing captured traffic from the
    Electron application to be replayed unchanged.
    """

    if not (frame.startswith("$") and frame.endswith("^")):
        return None, None, "invalid-frame-boundary"

    core = frame[1:-1]
    if len(core) < 2:
        return None, None, "frame-too-short"

    code = core[:2]
    access_key = ACCESS_KEYS.get(code)
    if access_key is None:
        return None, None, f"unknown-code:{code}"

    try:
        if code in {"01", "02"}:
            value = _station(core)
        elif code in {"03", "04"}:
            # A few deployed terminals emit a one-character length marker for
            # date fields (for example $03406:^). The actual value is always
            # the final two characters before the separator.
            date_value = core[2:].rstrip(":")[-2:]
            value = {"dateData" if code == "03" else "monthData": date_value}
        elif code in {"05", "06"}:
            value_name = "adultData" if code == "05" else "childData"
            value = {value_name: core[4:].split(":", 1)[0]}
        elif code == "07":
            value = TRAIN_TYPES.get(core[4:5])
        elif code == "08":
            # Fare frames use the same leading two length-marker characters
            # but legacy transmitters report a length that includes separators.
            value = {"fareData": core[4:].split(":", 1)[0]}
        elif code == "09":
            value = {"Class": core[4:].split(":", 1)[0]}
        elif code == "13":
            value = {"clearDisplay": core[4:5]}
        elif code == "00":
            payload = _payload_with_declared_length(core)
            value = {"data": payload} if payload is not None else None
        elif code == "12":
            payload = _payload_with_declared_length(core)
            value = (
                {"transactionType": TRANSACTION_TYPES.get(payload, payload)}
                if payload is not None
                else None
            )
        elif code == "14":
            payload = _payload_with_declared_length(core)
            if payload is None:
                value = None
            else:
                code_data, refund_type, amount = (payload.split(":", 2) + ["", "", ""])[:3]
                value = {
                    "code": TRANSACTION_TYPES.get(code_data, code_data),
                    "type": refund_type,
                    "amount": amount,
                }
        elif code == "15":
            payload = _payload_with_declared_length(core)
            if payload is None:
                value = None
            else:
                operator, terminal, window, shift = (payload.split(":", 3) + ["", "", "", ""])[:4]
                value = {
                    "Operator": operator,
                    "Terminal": terminal,
                    "WindowNo": window,
                    "ShiftNo": shift,
                }
        elif code in {"17", "18", "19", "20"}:
            payload = _payload_with_declared_length(core)
            if payload is None:
                value = None
            else:
                station_code, english, hindi = (payload.split(":", 2) + ["", "", ""])[:3]
                prefixes = {
                    "17": "sourceStation2",
                    "18": "sourceStation3",
                    "19": "destinationStation2",
                    "20": "destinationStation3",
                }
                prefix = prefixes[code]
                value = {
                    f"{prefix}Code": station_code,
                    f"{prefix}NameEnglish": english,
                    f"{prefix}NameHindi": hindi,
                }
        elif code == "21":
            payload = _payload_with_declared_length(core)
            value = {"paymentGateway": payload} if payload is not None else None
        elif code == "22":
            payload = _payload_with_declared_length(core)
            value = {"QRCode": payload} if payload is not None else None
        else:  # Defensive guard for future ACCESS_KEYS additions.
            value = None
    except (TypeError, ValueError, IndexError) as exc:
        return access_key, None, f"parse-error:{exc}"

    if value is None:
        return access_key, None, "invalid-payload"
    return access_key, value, None


@dataclass
class FrameStream:
    """Incrementally extracts frames from arbitrarily fragmented serial data."""

    max_buffer: int = 20 * 1024
    buffer: str = ""
    errors: list[str] = field(default_factory=list)

    def feed(self, raw: bytes | str) -> list[dict[str, dict[str, Any]]]:
        if isinstance(raw, bytes):
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                text = raw.decode("latin-1", errors="replace")
        else:
            text = raw
        self.buffer += text.replace("\r", "").replace("\n", "")

        if len(self.buffer) > self.max_buffer:
            last_start = self.buffer.rfind("$")
            self.buffer = self.buffer[last_start:] if last_start >= 0 else ""
            self.errors.append("buffer-overflow-cleared")

        messages: list[dict[str, dict[str, Any]]] = []
        while self.buffer:
            start = self.buffer.find("$")
            if start < 0:
                self.buffer = ""
                break
            if start:
                self.buffer = self.buffer[start:]

            end = self.buffer.find("^", 1)
            if end < 0:
                break

            frame = self.buffer[: end + 1]
            self.buffer = self.buffer[end + 1 :]

            # A new $ before the terminator means the first fragment was junk.
            nested_start = frame.rfind("$", 1)
            if nested_start >= 0:
                self.buffer = frame[nested_start:] + self.buffer
                self.errors.append("resynchronized-at-new-frame")
                continue

            access_key, value, error = parse_frame(frame)
            if error:
                self.errors.append(error)
            elif access_key and value is not None:
                messages.append({access_key: value})
        return messages

