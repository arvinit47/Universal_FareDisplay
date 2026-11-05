"""Fullscreen, Raspberry Pi Zero W fare display.

Run with ``python3 -m pi_display.main`` from the repository root or from the
directory installed by the deployment instructions in README.md.
"""

from __future__ import annotations

import argparse
import os
import queue
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")

try:
    import pygame
except ImportError as exc:  # pragma: no cover - only reached on incomplete installs.
    raise SystemExit("pygame is required. Install the Pi dependencies listed in README.md.") from exc

try:
    import qrcode
except ImportError:  # QR display degrades gracefully but the app remains usable.
    qrcode = None

from .config import default_config_path, load_config, save_config
from .protocol import FrameStream
from .serial_reader import SerialReader
from .state import FareState


ROOT = Path(__file__).resolve().parents[1]
ASSET_LOGO = ROOT / "assets" / "indian-railways-logo.png"
BACKGROUND = (235, 239, 245)
SURFACE = (255, 255, 255)
MAROON = (122, 15, 20)
MAROON_DARK = (92, 10, 14)
GOLD = (240, 180, 41)
GOLD_LIGHT = (253, 230, 138)
VALUE_BG = (26, 26, 46)
VALUE_TEXT = (248, 250, 252)
MUTED = (100, 116, 139)
BORDER = (226, 232, 240)
GREEN = (134, 239, 172)
RED = (252, 165, 165)


def clamp(value: int, lower: int, upper: int) -> int:
    return max(lower, min(value, upper))


class Fonts:
    """Loads system fonts with reliable Devanagari fallback on Linux, Pi OS, and Windows."""

    def __init__(self) -> None:
        candidates = (
            ROOT / "assets" / "fonts" / "NotoSansDevanagari-Regular.ttf",
            Path("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf"),
            Path("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf"),
            Path("/usr/share/fonts/opentype/noto/NotoSansDevanagari-Regular.otf"),
            Path("/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
            Path("C:/Windows/Fonts/Nirmala.ttc"),
            Path("C:/Windows/Fonts/NirmalaB.ttf"),
            Path("C:/Windows/Fonts/nirmala.ttf"),
            Path("C:/Windows/Fonts/mangal.ttf"),
        )
        self.indic_path = next((path for path in candidates if path.exists()), None)
        self.cache: dict[tuple[int, bool, bool], pygame.font.Font] = {}

    def get(self, size: int, bold: bool = False, indic: bool = False) -> pygame.font.Font:
        key = (max(8, size), bold, indic)
        if key not in self.cache:
            if indic and self.indic_path:
                try:
                    self.cache[key] = pygame.font.Font(str(self.indic_path), key[0])
                except Exception:
                    self.cache[key] = pygame.font.SysFont("nirmalaui,mangal,dejavusans", key[0], bold=bold)
            else:
                self.cache[key] = pygame.font.SysFont("dejavusans,segoeui,arial", key[0], bold=bold)
        return self.cache[key]


class FareDisplay:
    def __init__(self, settings: dict[str, Any], config_path: Path, windowed: bool) -> None:
        pygame.init()
        pygame.font.init()
        self.settings = settings
        self.config_path = config_path
        self.fonts = Fonts()
        self.fullscreen = not windowed
        flags = pygame.FULLSCREEN if self.fullscreen else pygame.RESIZABLE
        requested_size = (0, 0) if self.fullscreen else (1280, 720)
        self.screen = pygame.display.set_mode(requested_size, flags)
        pygame.display.set_caption("Indian Railways Fare Display — UTS")
        pygame.mouse.set_visible(False)
        self.clock = pygame.time.Clock()
        self.running = True
        self.serial_connected = False
        self.serial_message = "Connecting…"
        self.stream = FrameStream()
        self.state = FareState(self.settings)
        self.values = self.state.values
        self.qr_surface: pygame.Surface | None = None
        self.demo_mode = False
        self.help_open = False
        self.settings_open = False
        self.settings_fields = [
            ("port", "Serial Port"),
            ("baudRate", "Baud Rate"),
            ("operator", "Operator Name"),
            ("station", "Station Name"),
            ("zone", "Railway Zone"),
            ("message", "Marquee Message"),
            ("terminal", "Terminal ID"),
            ("windowNo", "Window Number"),
            ("shiftNo", "Shift Number"),
            ("displayFps", "Display FPS (4-30)"),
            ("autoClearSeconds", "Auto-clear Sec (0=off)"),
        ]
        self.settings_index = 0
        self.draft_settings: dict[str, Any] = {}
        self.reader: SerialReader | None = None
        self.logo = self._load_logo()
        # Off-screen surface caching for high rendering performance on Pi Zero W
        self.static_surface: pygame.Surface | None = None
        self.needs_full_redraw = True
        self._cached_marquee_surf: pygame.Surface | None = None
        self._cached_marquee_key: tuple[str, int] | None = None
        self.apply_settings_to_display()

    def _invalidate_full_redraw(self) -> None:
        self.needs_full_redraw = True

    def _load_logo(self) -> pygame.Surface | None:
        if not ASSET_LOGO.exists():
            return None
        try:
            return pygame.image.load(str(ASSET_LOGO)).convert_alpha()
        except pygame.error:
            return None

    def _draw_logo_fallback(self, surface: pygame.Surface, logo_rect: pygame.Rect, scale: float) -> None:
        """Draw an authentic railway emblem when no bitmap asset is present."""
        self._rounded_on(surface, logo_rect.inflate(12, 12), SURFACE, int(10 * scale))
        centre = logo_rect.center
        outer_radius = max(12, logo_rect.width // 2 - 3)
        inner_radius = max(8, outer_radius * 4 // 5)
        pygame.draw.circle(surface, MAROON, centre, outer_radius)
        pygame.draw.circle(surface, GOLD, centre, inner_radius, width=max(1, outer_radius // 10))
        train_width = outer_radius * 5 // 4
        train_height = max(6, outer_radius // 2)
        train = pygame.Rect(centre[0] - train_width // 2, centre[1] - train_height // 5, train_width, train_height)
        pygame.draw.polygon(
            surface,
            GOLD,
            [
                (train.left, train.bottom),
                (train.right, train.bottom),
                (train.right - train_width // 7, train.top),
                (train.left + train_width // 7, train.top),
            ],
        )
        pygame.draw.rect(
            surface,
            GOLD_LIGHT,
            pygame.Rect(train.left + train_width // 10, train.bottom - train_height // 3, train_width * 4 // 5, max(2, train_height // 3)),
            border_radius=2,
        )
        wheel_radius = max(2, outer_radius // 7)
        pygame.draw.circle(surface, VALUE_BG, (train.left + train_width // 4, train.bottom + wheel_radius), wheel_radius)
        pygame.draw.circle(surface, VALUE_BG, (train.right - train_width // 4, train.bottom + wheel_radius), wheel_radius)

    def start_serial(self) -> None:
        if self.reader is not None:
            return
        try:
            baud_rate = int(self.settings.get("baudRate", 9600))
        except (TypeError, ValueError):
            baud_rate = 9600
        self.reader = SerialReader(
            str(self.settings.get("port", "/dev/serial0")),
            baud_rate,
            float(self.settings.get("serialReconnectSeconds", 3)),
        )
        self.reader.start()

    def stop_serial(self) -> None:
        if self.reader:
            self.reader.stop()
            self.reader.join(timeout=1.0)
            self.reader = None

    def apply_settings_to_display(self) -> None:
        self.state.apply_settings()
        self._invalidate_full_redraw()

    def clear_ticket(self) -> None:
        """Clear passenger ticket information while preserving the active operator session."""
        self.state.clear_ticket()
        self.qr_surface = None
        self._invalidate_full_redraw()

    def reset_all(self) -> None:
        """Reset ticket and session values."""
        self.state.reset_all()
        self.qr_surface = None
        self._invalidate_full_redraw()

    def _make_qr(self, value: str) -> None:
        if not value or qrcode is None:
            self.qr_surface = None
            return
        try:
            qr = qrcode.QRCode(
                version=None,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=10,
                border=2,
            )
            qr.add_data(value)
            qr.make(fit=True)
            image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
            self.qr_surface = pygame.image.fromstring(image.tobytes(), image.size, "RGB")
        except Exception as exc:
            self.qr_surface = None
            self.serial_message = f"QR generation failed: {exc}"
        self._invalidate_full_redraw()

    def apply_message(self, message: dict[str, dict[str, Any]], *, persist_operator: bool = True) -> None:
        changed = self.state.apply_message(
            message, config_path=self.config_path, persist_operator=persist_operator
        )
        if "qr_code" in changed:
            self._make_qr(self.state.qr_value)
        if "clear_ticket" in changed:
            self.qr_surface = None
        if changed:
            self._invalidate_full_redraw()

    def _handle_serial_events(self) -> None:
        # Check auto-clear timer
        auto_clear = float(self.settings.get("autoClearSeconds", 0))
        if self.state.should_auto_clear(auto_clear):
            self.clear_ticket()
            self.serial_message = "Ticket auto-cleared (timeout)"

        if not self.reader:
            return
        while True:
            try:
                event, payload = self.reader.events.get_nowait()
            except queue.Empty:
                return
            if event == "status":
                self.serial_connected, self.serial_message = payload
            elif event == "data":
                for message in self.stream.feed(payload):
                    self.apply_message(message)
                if self.stream.errors:
                    self.serial_message = self.stream.errors[-1]
                    self.stream.errors.clear()

    def _start_settings(self) -> None:
        self.settings_open = True
        self.help_open = False
        self.draft_settings = {key: str(self.settings.get(key, "")) for key, _ in self.settings_fields}
        self.settings_index = 0
        pygame.key.start_text_input()

    def _close_settings(self, save: bool) -> None:
        if save:
            self.settings.update(self.draft_settings)
            try:
                self.settings["baudRate"] = str(int(str(self.settings.get("baudRate", 9600))))
                self.settings["serialReconnectSeconds"] = max(
                    0.5, float(self.settings.get("serialReconnectSeconds", 3))
                )
                if "displayFps" in self.settings:
                    self.settings["displayFps"] = clamp(int(str(self.settings["displayFps"])), 4, 30)
                if "autoClearSeconds" in self.settings:
                    self.settings["autoClearSeconds"] = max(0, int(str(self.settings["autoClearSeconds"])))
                save_config(self.config_path, self.settings)
                self.apply_settings_to_display()
                if self.reader:
                    self.reader.reconfigure(
                        str(self.settings["port"]),
                        int(self.settings["baudRate"]),
                        float(self.settings["serialReconnectSeconds"]),
                    )
                self.serial_message = "Settings saved. Reconnecting…"
            except (OSError, ValueError) as exc:
                self.serial_message = f"Settings save failed: {exc}"
        self.settings_open = False
        pygame.key.stop_text_input()
        self._invalidate_full_redraw()

    def _toggle_fullscreen(self) -> None:
        self.fullscreen = not self.fullscreen
        flags = pygame.FULLSCREEN if self.fullscreen else pygame.RESIZABLE
        size = (0, 0) if self.fullscreen else (1280, 720)
        self.screen = pygame.display.set_mode(size, flags)
        self._invalidate_full_redraw()

    def _handle_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.QUIT:
            self.running = False
            return
        if event.type == pygame.VIDEORESIZE:
            self.screen = pygame.display.set_mode(event.size, pygame.RESIZABLE)
            self._invalidate_full_redraw()
            return

        if event.type != pygame.KEYDOWN:
            if event.type == pygame.TEXTINPUT and self.settings_open:
                key, _ = self.settings_fields[self.settings_index]
                self.draft_settings[key] = str(self.draft_settings.get(key, "")) + event.text
            return

        ctrl = bool(event.mod & pygame.KMOD_CTRL)
        shift = bool(event.mod & pygame.KMOD_SHIFT)

        if ctrl and event.key == pygame.K_q:
            self.running = False
            return

        if event.key == pygame.K_F11:
            self._toggle_fullscreen()
            return

        if event.key == pygame.K_F1 or (not self.settings_open and event.key == pygame.K_h):
            self.help_open = not self.help_open
            return

        if self.help_open and event.key in (pygame.K_ESCAPE, pygame.K_SPACE, pygame.K_RETURN):
            self.help_open = False
            return

        if (ctrl and event.key == pygame.K_r) or event.key == pygame.K_F5:
            if self.reader:
                self.reader.trigger_reconnect()
            self.serial_message = "Reconnecting serial…"
            self._invalidate_full_redraw()
            return

        if ctrl and event.key == pygame.K_d and not self.settings_open:
            self.demo_mode = not self.demo_mode
            if self.demo_mode:
                self.serial_connected = True
                self.serial_message = "Demo mode active"
                self._feed_demo_data()
            else:
                self.clear_ticket()
                self.serial_message = "Demo ended. Reconnecting…"
                if self.reader:
                    self.reader.trigger_reconnect()
            return

        if ctrl and shift and event.key == pygame.K_c and not self.settings_open:
            self.clear_ticket()
            return

        if ctrl and event.key == pygame.K_a and not self.settings_open:
            self._start_settings()
            return

        if not self.settings_open:
            return

        if event.key == pygame.K_ESCAPE:
            self._close_settings(save=False)
        elif event.key == pygame.K_F10 or (ctrl and event.key == pygame.K_s):
            self._close_settings(save=True)
        elif event.key == pygame.K_RETURN:
            if self.settings_index == len(self.settings_fields) - 1:
                self._close_settings(save=True)
            else:
                self.settings_index = (self.settings_index + 1) % len(self.settings_fields)
        elif event.key in (pygame.K_TAB, pygame.K_DOWN):
            self.settings_index = (self.settings_index + 1) % len(self.settings_fields)
        elif event.key == pygame.K_UP:
            self.settings_index = (self.settings_index - 1) % len(self.settings_fields)
        elif event.key == pygame.K_BACKSPACE:
            key, _ = self.settings_fields[self.settings_index]
            self.draft_settings[key] = str(self.draft_settings.get(key, ""))[:-1]
        elif event.key == pygame.K_DELETE or (ctrl and event.key == pygame.K_u):
            key, _ = self.settings_fields[self.settings_index]
            self.draft_settings[key] = ""

    def _text_on(
        self,
        surface: pygame.Surface,
        text: str,
        rect: pygame.Rect,
        size: int,
        color: tuple[int, int, int],
        *,
        bold: bool = False,
        center: bool = True,
        indic: bool = False,
        clip: bool = True,
    ) -> None:
        if not text:
            text = "—"
            color = tuple(max(0, channel - 80) for channel in color)
        font_size = max(8, size)
        font = self.fonts.get(font_size, bold=bold, indic=indic)
        rendered = font.render(text, True, color)
        while clip and rendered.get_width() > max(1, rect.width - 12) and font_size > 8:
            font_size -= 1
            font = self.fonts.get(font_size, bold=bold, indic=indic)
            rendered = font.render(text, True, color)
        text_rect = rendered.get_rect()
        if center:
            text_rect.center = rect.center
        else:
            text_rect.midleft = (rect.left + 6, rect.centery)
        previous_clip = surface.get_clip()
        if clip:
            surface.set_clip(rect)
        surface.blit(rendered, text_rect)
        surface.set_clip(previous_clip)

    def _text(
        self,
        text: str,
        rect: pygame.Rect,
        size: int,
        color: tuple[int, int, int],
        *,
        bold: bool = False,
        center: bool = True,
        indic: bool = False,
        clip: bool = True,
    ) -> None:
        self._text_on(self.screen, text, rect, size, color, bold=bold, center=center, indic=indic, clip=clip)

    def _rounded_on(self, surface: pygame.Surface, rect: pygame.Rect, color: tuple[int, int, int], radius: int) -> None:
        pygame.draw.rect(surface, color, rect, border_radius=max(2, radius))

    def _rounded(self, rect: pygame.Rect, color: tuple[int, int, int], radius: int) -> None:
        self._rounded_on(self.screen, rect, color, radius)

    def _label_box_on(self, surface: pygame.Surface, rect: pygame.Rect, english: str, hindi: str = "") -> None:
        self._rounded_on(surface, rect, SURFACE, max(5, rect.height // 8))
        pygame.draw.rect(surface, BORDER, rect, width=max(1, rect.width // 300), border_radius=max(5, rect.height // 8))
        if hindi:
            upper = pygame.Rect(rect.x, rect.y + rect.height // 8, rect.width, rect.height * 4 // 10)
            lower = pygame.Rect(rect.x, rect.y + rect.height // 2, rect.width, rect.height * 3 // 10)
            self._text_on(surface, english, upper, rect.height // 5, MAROON, bold=True)
            self._text_on(surface, hindi, lower, rect.height // 6, MUTED, indic=True)
        elif "\n" in english:
            lines = english.split("\n", 1)
            self._text_on(surface, lines[0], pygame.Rect(rect.x, rect.y + rect.height // 8, rect.width, rect.height // 3), rect.height // 5, MAROON, bold=True)
            self._text_on(surface, lines[1], pygame.Rect(rect.x, rect.y + rect.height // 2, rect.width, rect.height // 3), rect.height // 5, MAROON, bold=True)
        else:
            self._text_on(surface, english, rect, rect.height // 5, MAROON, bold=True)

    def _value_box(self, rect: pygame.Rect, name: str, *, fare: bool = False, hindi_sub: str = "") -> None:
        updated = self.state.is_updated_recently(name, 0.6)
        if fare:
            color = (160, 24, 32) if updated else MAROON
            border_color = GOLD
        else:
            color = (43, 43, 67) if updated else VALUE_BG
            border_color = None
        self._rounded(rect, color, max(5, rect.height // 8))
        if border_color:
            pygame.draw.rect(self.screen, border_color, rect, width=max(1, rect.width // 240), border_radius=max(5, rect.height // 8))

        value = self.values.get(name, "")
        if fare and value and not value.startswith("₹"):
            value = f"₹ {value}"

        if hindi_sub and hindi_sub != value:
            # Bilingual value rendering (English upper, Hindi lower)
            upper_rect = pygame.Rect(rect.x, rect.y + 2, rect.width, rect.height * 5 // 9)
            lower_rect = pygame.Rect(rect.x, rect.y + rect.height * 5 // 9 - 2, rect.width, rect.height * 4 // 9)
            self._text(value, upper_rect, rect.height // 4, GOLD_LIGHT if fare else VALUE_TEXT, bold=True)
            self._text(hindi_sub, lower_rect, rect.height // 5, GOLD_LIGHT if fare else (210, 220, 235), indic=True)
        else:
            self._text(value, rect, rect.height // (3 if fare else 5), GOLD_LIGHT if fare else VALUE_TEXT, bold=True)

    def _grid_rect(self, columns: list[int], rows: list[int], col: int, row: int, col_span: int, row_span: int = 1) -> pygame.Rect:
        left = columns[col]
        right = columns[col + col_span] - 8
        top = rows[row]
        bottom = rows[row + row_span] - 8
        return pygame.Rect(left, top, max(1, right - left), max(1, bottom - top))

    def _build_static_background(self, width: int, height: int, scale: float) -> tuple[pygame.Surface, int]:
        """Pre-render static board elements onto an off-screen surface for peak performance."""
        bg = pygame.Surface((width, height))
        bg.fill(BACKGROUND)

        header_height = clamp(int(height * 0.24), int(145 * scale), int(220 * scale))
        pygame.draw.rect(bg, MAROON, pygame.Rect(0, 0, width, header_height))
        padding = clamp(int(28 * scale), 12, 38)
        meta_top = padding
        meta_width = clamp(int(145 * scale), 82, 180)
        meta_height = clamp(int(58 * scale), 38, 72)

        for index, label in enumerate(("TERMINAL ID", "WINDOW NO.", "SHIFT NO.")):
            rect = pygame.Rect(padding + index * (meta_width + int(12 * scale)), meta_top, meta_width, meta_height)
            self._rounded_on(bg, rect, (145, 39, 44), max(6, int(10 * scale)))
            label_rect = pygame.Rect(rect.x, rect.y + 5, rect.width, rect.height // 3)
            self._text_on(bg, label, label_rect, int(10 * scale), (235, 220, 220), bold=True)

        title_y = meta_top + meta_height + int(18 * scale)
        self._text_on(bg, "Ticket", pygame.Rect(padding, title_y, int(160 * scale), int(45 * scale)), int(36 * scale), SURFACE, bold=True, center=False, clip=False)
        self._text_on(bg, "Information", pygame.Rect(padding + int(132 * scale), title_y, int(265 * scale), int(45 * scale)), int(36 * scale), GOLD, bold=True, center=False, clip=False)
        self._text_on(bg, "भारतीय रेल — Passenger Fare Display", pygame.Rect(padding, title_y + int(45 * scale), int(430 * scale), int(25 * scale)), int(13 * scale), (225, 210, 210), center=False, indic=True, clip=False)

        logo_size = clamp(int(90 * scale), 52, 110)
        logo_rect = pygame.Rect(width - padding - logo_size, header_height - padding - logo_size, logo_size, logo_size)
        if self.logo:
            logo = pygame.transform.smoothscale(self.logo, logo_rect.size)
            self._rounded_on(bg, logo_rect.inflate(12, 12), SURFACE, int(10 * scale))
            bg.blit(logo, logo_rect)
        else:
            self._draw_logo_fallback(bg, logo_rect, scale)

        show_route = bool(self.state.route_from and self.state.route_to)
        route_height = int(42 * scale) if show_route else 0
        pad_x = clamp(int(18 * scale), 8, 24)
        top = header_height + (int(8 * scale) if show_route else int(14 * scale)) + route_height

        marquee_height = clamp(int(52 * scale), 32, 58)
        board_rect = pygame.Rect(pad_x, top, width - 2 * pad_x, max(40, height - top - marquee_height - int(12 * scale)))
        self._rounded_on(bg, board_rect, SURFACE, clamp(int(16 * scale), 6, 16))
        pygame.draw.rect(bg, BORDER, board_rect, width=1, border_radius=clamp(int(16 * scale), 6, 16))

        inner_pad = clamp(int(12 * scale), 5, 14)
        grid = board_rect.inflate(-2 * inner_pad, -2 * inner_pad)
        col_width = grid.width / 24
        row_height = grid.height / 5
        columns = [round(grid.left + col_width * index) for index in range(25)]
        rows = [round(grid.top + row_height * index) for index in range(6)]

        # Row 1 Labels
        self._label_box_on(bg, self._grid_rect(columns, rows, 0, 0, 4, 1), "From", "कहाँ से")
        self._label_box_on(bg, self._grid_rect(columns, rows, 12, 0, 4, 1), "To", "कहाँ तक")

        # Row 2 Labels
        self._label_box_on(bg, self._grid_rect(columns, rows, 0, 1, 3, 1), "Date", "तारीख")
        self._label_box_on(bg, self._grid_rect(columns, rows, 6, 1, 2, 1), "Adult", "वयस्क")
        self._label_box_on(bg, self._grid_rect(columns, rows, 10, 1, 2, 1), "Child", "बच्चे")
        self._label_box_on(bg, self._grid_rect(columns, rows, 14, 1, 2, 1), "Class", "श्रेणी")
        self._label_box_on(bg, self._grid_rect(columns, rows, 18, 1, 2, 1), "Fare", "भाड़ा")

        # Row 3 Labels
        self._label_box_on(bg, self._grid_rect(columns, rows, 0, 2, 4, 1), "Type of Train", "गाड़ी का प्रकार")
        self._label_box_on(bg, self._grid_rect(columns, rows, 10, 2, 3, 1), "Pay Mode", "भुगतान")

        # Row 4 Labels
        self._label_box_on(bg, self._grid_rect(columns, rows, 0, 3, 4, 1), "Transaction", "लेन-देन प्रकार")
        is_refund = bool(self.values.get("refund"))
        via_label = "Refund Amount" if is_refund else "Via / Route"
        via_hin = "वापसी राशि" if is_refund else "मार्ग / वाया"
        self._label_box_on(bg, self._grid_rect(columns, rows, 10, 3, 3, 1), via_label, via_hin)

        # Row 5 Labels
        self._label_box_on(bg, self._grid_rect(columns, rows, 0, 4, 4, 1), "Operator\nName", "ऑपरेटर")

        # Footer Marquee Bar
        marquee_rect = pygame.Rect(0, height - marquee_height, width, marquee_height)
        pygame.draw.rect(bg, (15, 15, 26), marquee_rect)
        pygame.draw.line(bg, GOLD, marquee_rect.topleft, marquee_rect.topright, max(1, int(3 * scale)))

        return bg, header_height

    def _draw_board(self) -> None:
        width, height = self.screen.get_size()
        scale = min(width / 1920, height / 1080)

        # Rebuild static background when dirty or resized
        if self.static_surface is None or self.needs_full_redraw or self.static_surface.get_size() != (width, height):
            self.static_surface, self._header_height = self._build_static_background(width, height, scale)
            self.needs_full_redraw = False

        # Blit cached static background
        self.screen.blit(self.static_surface, (0, 0))

        # Dynamic Header Elements:
        header_height = self._header_height
        padding = clamp(int(28 * scale), 12, 38)
        meta_top = padding
        meta_width = clamp(int(145 * scale), 82, 180)
        meta_height = clamp(int(58 * scale), 38, 72)

        for index, key in enumerate(("terminal", "window", "shift")):
            rect = pygame.Rect(padding + index * (meta_width + int(12 * scale)), meta_top, meta_width, meta_height)
            value_rect = pygame.Rect(rect.x, rect.y + rect.height // 3, rect.width, rect.height * 3 // 5)
            self._text(self.values.get(key, ""), value_rect, int(21 * scale), GOLD_LIGHT, bold=True)

        logo_size = clamp(int(90 * scale), 52, 110)
        logo_rect = pygame.Rect(width - padding - logo_size, header_height - padding - logo_size, logo_size, logo_size)
        right_edge = logo_rect.left - int(20 * scale)

        now = datetime.now().strftime("%a, %d %b %Y  %H:%M:%S")
        status = "●  Serial Connected" if self.serial_connected else "●  " + self.serial_message
        status_color = GREEN if self.serial_connected else (GOLD_LIGHT if "connect" in self.serial_message.lower() else RED)

        self._text(now, pygame.Rect(max(padding, right_edge - int(390 * scale)), padding, int(385 * scale), int(25 * scale)), int(13 * scale), SURFACE, bold=True, center=False, clip=False)
        self._text(status, pygame.Rect(max(padding, right_edge - int(390 * scale)), padding + int(31 * scale), int(385 * scale), int(25 * scale)), int(12 * scale), status_color, bold=True, center=False, clip=True)

        # Dynamic Route Banner:
        show_route = bool(self.state.route_from and self.state.route_to)
        pad_x = clamp(int(18 * scale), 8, 24)
        route_height = int(42 * scale) if show_route else 0
        if show_route:
            route_rect = pygame.Rect(pad_x, header_height + int(6 * scale), width - 2 * pad_x, route_height - int(3 * scale))
            self._rounded(route_rect, (248, 239, 224), int(10 * scale))
            via_hint = f" (via {self.values['via']})" if self.values.get("via") else ""
            self._text(f"{self.state.route_from}    ➔    {self.state.route_to}{via_hint}", route_rect, int(18 * scale), MAROON, bold=True)

        # Dynamic Grid Value Boxes:
        top = header_height + (int(8 * scale) if show_route else int(14 * scale)) + route_height
        marquee_height = clamp(int(52 * scale), 32, 58)
        board_rect = pygame.Rect(pad_x, top, width - 2 * pad_x, max(40, height - top - marquee_height - int(12 * scale)))
        inner_pad = clamp(int(12 * scale), 5, 14)
        grid = board_rect.inflate(-2 * inner_pad, -2 * inner_pad)
        col_width = grid.width / 24
        row_height = grid.height / 5
        columns = [round(grid.left + col_width * index) for index in range(25)]
        rows = [round(grid.top + row_height * index) for index in range(6)]

        # Row 1 Values
        self._value_box(self._grid_rect(columns, rows, 4, 0, 8, 1), "source", hindi_sub=self.values.get("source_hin", ""))
        self._value_box(self._grid_rect(columns, rows, 16, 0, 8, 1), "destination", hindi_sub=self.values.get("destination_hin", ""))

        # Row 2 Values
        self._value_box(self._grid_rect(columns, rows, 3, 1, 3, 1), "date")
        self._value_box(self._grid_rect(columns, rows, 8, 1, 2, 1), "adult")
        self._value_box(self._grid_rect(columns, rows, 12, 1, 2, 1), "child")
        self._value_box(self._grid_rect(columns, rows, 16, 1, 2, 1), "class")
        self._value_box(self._grid_rect(columns, rows, 20, 1, 4, 1), "fare", fare=True)

        # Row 3 Values
        self._value_box(self._grid_rect(columns, rows, 4, 2, 6, 1), "train_type")
        self._value_box(self._grid_rect(columns, rows, 13, 2, 5, 1), "pay_mode")

        # QR Code Card (spans rows 3 and 4)
        qr_rect = self._grid_rect(columns, rows, 18, 2, 6, 2)
        self._rounded(qr_rect, (248, 250, 252), max(5, qr_rect.height // 12))
        pygame.draw.rect(self.screen, (203, 213, 225), qr_rect, width=2, border_radius=max(5, qr_rect.height // 12))
        qr_label = "Scan to Pay via UPI" if self.qr_surface else "UPI / QR Code"
        self._text(qr_label, pygame.Rect(qr_rect.x, qr_rect.y + 6, qr_rect.width, qr_rect.height // 7), max(9, qr_rect.height // 11), MUTED, bold=True)
        if self.qr_surface:
            qr_size = min(qr_rect.width - 20, qr_rect.height - qr_rect.height // 5 - 16)
            scaled_qr = pygame.transform.scale(self.qr_surface, (qr_size, qr_size))
            qr_card = scaled_qr.get_rect(center=(qr_rect.centerx, qr_rect.centery + qr_rect.height // 12))
            pygame.draw.rect(self.screen, SURFACE, qr_card.inflate(8, 8), border_radius=4)
            self.screen.blit(scaled_qr, qr_card)
        else:
            icon_size = max(16, min(qr_rect.width, qr_rect.height) // 3)
            icon = pygame.Rect(qr_rect.centerx - icon_size // 2, qr_rect.centery - icon_size // 6, icon_size, icon_size)
            stroke = max(1, icon_size // 12)
            marker = max(5, icon_size * 2 // 5)
            for left, top in ((icon.left, icon.top), (icon.right - marker, icon.top), (icon.left, icon.bottom - marker)):
                pygame.draw.rect(self.screen, MUTED, pygame.Rect(left, top, marker, marker), width=stroke)
            pygame.draw.rect(self.screen, MUTED, pygame.Rect(icon.right - marker, icon.bottom - marker, marker // 2, marker // 2))

        # Row 4 Values
        self._value_box(self._grid_rect(columns, rows, 4, 3, 6, 1), "transaction_type")
        via_or_refund_key = "refund" if self.values.get("refund") else "via"
        self._value_box(self._grid_rect(columns, rows, 13, 3, 5, 1), via_or_refund_key, fare=bool(self.values.get("refund")))

        # Row 5 Values
        self._value_box(self._grid_rect(columns, rows, 4, 4, 14, 1), "operator")
        zone_rect = self._grid_rect(columns, rows, 18, 4, 6, 1)
        self._rounded(zone_rect, MAROON, max(5, zone_rect.height // 8))
        self._text(str(self.values.get("zone", self.settings.get("zone", ""))), pygame.Rect(zone_rect.x, zone_rect.y + 4, zone_rect.width, zone_rect.height // 2), max(8, zone_rect.height // 7), GOLD_LIGHT, bold=True)
        self._text(str(self.values.get("station", self.settings.get("station", ""))), pygame.Rect(zone_rect.x, zone_rect.centery - 2, zone_rect.width, zone_rect.height // 2), max(10, zone_rect.height // 4), SURFACE, bold=True)

        # Dynamic Marquee (using cached text surface):
        marquee = str(self.settings.get("message", ""))
        if marquee:
            cache_key = (marquee, int(21 * scale))
            if self._cached_marquee_key != cache_key:
                font = self.fonts.get(max(10, int(21 * scale)), bold=True, indic=True)
                self._cached_marquee_surf = font.render(marquee, True, GOLD)
                self._cached_marquee_key = cache_key
            if self._cached_marquee_surf:
                travel = width + self._cached_marquee_surf.get_width()
                x = width - int((time.monotonic() * max(25, 70 * scale)) % travel)
                marquee_rect = pygame.Rect(0, height - marquee_height, width, marquee_height)
                previous_clip = self.screen.get_clip()
                self.screen.set_clip(marquee_rect)
                self.screen.blit(self._cached_marquee_surf, (x, marquee_rect.centery - self._cached_marquee_surf.get_height() // 2))
                self.screen.set_clip(previous_clip)

        if self.help_open:
            self._draw_help_overlay()
        elif self.settings_open:
            self._draw_settings_overlay()

    def _draw_help_overlay(self) -> None:
        width, height = self.screen.get_size()
        dim = pygame.Surface((width, height), pygame.SRCALPHA)
        dim.fill((0, 0, 0, 180))
        self.screen.blit(dim, (0, 0))
        panel_width = min(int(width * 0.72), 680)
        panel_height = min(int(height * 0.74), 450)
        panel = pygame.Rect((width - panel_width) // 2, (height - panel_height) // 2, panel_width, panel_height)
        self._rounded(panel, SURFACE, 12)
        pygame.draw.rect(self.screen, MAROON, panel, width=3, border_radius=12)
        self._text("Keyboard Shortcuts & Help", pygame.Rect(panel.x + 20, panel.y + 16, panel.width - 40, 32), 22, MAROON, bold=True, center=False)
        shortcuts = [
            ("Ctrl + A", "Open On-Screen Admin Settings"),
            ("Ctrl + S / F10", "Save Settings"),
            ("Ctrl + D", "Toggle Demo Mode (Simulate UTS Tickets)"),
            ("Ctrl + Shift + C", "Clear Current Ticket Display"),
            ("Ctrl + R / F5", "Force Refresh & Reconnect Serial Port"),
            ("F11", "Toggle Fullscreen / Windowed Mode"),
            ("F1 / H", "Toggle This Help Screen"),
            ("Ctrl + Q", "Quit Application"),
        ]
        y = panel.y + 60
        for key, desc in shortcuts:
            self._text(key, pygame.Rect(panel.x + 24, y, 170, 26), 14, MAROON, bold=True, center=False)
            self._text(desc, pygame.Rect(panel.x + 200, y, panel.width - 220, 26), 14, VALUE_BG, center=False)
            y += 32
        self._text("Press F1, H, Space or Esc to close help", pygame.Rect(panel.x + 20, panel.bottom - 36, panel.width - 40, 24), 12, MUTED, center=True)

    def _draw_settings_overlay(self) -> None:
        width, height = self.screen.get_size()
        dim = pygame.Surface((width, height), pygame.SRCALPHA)
        dim.fill((0, 0, 0, 165))
        self.screen.blit(dim, (0, 0))
        panel_width = min(int(width * 0.85), 920)
        panel_height = min(int(height * 0.90), 720)
        panel = pygame.Rect((width - panel_width) // 2, (height - panel_height) // 2, panel_width, panel_height)
        self._rounded(panel, SURFACE, 14)
        pygame.draw.rect(self.screen, MAROON, panel, width=3, border_radius=14)
        self._text("Admin Configuration", pygame.Rect(panel.x + 20, panel.y + 12, panel.width - 40, 32), 24, MAROON, bold=True, center=False)
        self._text("Tab/↑/↓: Choose field   Enter: Next field   Ctrl+S/F10: Save   Esc: Cancel   Ctrl+U: Clear", pygame.Rect(panel.x + 20, panel.y + 46, panel.width - 40, 24), 12, MUTED, center=False)
        row_height = max(28, min(48, (panel.height - 110) // len(self.settings_fields)))
        blink_cursor = "|" if int(time.monotonic() * 2) % 2 == 0 else ""
        for index, (key, label) in enumerate(self.settings_fields):
            y = panel.y + 76 + index * row_height
            selected = index == self.settings_index
            row = pygame.Rect(panel.x + 18, y, panel.width - 36, row_height - 4)
            self._rounded(row, (254, 243, 199) if selected else (248, 250, 252), 5)
            if selected:
                pygame.draw.rect(self.screen, GOLD, row, width=2, border_radius=5)
            self._text(label, pygame.Rect(row.x + 10, row.y, row.width * 2 // 5, row.height), 14, MAROON, bold=True, center=False)
            val_str = str(self.draft_settings.get(key, ""))
            if selected:
                val_str += blink_cursor
            self._text(val_str, pygame.Rect(row.x + row.width * 2 // 5, row.y, row.width * 3 // 5 - 10, row.height), 14, VALUE_BG, center=False)

    def run(self, demo: bool = False) -> int:
        if not demo:
            self.start_serial()
        else:
            self.demo_mode = True
            self.serial_connected = True
            self.serial_message = "Demo mode active"
            self._feed_demo_data()
        try:
            while self.running:
                for event in pygame.event.get():
                    self._handle_event(event)
                self._handle_serial_events()
                self._draw_board()
                pygame.display.flip()
                target_fps = clamp(int(self.settings.get("displayFps", 12)), 4, 30)
                self.clock.tick(target_fps)
        finally:
            self.stop_serial()
            pygame.quit()
        return 0

    def _feed_demo_data(self) -> None:
        data = (
            "$0126NDLS:NEW DELHI:नई दिल्ली:^"
            "$0226HYD:HYDERABAD:हैदराबाद:^"
            "$03406:^$040412:^$050402:^$060401:^$0703S:^"
            "$080745604:^$0904II:^$1205JRNY:^"
            "$1531SHASHI KUMAR:ABCDEF9999:350:9:^"
            "$1726CNB:KANPUR CENTRAL:कानपुर:^"
            "$2118UPI / PhonePe:^"
            "$2240upi://pay?pa=irctc@sbi&pn=IR_UTS&am=456&cu=INR:^"
        )
        for message in self.stream.feed(data):
            self.apply_message(message, persist_operator=False)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Lightweight UTS fare display for Raspberry Pi Zero W")
    parser.add_argument("--config", type=Path, default=default_config_path(), help="Path to JSON configuration")
    parser.add_argument("--windowed", action="store_true", help="Run in a resizable window for development")
    parser.add_argument("--demo", action="store_true", help="Show sample data without opening a serial port")
    parser.add_argument("--fps", type=int, default=None, help="Override display refresh FPS (4-30)")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        settings = load_config(args.config)
    except RuntimeError as exc:
        print(exc, file=sys.stderr)
        return 2
    if args.fps is not None:
        settings["displayFps"] = clamp(args.fps, 4, 30)
    app = FareDisplay(settings, args.config, args.windowed)
    return app.run(demo=args.demo or bool(settings.get("demoMode")))


if __name__ == "__main__":
    raise SystemExit(main())
