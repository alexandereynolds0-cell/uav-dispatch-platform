/**
 * UAV Dispatch Platform - Electron Desktop Client
 * 
 * This Electron app wraps the UAV Dispatch Platform web interface
 * as a native Windows desktop application for easy management.
 */

const { app, BrowserWindow, Menu, shell, dialog, ipcMain, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// ── App configuration ────────────────────────────────────────────────────────

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return {
    serverUrl: 'http://localhost:3000',
    windowWidth: 1280,
    windowHeight: 800,
  };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

let config = loadConfig();
let mainWindow = null;
let tray = null;

// ── Window creation ──────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: config.windowWidth || 1280,
    height: config.windowHeight || 800,
    minWidth: 900,
    minHeight: 600,
    title: 'UAV Dispatch Platform - Management Console',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Allow loading from configured server
    },
    show: false, // Don't show until ready
    backgroundColor: '#1a1a2e',
  });

  // Save window size on resize
  mainWindow.on('resize', () => {
    const [w, h] = mainWindow.getSize();
    config.windowWidth = w;
    config.windowHeight = h;
    saveConfig(config);
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the platform
  loadPlatform();

  // Handle close to tray
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

function loadPlatform() {
  const serverUrl = config.serverUrl || 'http://localhost:3000';
  
  // Show loading page first
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #1a1a2e;
          color: #eee;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          gap: 20px;
        }
        .logo { font-size: 48px; }
        h1 { font-size: 24px; font-weight: 300; }
        .subtitle { color: #888; font-size: 14px; }
        .spinner {
          width: 40px; height: 40px;
          border: 3px solid #333;
          border-top-color: #4fc3f7;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .url { color: #4fc3f7; font-size: 13px; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="logo">🚁</div>
      <h1>UAV Dispatch Platform</h1>
      <div class="subtitle">Connecting to management console...</div>
      <div class="spinner"></div>
      <div class="url">${serverUrl}</div>
      <script>
        setTimeout(() => { window.location = '${serverUrl}'; }, 1500);
      </script>
    </body>
    </html>
  `)}`);
}

// ── System Tray ──────────────────────────────────────────────────────────────

function createTray() {
  // Use a simple icon (fallback to app icon)
  let trayIcon;
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    trayIcon = nativeImage.createEmpty();
  }
  
  tray = new Tray(trayIcon);
  tray.setToolTip('UAV Dispatch Platform');
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Management Console',
      click: () => { mainWindow.show(); mainWindow.focus(); }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => { showSettings(); }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.isQuiting = true; app.quit(); }
    },
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ── Settings Dialog ──────────────────────────────────────────────────────────

function showSettings() {
  const settingsWin = new BrowserWindow({
    width: 480,
    height: 340,
    parent: mainWindow,
    modal: true,
    resizable: false,
    title: 'Settings',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  settingsWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f5f5f5;
          padding: 24px;
          color: #333;
        }
        h2 { margin-bottom: 20px; color: #1a1a2e; }
        label { display: block; font-size: 13px; color: #666; margin-bottom: 4px; }
        input {
          width: 100%; padding: 8px 12px;
          border: 1px solid #ddd; border-radius: 6px;
          font-size: 14px; margin-bottom: 16px;
          outline: none;
        }
        input:focus { border-color: #4fc3f7; }
        .hint { font-size: 12px; color: #999; margin-top: -12px; margin-bottom: 16px; }
        .btns { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
        button {
          padding: 8px 20px; border: none; border-radius: 6px;
          cursor: pointer; font-size: 14px;
        }
        .primary { background: #1a1a2e; color: white; }
        .secondary { background: #e0e0e0; color: #333; }
        button:hover { opacity: 0.85; }
      </style>
    </head>
    <body>
      <h2>⚙️ Settings</h2>
      <label>Backend Server URL</label>
      <input type="url" id="serverUrl" value="${config.serverUrl}" placeholder="http://your-server:3000" />
      <p class="hint">The URL where uav-dispatch-platform is running</p>
      <div class="btns">
        <button class="secondary" onclick="window.close()">Cancel</button>
        <button class="primary" onclick="save()">Save & Reload</button>
      </div>
      <script>
        function save() {
          const url = document.getElementById('serverUrl').value.trim();
          if (!url) { alert('Please enter a valid URL'); return; }
          window.electronAPI.saveConfig({ serverUrl: url });
          window.close();
        }
      </script>
    </body>
    </html>
  `)}`);

  settingsWin.setMenu(null);
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('get-config', () => config);

ipcMain.handle('save-config', (event, newConfig) => {
  config = { ...config, ...newConfig };
  saveConfig(config);
  // Reload main window with new URL
  if (mainWindow) {
    loadPlatform();
  }
  return config;
});

// ── Application Menu ─────────────────────────────────────────────────────────

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: showSettings,
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Developer Tools',
          accelerator: 'F12',
          click: () => mainWindow.webContents.openDevTools(),
        },
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Dashboard',
          click: () => mainWindow.loadURL(config.serverUrl),
        },
        {
          label: 'Admin Panel',
          click: () => mainWindow.loadURL(`${config.serverUrl}/admin`),
        },
        {
          label: 'Settings',
          click: () => mainWindow.loadURL(`${config.serverUrl}/settings`),
        },
        { type: 'separator' },
        { role: 'back' },
        { role: 'forward' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: () => shell.openExternal('https://github.com/alexandereynolds0-cell/uav-dispatch-platform'),
        },
        {
          label: 'About UAV Dispatch Platform',
          click: () => dialog.showMessageBox(mainWindow, {
            title: 'About',
            message: 'UAV Dispatch Platform\nDesktop Management Console',
            detail: 'Version 1.0.0\nBuilt with Electron',
            icon: path.join(__dirname, 'assets', 'icon.png'),
          }),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  createTray();
  buildMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuiting = true;
});
