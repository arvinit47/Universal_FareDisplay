# Universal Fare Display

## Raspberry Pi Zero W edition

`pi_display` is a high-performance, lightweight production runtime for Raspberry Pi Zero W and other Linux/Windows platforms.
It uses Python, pygame/SDL2, and pyserial, running smoothly on the board's ARMv6 CPU and 512 MB RAM without Electron, Node.js, or Chromium overhead.

The application fully implements the Indian Railways UTS serial protocol (`$...^` frames), supporting fragmented frame reconstruction, automatic serial reconnect, bilingual English/Hindi station names, fare and routing fields, QR code payments, animated marquee, operator metadata sessions, and ticket cancellation/refund processing.

---

### Key Features & Enhancements

- **High-Efficiency Static Surface Caching**: The static board layout (header banner, card frames, static bilingual labels, and railway emblems) is pre-rendered to an off-screen surface. Only dynamic values and the marquee redraw each frame, reducing CPU usage on the Pi Zero W by >70%.
- **Cached Marquee Glyph Rasterization**: Eliminates font re-rasterization on every frame tick, providing buttery smooth ticker scrolling even on low-power single-core ARMv6 CPUs.
- **Operator Session Preservation**: The logged-in counter operator, terminal ID, window number, and shift number are preserved across ticket completions and clear-display (`$13`) commands.
- **Bilingual Hindi & English Rendering**: Full Rajbhasha compliance with automatic Hindi Devanagari font fallback (Noto Sans Devanagari, Nirmala, Mangal, Lohit).
- **Comprehensive Journey Display**:
  - Dedicated bilingual fields for **Adult** (`05`) and **Child** (`06`) passenger counts.
  - Dynamic **Via / Route** banner and multi-station tracking (codes `17`–`20`).
  - **Cancellation & Refund** frame support (code `14`) with refund amount and refund mode display.
- **Modern Train & Transaction Types**: Added support for Vande Bharat (`VDB`), Amrit Bharat (`AB`), Antyodaya (`ANT`), Garib Rath (`GR`), Humsafar (`HMF`), Special (`SPL`), Tejas (`TEJ`), Concession, Duplicate tickets, etc.
- **High-Contrast UPI QR Codes**: Sharp module rendering with proper quiet-zone padding for instant camera scanning.
- **Configurable Inactivity Auto-Clear**: Optional `autoClearSeconds` (default: 0 / off) to automatically clear stale passenger tickets after counter inactivity.
- **Decoupled Architecture**: Pure Python `FareState` model completely testable without GUI or hardware dependencies.

---

### Install on the Raspberry Pi

1. In Raspberry Pi Imager, choose **Raspberry Pi OS (Legacy, 32-bit) Lite** for the original Zero W. Enable SSH if administering remotely.
2. Copy this repository to `/opt/universal-fare-display`, then make the Pi user the owner:

   ```sh
   sudo mkdir -p /opt/universal-fare-display
   sudo chown -R pi:pi /opt/universal-fare-display
   cd /opt/universal-fare-display
   ```

3. Install pre-built Raspberry Pi OS packages (avoids expensive native compilation on the Zero W):

   ```sh
   sudo apt update
   sudo apt install --no-install-recommends python3-pygame python3-serial python3-qrcode fonts-noto-core
   sudo usermod -aG dialout,video,render pi
   ```

4. Configure the serial hardware: run `sudo raspi-config`, choose **Interface Options → Serial Port**, answer **No** to the login shell, then answer **Yes** to enabling serial hardware. Reboot after changing group or serial settings.
5. Edit [`config/rpi-config.json`](config/rpi-config.json). Use `/dev/serial0` for GPIO UART or `/dev/ttyUSB0` for USB-serial adapters.

> **Caution:** An RS-232 device must be connected through a USB-RS232 adapter or a MAX3232 level converter. Never attach RS-232 voltage levels directly to Raspberry Pi GPIO UART pins.

---

### Run and Verify

Run fullscreen with built-in realistic Indian Railways UTS demo data:

```sh
cd /opt/universal-fare-display
python3 -m pi_display.main --demo
```

Run in a development window (desktop/laptop):

```sh
python3 -m pi_display.main --windowed --demo
```

Run against live serial hardware:

```sh
python3 -m pi_display.main
```

---

### Keyboard Shortcuts & Controls

| Shortcut | Description |
| :--- | :--- |
| `F1` or `H` | Toggle interactive On-Screen Help Overlay |
| `Ctrl + A` | Open On-Screen Admin Configuration editor |
| `Ctrl + S` or `F10` | Save admin settings and reconfigure serial |
| `Esc` | Discard configuration changes / close dialogs |
| `Ctrl + D` | Toggle live simulated UTS Demo ticket data |
| `Ctrl + Shift + C` | Clear current passenger ticket |
| `Ctrl + R` or `F5` | Force screen refresh and trigger immediate serial reconnect |
| `F11` | Seamlessly toggle Fullscreen / Windowed mode at runtime |
| `Ctrl + Q` | Cleanly exit application |

---

### Automatic Startup at Boot

#### Option A: Raspberry Pi OS with Desktop (Recommended for Desktop installations)

In a desktop environment, use the standard XDG autostart launcher. This ensures the application starts seamlessly after the desktop GUI initializes:

```sh
# Copy the desktop launcher to user autostart
mkdir -p ~/.config/autostart
cp deploy/universal-fare-display.desktop ~/.config/autostart/
chmod +x ~/.config/autostart/universal-fare-display.desktop
```

#### Option B: Raspberry Pi OS Lite (Headless / Direct Framebuffer)

For Pi OS Lite without a desktop, use the included systemd service:

```sh
sudo cp deploy/universal-fare-display.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now universal-fare-display
sudo systemctl status universal-fare-display
```

The systemd service defaults to `SDL_VIDEODRIVER=kmsdrm`. If running on legacy framebuffer images without KMS, change it to `SDL_VIDEODRIVER=fbcon` in `/etc/systemd/system/universal-fare-display.service`.

---

### Desktop Screen Sleep & Power Management

On Raspberry Pi OS with Desktop, disable screen blanking so the passenger display runs 24/7 without going to sleep:

1. Run `sudo raspi-config`
2. Navigate to **Display Options → Screen Blanking**
3. Select **No** (Disable screen blanking) and reboot.

---

### Running Automated Tests

All state and protocol parsing tests run without any external hardware or GUI libraries:

```sh
python3 -m unittest discover -s tests -v
```
