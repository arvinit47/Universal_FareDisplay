const {
  app,
  BrowserWindow,
  globalShortcut,
  dialog,
  ipcMain,
} = require("electron");
const path = require("path");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { processData } = require("./utils_new");
require("./controllers/electron");
const Settings = require("./models/settings");
const { testData1, testData, testData2, testData3 } = require("./test");

let mainWindow;
let serialPort;
let parser;
let serialPortData = "";
let currentPage = "index";
let settingsData = null;


function createWindow() {
  mainWindow = new BrowserWindow({
    // width: 800,
    // height: 600,
    fullscreen: settingsData.fullscreen,
    kiosk: settingsData.kiosk,
    frame: settingsData.frame,
    alwaysOnTop: settingsData.alwaysOnTop,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "views", "index3.html"));
  //fOR ADMIN SETTING
  // after mainWindow.loadFile(...)
  mainWindow.loadFile(path.join(__dirname, "views", "index3.html"));

  // send settings to renderer once the page finishes loading
  mainWindow.webContents.on("did-finish-load", () => {
    // settingsData is set by updateSettings() before createWindow()
    mainWindow.webContents.send("settings-data", settingsData || {});
  });

  if (settingsData.openDevTools) mainWindow.webContents.openDevTools();

  initializeSerialPort();
  registerQuitShortcut();

  // simulateDataTransmission1(testData3);

  // mainWindow.on("closed", () => {
  //   mainWindow = null;
  // });

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (serialPort && serialPort.isOpen) {
      serialPort.close((err) => {
        if (err) console.error("Error closing port:", err.message);
        serialPort = null;
      });
    }
  });
  globalShortcut.register("CommandOrControl+Q", () => {
    app.quit();
  });
}

function registerQuitShortcut() {
  globalShortcut.unregisterAll();

  const ret = globalShortcut.register("CommandOrControl+Q", () => {
    app.quit();
  });

  globalShortcut.register("CommandOrControl+A", () => {
    if (currentPage === "index") {
      openAdminSettings();
    }
  });

  globalShortcut.register("CommandOrControl+SHIFT+C", () => {
    if (currentPage === "index") {
      mainWindow.webContents.send("clear-screen", "clear");
      serialPortData = "";
    }
  });

  globalShortcut.register("CommandOrControl+Shift+D", () => {
    openDeveloperSettings();
  });

  if (!ret) {
    console.error("Failed to register quit shortcut");
  }
}

// function initializeSerialPort() {
//   if (serialPort) {
//     serialPort.close((err) => {
//       if (err) console.error("Error closing previous port:", err.message);
//       createNewSerialPort();
//     });
//   } else {
//     createNewSerialPort();
//   }
// }

// function createNewSerialPort() {
//   const portName = settingsData ? `${settingsData.port}` : "/dev/serial0";
//   const baudRate = settingsData ? Number(settingsData.baudRate) : 9600;

//   try {
//     serialPort = new SerialPort({
//       path: portName,
//       baudRate: baudRate,
//       autoOpen: false,
//     });

//     const openPort = (retries = 3) => {
//       serialPort.open((err) => {
//         if (err) {
//           if (retries > 0) {
//             console.log(`Retrying... ${retries} attempts left`);
//             setTimeout(() => openPort(retries - 1), 1000);
//           } else {
//             console.error("Final error opening port:", err.message);
//             mainWindow.webContents.send("serial-error", err.message);
//           }
//           return;
//         }
//         console.log(`Serial Port ${portName} is Open`);
//       });
//     };

//     openPort();
//   } catch (err) {
//     console.error("Serial port initialization error:", err.message);
//   }
// }

// function initializeSerialPort() {
//   const portName = settingsData ? `${settingsData.port}` : "/dev/serial0";
//   const baudRate = settingsData ? Number(settingsData.baudRate) : 9600;
//   // const portName = "/dev/pts/2";
//   // const portName = "/dev/pts/3";

//   try {
//     serialPort = new SerialPort({
//       path: portName,
//       baudRate: baudRate,
//       autoOpen: false,
//     });

//     serialPort.open((err) => {
//       if (err) {
//         console.error("Error opening port:", err.message);
//         mainWindow.webContents.send("serial-error", err.message);
//         return;
//       }
//       console.log(`Serial Port ${portName} is Open`);
//     });

//     // in main.js - ensure serialPortData, mainWindow are in scope
// serialPort.on("data", (raw) => {
//   try {
//     const hex = raw.toString("hex");
//     const ascii = raw.toString();
//     console.log("Raw HEX:", hex);
//     console.log("Raw ASCII:", ascii);

//     // Special clear control (retain your existing logic)
//     if (ascii.slice(1, 3) === "13") {
//       if (mainWindow) mainWindow.webContents.send("clear-screen", "clear");
//       serialPortData = "";
//       return;
//     }

//     // Append or re-sync on $13 marker as you did
//     if (ascii.includes("$13")) {
//       const idx = ascii.indexOf("$13");
//       serialPortData = ascii.slice(idx);
//     } else {
//       serialPortData += ascii;
//     }

//     // Protect buffer size
//     const MAX_BUFFER = 20 * 1024; // 20 KB, tune if needed
//     if (serialPortData.length > MAX_BUFFER) {
//       console.warn("serialPortData overflow — clearing buffer");
//       if (mainWindow) mainWindow.webContents.send("serial-error", "buffer-overflow-cleared");
//       serialPortData = "";
//       return;
//     }

//     // Only attempt parse when we have at least one complete frame
//     if (!serialPortData.includes("^")) {
//       return; // wait for more data
//     }

//     // Call processData and handle its structured result
//     let result;
//     try {
//       result = processData(serialPortData);
//     } catch (procErr) {
//       console.error("processData threw unexpectedly:", procErr);
//       if (mainWindow) mainWindow.webContents.send("serial-error", `processData-exception: ${procErr.message || procErr}`);
//       // Clear buffer to recover (optional)
//       serialPortData = "";
//       return;
//     }

//     // result is { parsed, errors } (or fallback object)
//     const parsed = result.parsed ?? (result.parsed === undefined ? (result || {}) : result.parsed);
//     const errors = result.errors ?? null;

//     if (errors) {
//       console.warn("parse errors:", errors);
//       if (mainWindow) mainWindow.webContents.send("serial-parse-errors", errors);
//     }

//     // send parsed if non-empty
//     if (parsed && Object.keys(parsed).length > 0) {
//       if (mainWindow) mainWindow.webContents.send("serial-data", parsed);
//       // remove processed frames from buffer up to last '^'
//       const lastIdx = serialPortData.lastIndexOf("^");
//       serialPortData = serialPortData.slice(lastIdx + 1);
//     } else {
//       // nothing parsed — keep buffer or optionally clear small junk
//       // serialPortData = ""; // optional policy
//     }
//   } catch (handlerErr) {
//     // This top-level catch prevents the 'data' event handler from dying
//     console.error("Unhandled error in serial data handler:", handlerErr);
//     if (mainWindow) mainWindow.webContents.send("serial-error", handlerErr.message || String(handlerErr));
//     // Optionally clear buffer to recover
//     // serialPortData = "";
//   }
// });

// process.on("uncaughtException", (err) => {
//   console.error("UNCAUGHT EXCEPTION:", err);
//   // optionally: write to a file or notify renderer
// });

// process.on("unhandledRejection", (reason) => {
//   console.error("UNHANDLED PROMISE REJECTION:", reason);
// });


//     // parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }));

//     // parser.on("data", (data) => {
//     //   console.log("data: ", data);
//     //   if (data.slice(1, 3) == "13") {
//     //     mainWindow.webContents.send("clear-screen", "clear");
//     //     serialPortData = "";
//     //   } else {
//     //     serialPortData += data;
//     //     if (serialPortData) {
//     //       mainWindow.webContents.send(
//     //         "serial-data",
//     //         processData(serialPortData)
//     //       );
//     //     }
//     //   }
//     // });

//     serialPort.on("error", (err) => {
//       console.error("Serial port error:", err.message);
//       if (mainWindow) {
//         mainWindow.webContents.send("serial-error", err.message);
//       }
//     });
//   } catch (err) {
//     console.error("Serial port initialization error:", err.message);
//   }
// }

function initializeSerialPort() {
  const portName = settingsData ? `${settingsData.port}` : "/dev/serial0";
  const baudRate = settingsData ? Number(settingsData.baudRate) : 9600;

  openSerialPort(portName, baudRate);
}

function openSerialPort(portName, baudRate) {
  try {
    serialPort = new SerialPort({
      path: portName,
      baudRate: baudRate,
      autoOpen: false,
    });

    serialPort.open((err) => {
      if (err) {
        console.error(`❌ Error opening ${portName}:`, err.message);
        mainWindow?.webContents.send("serial-error", err.message);
        scheduleReconnect(portName, baudRate);
        return;
      }
      console.log(`✅ Serial Port ${portName} is Open`);
      setupSerialListeners(portName, baudRate);
    });
  } catch (err) {
    console.error("❌ Serial port initialization error:", err.message);
    scheduleReconnect(portName, baudRate);
  }
}

function setupSerialListeners(portName, baudRate) {
  if (!serialPort) return;

  serialPort.on("data", (raw) => {
    try {
      const ascii = raw.toString();
      console.log("Raw ASCII:", ascii);

      if (ascii.slice(1, 3) === "13") {
        mainWindow?.webContents.send("clear-screen", "clear");
        serialPortData = "";
        return;
      }

      if (ascii.includes("$13")) {
        const idx = ascii.indexOf("$13");
        serialPortData = ascii.slice(idx);
      } else {
        serialPortData += ascii;
      }

      if (serialPortData.length > 20 * 1024) {
        console.warn("⚠️ Buffer overflow, clearing");
        mainWindow?.webContents.send("serial-error", "buffer-overflow-cleared");
        serialPortData = "";
        return;
      }

      if (!serialPortData.includes("^")) return;

      let result = {};
      try {
        result = processData(serialPortData);
      } catch (procErr) {
        console.error("processData error:", procErr);
        mainWindow?.webContents.send("serial-error", procErr.message);
        serialPortData = "";
        return;
      }

      const parsed = result.parsed ?? result;
      const errors = result.errors ?? null;

      if (errors) {
        console.warn("parse errors:", errors);
        mainWindow?.webContents.send("serial-parse-errors", errors);
      }

      if (parsed && Object.keys(parsed).length > 0) {
        mainWindow?.webContents.send("serial-data", parsed);
        const lastIdx = serialPortData.lastIndexOf("^");
        serialPortData = serialPortData.slice(lastIdx + 1);
      }
    } catch (err) {
      console.error("Unhandled error in serial data handler:", err);
      mainWindow?.webContents.send("serial-error", err.message);
    }
  });

  serialPort.on("error", (err) => {
    console.error("❌ Serial port error:", err.message);
    mainWindow?.webContents.send("serial-error", err.message);
    scheduleReconnect(portName, baudRate);
  });

  serialPort.on("close", () => {
    console.warn("⚠️ Serial port closed. Will attempt reconnect...");
    scheduleReconnect(portName, baudRate);
  });
}

function scheduleReconnect(portName, baudRate) {
  if (reconnectTimer) return; // already waiting
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    console.log(`🔄 Retrying to open ${portName}...`);
    openSerialPort(portName, baudRate);
  }, reconnectDelay);
}


async function updateSettings() {
  const data = await Settings.fetchData();
  settingsData = data;
  return data;
}

async function openAdminSettings() {
  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Admin Settings",
    message: "Open Admin Settings",
    buttons: ["Yes", "No"],
  });

  if (result.response === 0 && mainWindow) {
    currentPage = "settings";
    mainWindow
      .loadFile(path.join(__dirname, "views", "settings.html"))
      .then(() => {
        mainWindow.webContents.send("settings-data", settingsData);
      });
  }
}

// async function openAdminSettings() {
//   const focusedWindow = BrowserWindow.getFocusedWindow();
//   if (!focusedWindow) return;

//   const result = await dialog.showMessageBox(focusedWindow, {
//     type: "info",
//     title: "Admin Settings",
//     message: "Open Admin Settings",
//     buttons: ["Yes", "No"],
//   });

//   if (result.response === 0) {
//     currentPage = "settings";
//     focusedWindow
//       .loadFile(path.join(__dirname, "views", "settings.html"))
//       .then(() => {
//         focusedWindow.webContents.send("settings-data", settingsData);
//       });
//   }
// }

async function openDeveloperSettings() {
  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Developer Settings",
    message: "Open Developer Settings",
    buttons: ["Yes", "No"],
  });

  if (result.response === 0 && mainWindow) {
    currentPage = "developer";
    mainWindow
      .loadFile(path.join(__dirname, "views", "developer.html"))
      .then(() => {
        mainWindow.webContents.send("settings-data", settingsData);
      });
  }
}

ipcMain.on("change-screen", async (event, data) => {
  if (data === "index") {
    await updateSettings();
    currentPage = "index";

    if (mainWindow) {
      mainWindow.removeAllListeners("closed");

      mainWindow.on("closed", () => {
        mainWindow = null;
        serialPort.close();
        createWindow();
      });
      mainWindow.close();
    } else {
      createWindow();
    }
  }
});

// ipcMain.on("change-screen", async (event, data) => {
//   if (data === "index") {
//     await updateSettings();
//     currentPage = "index";

//     if (mainWindow) {
//       mainWindow.removeAllListeners("closed");

//       mainWindow.on("closed", () => {
//         mainWindow = null;
//         serialPort = null;
//         createWindow();
//       });

//       mainWindow.close();
//     } else {
//       createWindow();
//     }
//   }
// });

function simulateDataTransmission(data) {
  mainWindow.webContents.send("serial-data", data);
}

function simulateDataTransmission1(data) {
  data.forEach((each, i) => {
    setTimeout(function () {
      if (each.slice(1, 3) == "13") {
        mainWindow.webContents.send("clear-screen", "clear");
        serialPortData = "";
      } else {
        serialPortData += each;
        if (serialPortData) {
          mainWindow.webContents.send(
            "serial-data",
            processData(serialPortData)
          );
        }
      }
    }, i * 1000);
  });
}

async function initializeApp() {
  await updateSettings();
  createWindow();
}
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("disable-accelerated-2d-canvas");
app.commandLine.appendSwitch("disable-accelerated-video-decode");
app.disableHardwareAcceleration();
app.whenReady().then(initializeApp);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
