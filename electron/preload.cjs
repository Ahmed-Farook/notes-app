const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isMac: process.platform === 'darwin',
  sendNewNote: (callback) => ipcRenderer.on('action:new-note', callback),
  sendSearch: (callback) => ipcRenderer.on('action:search', callback),
  sendCheckUpdates: (callback) => ipcRenderer.on('action:check-updates', callback),
  installUpdate: (downloadUrl) => ipcRenderer.invoke('updater:install-update', downloadUrl),
  onUpdateProgress: (callback) => {
    const listener = (_event, percent) => callback(percent);
    ipcRenderer.on('updater:progress', listener);
    return () => ipcRenderer.removeListener('updater:progress', listener);
  },
});

