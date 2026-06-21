const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { SerialPort } = require("serialport");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { processData, mapPRSFields } = require("./utils");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 5000;
const isElectron = process.versions.hasOwnProperty('electron');
const userDataPath = isElectron ? require('electron').app.getPath('userData') : __dirname;
const CONFIG_PATH = path.join(userDataPath, "config.json");

// Serve static frontend files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

let settings = {};
let serialPort = null;
let serialPortData = "";
let reconnectTimer = null;
const reconnectDelay = 3000;

// Load settings
function loadSettings() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf8");
      settings = JSON.parse(data);
    } else {
      settings = {
        port: "COM3",
        baudRate: 9600,
        zone: "INDIAN RAILWAY",
        station: "NEW DELHI",
        operator: "ADMIN",
        windowNo: "101",
        shiftNo: "1",
        message: "Welcome to Indian Railways",
      };
      saveSettings();
    }
  } catch (err) {
    console.error("Error loading settings:", err);
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error("Error saving settings:", err);
  }
}

// Serial Port Handling
function initializeSerialPort() {
  if (serialPort && serialPort.isOpen) {
    serialPort.close(() => openSerialPort());
  } else {
    openSerialPort();
  }
}

function openSerialPort() {
  const portName = settings.port || "COM12";
  const baudRate = Number(settings.baudRate) || 9600;

  console.log(
    `Attempting to open serial port: ${portName} at ${baudRate} baud`,
  );

  try {
    serialPort = new SerialPort({
      path: portName,
      baudRate: baudRate,
      autoOpen: false,
    });

    serialPort.open((err) => {
      if (err) {
        console.error(`Error opening ${portName}:`, err.message);
        broadcast({ type: "serial-error", message: err.message });
        scheduleReconnect();
        return;
      }
      console.log(`Serial Port ${portName} is Open`);
      broadcast({ type: "serial-status", status: "connected", port: portName });
      setupSerialListeners();
    });
  } catch (err) {
    console.error("Serial port initialization error:", err.message);
    scheduleReconnect();
  }
}

function setupSerialListeners() {
  if (!serialPort) return;
  console.log("Setting up serial port listeners...");

 serialPort.on("data", (raw) => {
    const rawString = raw.toString();
    serialPortData += rawString;

    // Check for PRS
    if (serialPortData.includes("thPRS")) {
        const prsIndex = serialPortData.indexOf("thPRS");
        const qIndex = serialPortData.indexOf("Q", prsIndex);
        
        if (qIndex !== -1) {
            // Find end of length digits
            let pos = qIndex + 1;
            let lengthStr = "";
            while (pos < serialPortData.length && serialPortData[pos] >= '0' && serialPortData[pos] <= '9') {
                lengthStr += serialPortData[pos];
                pos++;
            }
            
            if (lengthStr !== "") {
                const dataLength = parseInt(lengthStr, 10);
                const totalNeeded = pos + dataLength;
                
                if (serialPortData.length >= totalNeeded) {
                    const fullFrame = Buffer.from(serialPortData.slice(prsIndex, totalNeeded));
                    const subFunction = serialPortData[prsIndex + 9];

                    if (subFunction === "1") {
                        const numericParsed = parsePRSBuffer(fullFrame);
                        const enriched = mapPRSFields(numericParsed);
                        console.log("PRS Journey Details Enriched:", enriched);
                        broadcast({ type: "serial-data", data: enriched });
                    } else if (subFunction === "2") {
                        const qrUrl = serialPortData.slice(pos, totalNeeded).trim();
                        broadcast({ type: "serial-data", data: { protocol: "PRS", type: "qr_code", qr_url: qrUrl } });
                    } else if (subFunction === "3") {
                        const message = serialPortData.slice(pos, totalNeeded).trim();
                        broadcast({ type: "serial-data", data: { protocol: "PRS", type: "payment_status", message: message } });
                    }
                    
                    serialPortData = serialPortData.slice(totalNeeded);
                }
            }
        }
    } else if (serialPortData.includes("$") && serialPortData.includes("^")) {
        // UTS Data
        const result = processData(serialPortData);
        if (result && result.parsed) {
            console.log("UTS Parsed:", result.parsed);
            if (result.parsed.clear_display_device) {
                broadcast({ type: "clear-screen" });
            } else {
                broadcast({ type: "serial-data", data: result.parsed });
            }
            
            const lastIdx = serialPortData.lastIndexOf("^");
            serialPortData = serialPortData.slice(lastIdx + 1);
        }
    }

    // Safety: prevent buffer from growing indefinitely
    if (serialPortData.length > 10240) {
        serialPortData = "";
    }
});

function parsePRSBuffer(buffer) {
    const result = {};

    // Find Q
    const qIndex = buffer.indexOf(0x51); // 'Q'
    if (qIndex === -1) return result;

    let pos = qIndex + 1;
    let lengthStr = "";

    // Extract length digits until we hit '$' or end of digits
    while (pos < buffer.length && buffer[pos] >= 0x30 && buffer[pos] <= 0x39) {
        lengthStr += String.fromCharCode(buffer[pos]);
        pos++;
    }

    const dataLength = parseInt(lengthStr, 10);
    if (isNaN(dataLength)) return result;

    console.log(`[DEBUG] PRS DataLength: ${dataLength} at pos: ${pos}`);

    // The data block starts immediately after the length digits
    const dataBlock = buffer.slice(pos, pos + dataLength);
    console.log(`[DEBUG] PRS DataBlock: "${dataBlock.toString()}"`);
    
    let blockPos = 0;
    let currentField = null;
    let currentValue = "";

    while (blockPos < dataBlock.length) {
        const byte = dataBlock[blockPos];

        // ASCII field tags like $06:
        if (
            byte === 0x24 && // $
            blockPos + 3 < dataBlock.length &&
            dataBlock[blockPos + 1] >= 0x30 &&
            dataBlock[blockPos + 1] <= 0x39 &&
            dataBlock[blockPos + 2] >= 0x30 &&
            dataBlock[blockPos + 2] <= 0x39 &&
            dataBlock[blockPos + 3] === 0x3A // :
        ) {
            if (currentField !== null) {
                console.log(`[TRACE] Field ${currentField}: "${currentValue.trim()}"`);
                result[currentField] = currentValue.trim();
            }
            currentField = String.fromCharCode(dataBlock[blockPos + 1], dataBlock[blockPos + 2]);
            currentValue = "";
            blockPos += 4;
            continue;
        }

        // Binary field tags: Byte followed by ':' (e.g. 0x01 0x3A)
        if (byte >= 0x01 && byte <= 0x3F && dataBlock[blockPos + 1] === 0x3A) {
            if (currentField !== null) {
                console.log(`[TRACE] Field ${currentField}: "${currentValue.trim()}"`);
                result[currentField] = currentValue.trim();
            }
            currentField = byte.toString().padStart(2, "0");
            currentValue = "";
            blockPos += 2;
            continue;
        }

        currentValue += String.fromCharCode(byte);
        blockPos++;
    }

    if (currentField !== null) {
        result[currentField] = currentValue.trim();
    }

    return result;
}

  serialPort.on("error", (err) => {
    console.error("Serial port error:", err.message);
    broadcast({ type: "serial-error", message: err.message });
    scheduleReconnect();
  });

  serialPort.on("close", () => {
    console.warn("Serial port closed.");
    broadcast({ type: "serial-status", status: "disconnected" });
    serialPortData = "";
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSerialPort();
  }, reconnectDelay);
}

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// API Endpoints
app.get("/api/settings", (req, res) => {
  res.json(settings);
});

app.post("/api/settings", (req, res) => {
  const newSettings = req.body;
  const portChanged =
    newSettings.port !== settings.port ||
    newSettings.baudRate !== settings.baudRate;

  settings = { ...settings, ...newSettings };
  saveSettings();

  if (portChanged) {
    console.log("Settings changed, re-initializing serial port...");
    initializeSerialPort();
  }

  broadcast({ type: "settings-updated", settings });
  res.json({ success: true, settings });
});

// WebSocket connection
wss.on("connection", (ws) => {
  console.log("New WebSocket client connected");
  ws.send(JSON.stringify({ type: "settings-data", settings }));

  if (serialPort && serialPort.isOpen) {
    ws.send(
      JSON.stringify({
        type: "serial-status",
        status: "connected",
        port: settings.port,
      }),
    );
  } else {
    ws.send(JSON.stringify({ type: "serial-status", status: "disconnected" }));
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  loadSettings();
  initializeSerialPort();
});
