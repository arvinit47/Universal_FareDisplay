const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onSerialData: (callback) => ipcRenderer.on("serial-data", callback),
  onSerialError: (callback) => ipcRenderer.on("serial-error", callback),
  getPorts: () => ipcRenderer.invoke("get-ports"),
  changePort: (portInfo) => ipcRenderer.send("change-port", portInfo),
  onClearScreen: (callback) => ipcRenderer.on("clear-screen", callback),
  onSettingsData: (callback) => ipcRenderer.on("settings-data", callback),
  saveSettings: (data) => ipcRenderer.invoke("save-settings", data),
  changeScreen: (data) => ipcRenderer.send("change-screen", data),
});
