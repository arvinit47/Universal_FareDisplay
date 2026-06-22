const { ipcRenderer } = require('electron');

console.log('Preload script loaded, exposing window.ipcRenderer for pure Electron IPC...');

// Expose ipcRenderer to the renderer process
window.ipcRenderer = ipcRenderer;

// Hide window.process from Axios just in case there are other libraries that check it
if (typeof window !== 'undefined' && window.process) {
  try {
    delete window.process;
  } catch (e) {
    try {
      Object.defineProperty(window, 'process', {
        get() { return undefined; },
        configurable: true
      });
    } catch (err) {
      console.warn('Failed to hide window.process:', err);
    }
  }
}
