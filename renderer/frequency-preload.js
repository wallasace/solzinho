const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('freqPrompt', {
  onCurrent: (callback) => ipcRenderer.on('current-frequency', (_e, minutes) => callback(minutes)),
  confirm: (minutes) => ipcRenderer.send('set-custom-frequency', minutes),
  cancel: () => ipcRenderer.send('cancel-custom-frequency'),
});
