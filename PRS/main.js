const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Backend server required on app ready

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js')
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
        win.webContents.on('console-message', (event, level, message, line, sourceId) => {
            console.log(`[RENDERER CONSOLE] Level: ${level}, Message: ${message}, Line: ${line}, Source: ${sourceId}`);
        });
    } else {
        console.error('Frontend build not found at:', indexPath);
        // Fallback or error message
    }

    // Toggle fullscreen on 'F' key is handled by the React app's useEffect
}

app.whenReady().then(() => {
    // Start the backend server logic
    try {
        require('./backend/server.js');
    } catch (err) {
        console.error('Failed to start backend server:', err);
    }

    const { Menu } = require('electron');
    Menu.setApplicationMenu(null);

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
