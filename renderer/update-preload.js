const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('updatePrompt', {
  onStatus: (callback) => ipcRenderer.on('update-status', (_e, payload) => callback(payload)),
  updateNow: () => ipcRenderer.send('update-now'),
  later: () => ipcRenderer.send('update-later'),
});
