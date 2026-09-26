const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('speech', {
  onContent: (callback) => ipcRenderer.on('speech-content', (_e, content) => callback(content)),
  onUpdate: (callback) => ipcRenderer.on('speech-update', (_e, content) => callback(content)),
  onPlacement: (callback) => ipcRenderer.on('speech-placement', (_e, placement) => callback(placement)),
  reportSize: (size) => ipcRenderer.send('speech-size', size),
  click: () => ipcRenderer.send('speech-click'),
});
