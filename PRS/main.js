const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Start the backend server logic
try {
    require('./backend/server.js');
} catch (err) {
    console.error('Failed to start backend server:', err);
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // Preload script if needed, but the current frontend uses WebSockets
            // which works fine in a standard browser environment.
        },
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'frontend', 'images', 'indian-railways-logo.png')
    });

    // Load the built frontend
    const indexPath = path.join(__dirname, 'frontend', 'index.html');
    if (fs.existsSync(indexPath)) {
        win.loadFile(indexPath);
        win.maximize();
        // win.webContents.openDevTools(); // Uncomment to debug
    } else {
        console.error('Frontend build not found at:', indexPath);
        // Fallback or error message
    }

    // Toggle fullscreen on 'F' key is handled by the React app's useEffect
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
