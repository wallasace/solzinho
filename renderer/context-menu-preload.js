const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('menuApi', {
  onState: (callback) => ipcRenderer.on('menu-state', (_e, state) => callback(state)),
  action: (action, value) => ipcRenderer.send('menu-action', { action, value }),
});
