/**
 * UAV Dispatch Platform - Electron Desktop Client
 *
 * Desktop shell for the UAV Dispatch Platform web management console.
 * It now performs connection checks and shows a built-in setup screen
 * instead of redirecting to a blank page when the backend server is unavailable.
 */

const { app, BrowserWindow, Menu, shell, dialog, ipcMain, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
const DEFAULT_SERVER_URL = 'http://127.0.0.1:3000';
const HEALTH_ENDPOINT = '/api/health';
const SERVER_CHECK_TIMEOUT_MS = 4000;

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return {
    serverUrl: DEFAULT_SERVER_URL,
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

function normalizeServerUrl(value) {
  const input = String(value || '').trim();
  if (!input) return DEFAULT_SERVER_URL;
  const withProtocol = /^https?:\/\//i.test(input) ? input : `http://${input}`;

  try {
    const parsed = new URL(withProtocol);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_SERVER_URL;
  }
}

async function checkServer(serverUrl) {
  const url = `${normalizeServerUrl(serverUrl)}${HEALTH_ENDPOINT}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SERVER_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        ok: false,
        message: `服务器返回 ${response.status} ${response.statusText}`,
      };
    }

    const payload = await response.json().catch(() => ({}));
    return {
      ok: true,
      message: payload.message || 'Backend server is online.',
      payload,
    };
  } catch (error) {
    clearTimeout(timeout);
    const message = error?.name === 'AbortError'
      ? `连接超时（>${SERVER_CHECK_TIMEOUT_MS / 1000} 秒）`
      : error?.message || '无法连接到服务器';

    return {
      ok: false,
      message,
    };
  }
}

let config = loadConfig();
config.serverUrl = normalizeServerUrl(config.serverUrl);
let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: config.windowWidth || 1280,
    height: config.windowHeight || 800,
    minWidth: 960,
    minHeight: 680,
    title: 'UAV Dispatch Platform - Management Console',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
    },
    show: false,
    backgroundColor: '#0f172a',
  });

  mainWindow.on('resize', () => {
    const [w, h] = mainWindow.getSize();
    config.windowWidth = w;
    config.windowHeight = h;
    saveConfig(config);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  loadPlatform();

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

function renderStatusPage({ serverUrl, status, detail }) {
  const safeUrl = normalizeServerUrl(serverUrl);
  const title = status === 'checking'
    ? '正在连接后端服务…'
    : status === 'error'
      ? '未连接到后端服务'
      : '后端服务已连接';
  const subtitle = status === 'checking'
    ? '桌面端正在检查管理后台是否可访问。'
    : status === 'error'
      ? '请先启动后端，再返回桌面端刷新。未启动后端时，Electron 包装壳会显示空白或无法加载页面。'
      : '后端可用，正在打开管理控制台。';
  const color = status === 'error' ? '#f97316' : '#38bdf8';
  const badgeText = status === 'error' ? '未连接' : status === 'checking' ? '检查中' : '已连接';

  return `<!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:;" />
    <title>UAV Dispatch Platform</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #020617;
        --panel: rgba(15, 23, 42, 0.92);
        --panel-border: rgba(148, 163, 184, 0.18);
        --text: #e2e8f0;
        --muted: #94a3b8;
        --accent: ${color};
        --accent-soft: rgba(56, 189, 248, 0.14);
        --danger-soft: rgba(249, 115, 22, 0.14);
        --success: #10b981;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background:
          radial-gradient(circle at top, rgba(56, 189, 248, 0.12), transparent 30%),
          linear-gradient(180deg, #0f172a 0%, var(--bg) 100%);
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
      }
      .shell {
        width: min(1040px, 100%);
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 24px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.45);
        overflow: hidden;
      }
      .hero {
        padding: 32px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        display: flex;
        gap: 24px;
        align-items: flex-start;
        justify-content: space-between;
      }
      .hero-left { max-width: 680px; }
      .logo { font-size: 48px; margin-bottom: 16px; }
      h1 { margin: 0 0 12px; font-size: 32px; line-height: 1.2; }
      .subtitle { color: var(--muted); font-size: 16px; line-height: 1.7; }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: ${status === 'error' ? 'var(--danger-soft)' : 'var(--accent-soft)'};
        border: 1px solid rgba(255,255,255,0.08);
        font-size: 13px;
      }
      .grid {
        padding: 32px;
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 24px;
      }
      .card {
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 18px;
        padding: 24px;
      }
      .card h2 { margin: 0 0 16px; font-size: 20px; }
      .server {
        margin: 16px 0;
        padding: 14px 16px;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(148, 163, 184, 0.2);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        word-break: break-all;
      }
      .detail {
        margin-top: 12px;
        color: ${status === 'error' ? '#fdba74' : '#7dd3fc'};
        font-size: 14px;
      }
      ol, ul { margin: 0; padding-left: 20px; color: var(--muted); line-height: 1.8; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
      button {
        border: none;
        border-radius: 12px;
        padding: 12px 16px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }
      .primary { background: var(--accent); color: #082f49; }
      .secondary { background: rgba(30, 41, 59, 0.92); color: var(--text); border: 1px solid rgba(148, 163, 184, 0.24); }
      .ghost { background: transparent; color: #cbd5e1; border: 1px dashed rgba(148, 163, 184, 0.24); }
      .tip {
        margin-top: 16px;
        padding: 14px 16px;
        border-radius: 12px;
        border: 1px solid rgba(16, 185, 129, 0.2);
        background: rgba(16, 185, 129, 0.08);
        color: #a7f3d0;
        font-size: 14px;
        line-height: 1.7;
      }
      .footer {
        padding: 0 32px 32px;
        color: #64748b;
        font-size: 12px;
      }
      code {
        background: rgba(15, 23, 42, 0.9);
        border-radius: 8px;
        padding: 2px 6px;
        color: #e2e8f0;
      }
      @media (max-width: 900px) {
        .hero, .grid { grid-template-columns: 1fr; display: block; }
        .grid > * + * { margin-top: 24px; }
        .hero { display: block; }
        .badge { margin-top: 16px; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="hero">
        <div class="hero-left">
          <div class="logo">🚁</div>
          <h1>${title}</h1>
          <div class="subtitle">${subtitle}</div>
        </div>
        <div class="badge">● ${badgeText}</div>
      </div>
      <div class="grid">
        <section class="card">
          <h2>当前后端地址</h2>
          <div class="server">${safeUrl}</div>
          <div class="detail">${detail || ''}</div>
          <div class="actions">
            <button class="primary" onclick="window.electronAPI.reloadPlatform()">重新检查并打开</button>
            <button class="secondary" onclick="window.electronAPI.openSettings()">修改服务器地址</button>
            <button class="ghost" onclick="window.electronAPI.openExternal(serverInput.value || '${safeUrl}')">在浏览器打开</button>
          </div>
          <div class="tip">
            <strong>说明：</strong> “Backend Server URL” 不是第三方地址，而是你自己的 UAV Dispatch 平台后端服务地址。<br />
            如果你在本机启动本仓库，通常就是 <code>http://127.0.0.1:3000</code> 或 <code>http://localhost:3000</code>。
          </div>
        </section>
        <section class="card">
          <h2>如何启动服务器</h2>
          <ol>
            <li>安装 Node.js 20+ 与 pnpm。</li>
            <li>在项目根目录执行：<code>pnpm install</code>。</li>
            <li>创建环境变量文件后执行：<code>pnpm dev</code>。</li>
            <li>看到 <code>Server running on http://localhost:3000/</code> 后，再打开桌面端。</li>
          </ol>
          <div class="tip" style="margin-top: 18px;">
            <strong>现在可先不填 API Key / Secret：</strong> 地图、支付等高级功能缺失时会受限，但管理后台与基础页面应该能启动，不应再直接空白。
          </div>
          <h2 style="margin-top: 24px;">快速排查</h2>
          <ul>
            <li>如果 3000 端口被占用，服务会自动切到 3001~3019 之间的空闲端口。</li>
            <li>如果你改了端口，请把桌面端里的地址改成实际端口。</li>
            <li>如果浏览器也打不开该地址，说明不是 Electron 问题，而是后端尚未启动。</li>
          </ul>
          <input id="serverInput" value="${safeUrl}" style="margin-top:16px;width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(148,163,184,.22);background:#020617;color:#e2e8f0;" />
        </section>
      </div>
      <div class="footer">UAV Dispatch Platform Desktop · 内置连接检测与启动说明页</div>
      <script>
        const serverInput = document.getElementById('serverInput');
      </script>
    </div>
  </body>
  </html>`;
}

async function loadPlatform() {
  const serverUrl = normalizeServerUrl(config.serverUrl);
  config.serverUrl = serverUrl;
  saveConfig(config);

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderStatusPage({
    serverUrl,
    status: 'checking',
    detail: '正在检查 ' + serverUrl + HEALTH_ENDPOINT,
  }))}`);

  const status = await checkServer(serverUrl);

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (status.ok) {
    await mainWindow.loadURL(serverUrl);
    return;
  }

  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderStatusPage({
    serverUrl,
    status: 'error',
    detail: status.message,
  }))}`);
}

function createTray() {
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

function showSettings() {
  const settingsWin = new BrowserWindow({
    width: 520,
    height: 420,
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
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f8fafc;
          padding: 24px;
          color: #0f172a;
        }
        h2 { margin-bottom: 20px; color: #0f172a; }
        label { display: block; font-size: 13px; color: #475569; margin-bottom: 6px; }
        input {
          width: 100%; padding: 12px 14px;
          border: 1px solid #cbd5e1; border-radius: 10px;
          font-size: 14px; margin-bottom: 12px;
          outline: none;
        }
        input:focus { border-color: #38bdf8; }
        .hint { font-size: 12px; color: #64748b; margin-bottom: 16px; line-height: 1.6; }
        .panel {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .btns { display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px; }
        button {
          padding: 10px 20px; border: none; border-radius: 10px;
          cursor: pointer; font-size: 14px; font-weight: 600;
        }
        .primary { background: #0f172a; color: white; }
        .secondary { background: #e2e8f0; color: #334155; }
        button:hover { opacity: 0.88; }
        code { background: #e2e8f0; padding: 2px 6px; border-radius: 6px; }
      </style>
    </head>
    <body>
      <h2>⚙️ 连接设置</h2>
      <div class="panel">
        <label>Backend Server URL</label>
        <input type="text" id="serverUrl" value="${config.serverUrl}" placeholder="http://127.0.0.1:3000" />
        <p class="hint">这里填写你自己的 UAV Dispatch 后端服务地址。<br>本机启动本仓库时，通常填 <code>http://127.0.0.1:3000</code>。</p>
      </div>
      <div class="panel">
        <p class="hint">
          <strong>启动命令：</strong><br>
          1. 进入项目根目录<br>
          2. 执行 <code>pnpm install</code><br>
          3. 执行 <code>pnpm dev</code><br>
          4. 服务启动后再回到桌面端点击保存
        </p>
      </div>
      <div class="btns">
        <button class="secondary" onclick="window.close()">取消</button>
        <button class="primary" onclick="save()">保存并重试连接</button>
      </div>
      <script>
        function save() {
          const url = document.getElementById('serverUrl').value.trim();
          if (!url) { alert('请输入后端地址'); return; }
          window.electronAPI.saveConfig({ serverUrl: url });
          window.close();
        }
      </script>
    </body>
    </html>
  `)}`);

  settingsWin.setMenu(null);
}

ipcMain.handle('get-config', () => config);
ipcMain.handle('save-config', async (_event, newConfig) => {
  config = { ...config, ...newConfig, serverUrl: normalizeServerUrl(newConfig?.serverUrl || config.serverUrl) };
  saveConfig(config);
  if (mainWindow) {
    await loadPlatform();
  }
  return config;
});
ipcMain.handle('reload-platform', async () => {
  await loadPlatform();
  return true;
});
ipcMain.handle('open-settings', () => {
  showSettings();
  return true;
});
ipcMain.handle('open-external', (_event, url) => {
  shell.openExternal(normalizeServerUrl(url));
  return true;
});

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
        {
          label: 'Reconnect',
          accelerator: 'CmdOrCtrl+R',
          click: () => loadPlatform(),
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
          click: () => loadPlatform(),
        },
        {
          label: 'Admin Panel',
          click: () => mainWindow.loadURL(`${config.serverUrl}/admin`),
        },
        {
          label: 'Settings Page',
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
          label: 'Open Backend URL in Browser',
          click: () => shell.openExternal(config.serverUrl),
        },
        {
          label: 'GitHub Repository',
          click: () => shell.openExternal('https://github.com/alexandereynolds0-cell/uav-dispatch-platform'),
        },
        {
          label: 'About UAV Dispatch Platform',
          click: () => dialog.showMessageBox(mainWindow, {
            title: 'About',
            message: 'UAV Dispatch Platform\nDesktop Management Console',
            detail: 'Version 1.1.0\nImproved with backend connectivity diagnostics',
            icon: path.join(__dirname, 'assets', 'icon.png'),
          }),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

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
