const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('solzinho', {
  onInit: (callback) => ipcRenderer.on('init-settings', (_e, settings) => callback(settings)),
  onState: (callback) => ipcRenderer.on('state', (_e, state) => callback(state)),
  onFaceDirection: (callback) => ipcRenderer.on('face-direction', (_e, direction) => callback(direction)),
  onBubble: (callback) => ipcRenderer.on('show-bubble', (_e, kind) => callback(kind)),
  onBreathingStart: (callback) => ipcRenderer.on('start-breathing', (_e, data) => callback(data)),
  onBreathingEnd: (callback) => ipcRenderer.on('end-breathing', () => callback()),
  onLanguageChanged: (callback) => ipcRenderer.on('language-changed', (_e, lang) => callback(lang)),
  stopBreathing: () => ipcRenderer.send('stop-breathing-request'),
  requestTip: () => ipcRenderer.send('request-tip'),
  bubbleDismissed: () => ipcRenderer.send('bubble-dismissed'),
  speechShow: (content) => ipcRenderer.send('speech-show', content),
  speechUpdate: (content) => ipcRenderer.send('speech-update', content),
  speechHide: () => ipcRenderer.send('speech-hide'),
  onSpeechClicked: (callback) => ipcRenderer.on('speech-clicked', () => callback()),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.send('drag-end'),
  openContextMenu: () => ipcRenderer.send('show-context-menu'),
});
