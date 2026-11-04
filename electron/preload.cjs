const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isMac: process.platform === 'darwin',
  sendNewNote: (callback) => ipcRenderer.on('action:new-note', callback),
  sendSearch: (callback) => ipcRenderer.on('action:search', callback),
});

