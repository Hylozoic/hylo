const { app, BrowserWindow, screen: electronScreen, ipcMain, Notification } = require('electron')
const path = require('path')
const { initI18n, i18next } = require('./i18n.js')
const { bodyForNotification, titleForNotification, urlForNotification } = require('@hylo/presenters/NotificationPresenter')

let mainWindow

const HOST = app.isPackaged ? 'https://hylo.com' : 'http://localhost:3000'

function handleSetTitle (event, title) {
  const webContents = event.sender
  const win = BrowserWindow.fromWebContents(webContents)
  win.setTitle(title)
}

function handleShowNotification (event, notification) {
  try {
    // Strip HTML tags since electron notifications don't support HTML
    const stripHtml = str => str.replace(/<[^>]*>/g, '')

    // Translate the notification
    const translatedTitle = titleForNotification(notification, i18next.t)
    const translatedBody = bodyForNotification(notification, i18next.t)
    const url = urlForNotification(notification)

    const notif = new Notification({
      title: stripHtml(translatedTitle),
      body: stripHtml(translatedBody)
    })
    if (url) {
      notif.on('click', () => {
        if (!mainWindow) return
        if (mainWindow.isMinimized()) mainWindow.restore()
        if (!mainWindow.isVisible()) mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('navigate-to', url)
      })
    }
    notif.show()
  } catch (error) {
    console.error('Error showing notification:', error)
    // Fallback to untranslated notification
    new Notification({ title: notification.title, body: notification.body }).show()
  }
}

const createMainWindow = () => {
  let iconPath
  if (process.platform === 'darwin') {
    iconPath = path.join(__dirname, 'assets', 'icon.icns')
  } else if (process.platform === 'win32') {
    iconPath = path.join(__dirname, 'assets', 'icon.ico')
  } else if (process.platform === 'linux') {
    iconPath = path.join(__dirname, 'assets', 'icon.png')
  }

  mainWindow = new BrowserWindow({
    width: electronScreen.getPrimaryDisplay().workArea.width,
    height: electronScreen.getPrimaryDisplay().workArea.height,
    show: false,
    title: 'Hylo',
    backgroundColor: 'white',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    }
  })

  mainWindow.loadURL(HOST)

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Needed for notifications to open the app using a hylo:// link
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('hylo', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('hylo')
}

// Register IPC handlers before app is ready
ipcMain.on('set-badge-count', (event, count) => app.setBadgeCount(count))
ipcMain.on('set-title', (event, title) => handleSetTitle(event, title))
ipcMain.on('show-notification', (event, notification) => handleShowNotification(event, notification))
ipcMain.handle('get-locale', () => app.getLocale())

app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, we should focus our window.
  // Needed for notifications to open the app
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(async () => {
  await initI18n()
  createMainWindow()

  // Set the dock icon on macOS
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, 'assets', 'icon.icns')
    app.dock.setIcon(iconPath)
    app.setName('Hylo')
  }

  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
