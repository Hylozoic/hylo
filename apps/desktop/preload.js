// ==============
// Preload script
// ==============
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  desktop: true,

  // Expose methods to the renderer process
  setBadgeCount: (count) => ipcRenderer.send('set-badge-count', count),
  showNotification: (notification) => ipcRenderer.send('show-notification', notification),
  setTitle: (title) => ipcRenderer.send('set-title', title),
  getLocale: () => ipcRenderer.invoke('get-locale'),
  onNavigateTo: (callback) => ipcRenderer.on('navigate-to', (event, url) => callback(url))
})
