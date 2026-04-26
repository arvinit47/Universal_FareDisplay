const { ipcMain } = require("electron");
const Settings = require("../models/settings");

ipcMain.handle("get-ports", async () => {
  return await SerialPort.list();
});

ipcMain.on("change-port", (event, portInfo) => {
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }
  initializeSerialPort(portInfo.path, portInfo.baudRate);
});

ipcMain.handle("save-settings", async (event, data) => {
  try {
    const settingsObj = new Settings(data);
    const result = await settingsObj.save();
    return { success: true, message: "Settings saved successfully.", result };
  } catch (error) {
    return { success: false, message: "Error saving settings", error };
  }
});
