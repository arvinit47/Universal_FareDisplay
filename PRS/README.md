# Railway Ticket Console - Electron App

This is an Electron-based desktop application version of the Railway Ticket Console (Rail-v2).

## Features
- Real-time ticket information display (UTS/PRS).
- Web Serial API integration for hardware communication.
- Automatic Serial Port selection (picks the first available port).
- Admin Settings (Ctrl+A) and Fullscreen mode (F).
- Developer Console for simulation.

## Prerequisites
- [Node.js](https://nodejs.org/) (v14 or higher recommended)

## Installation
1. Navigate to the `rail-electron` directory:
   ```bash
   cd rail-electron
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the App
To start the application in development mode:
```bash
npm start
```

## Configuration
- **Settings:** Press `Ctrl + A` while the app is focused to open the Admin Settings.
- **Fullscreen:** Press `F` to toggle fullscreen mode.
- **Developer Console:** Accessible via the UI or by pressing `Ctrl + Shift + D` (if implemented in the original source).

## Notes
- This application uses the Web Serial API. Ensure your hardware is connected before starting the app or clicking "CONNECT".
- The Electron main process is configured to automatically grant serial permissions.
