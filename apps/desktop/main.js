const { app, BrowserWindow, screen: electronScreen, ipcMain, Notification } = require('electron')
const path = require('path')

function handleSetTitle (event, title) {
  const webContents = event.sender
  const win = BrowserWindow.fromWebContents(webContents)
  win.setTitle(title)
}

function handleShowNotification (event, title, body) {
  new Notification({ title, body }).show()
}

const createMainWindow = () => {
  let mainWindow = new BrowserWindow({
    width: electronScreen.getPrimaryDisplay().workArea.width,
    height: electronScreen.getPrimaryDisplay().workArea.height,
    show: false,
    backgroundColor: 'white',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  const startURL = app.isPackaged ? 'https://hylo.com' : 'http://localhost:3000'

  mainWindow.loadURL(startURL)

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createMainWindow()

  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) {
      createMainWindow()
    }
  })

  ipcMain.on('set-badge-count', (event, count) => app.setBadgeCount(count))
  ipcMain.on('set-title', handleSetTitle)
  ipcMain.on('show-notification', handleShowNotification)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
