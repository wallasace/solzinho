const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('releaseNotesApi', {
  onStatus: (callback) => ipcRenderer.on('release-notes-status', (_e, payload) => callback(payload)),
  close: () => ipcRenderer.send('release-notes-close'),
});
