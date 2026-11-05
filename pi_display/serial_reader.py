"""Low-overhead serial reader with automatic reconnecting."""

from __future__ import annotations

import queue
import threading
from typing import Any

try:
    import serial
except ImportError:  # Lets protocol tests run without Pi runtime packages.
    serial = None


class SerialReader(threading.Thread):
    """Read serial bytes in a worker thread and post state/data events."""

    def __init__(self, port: str, baud_rate: int, reconnect_seconds: float = 3) -> None:
        super().__init__(name="uts-serial-reader", daemon=True)
        self.events: queue.SimpleQueue[tuple[str, Any]] = queue.SimpleQueue()
        self._lock = threading.Lock()
        self._port = port
        self._baud_rate = baud_rate
        self._reconnect_seconds = reconnect_seconds
        self._stop_event = threading.Event()
        self._reconfigure_event = threading.Event()

    def reconfigure(self, port: str, baud_rate: int, reconnect_seconds: float) -> None:
        with self._lock:
            self._port = port
            self._baud_rate = int(baud_rate)
            self._reconnect_seconds = float(reconnect_seconds)
        self._reconfigure_event.set()

    def trigger_reconnect(self) -> None:
        """Force an immediate reconnection attempt."""
        self._reconfigure_event.set()

    def stop(self) -> None:
        self._stop_event.set()
        self._reconfigure_event.set()

    def _configuration(self) -> tuple[str, int, float]:
        with self._lock:
            return self._port, self._baud_rate, self._reconnect_seconds

    def run(self) -> None:
        if serial is None:
            self.events.put(("status", (False, "pyserial is not installed")))
            return

        while not self._stop_event.is_set():
            port, baud_rate, reconnect_seconds = self._configuration()
            try:
                with serial.Serial(port=port, baudrate=baud_rate, timeout=0.2) as connection:
                    self.events.put(("status", (True, f"Serial connected: {port}")))
                    self._reconfigure_event.clear()
                    while not self._stop_event.is_set() and not self._reconfigure_event.is_set():
                        waiting = connection.in_waiting
                        data = connection.read(waiting or 1)
                        if data:
                            self.events.put(("data", data))
            except (OSError, serial.SerialException) as exc:
                self.events.put(("status", (False, f"Reconnecting: {exc}")))

            self._reconfigure_event.clear()
            self._stop_event.wait(max(0.5, reconnect_seconds))

