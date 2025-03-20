// ==============
// Preload script
// ==============
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  desktop: true,

  // Expose methods to the renderer process
  setBadgeCount: (count) => ipcRenderer.send('set-badge-count', count),
  showNotification: (title, body) => ipcRenderer.send('show-notification', title, body),
  setTitle: (title) => ipcRenderer.send('set-title', title)
})
