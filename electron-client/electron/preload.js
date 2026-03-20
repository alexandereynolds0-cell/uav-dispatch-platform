/**
 * Electron preload script - exposes safe APIs to renderer
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  reloadPlatform: () => ipcRenderer.invoke('reload-platform'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  platform: process.platform,
});
